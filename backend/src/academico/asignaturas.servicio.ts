import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, diferencias, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type { ActualizarAsignaturaDto, CrearAsignaturaDto } from './dto/escolar.dto';

export type Asignatura = {
  id: string;
  codigo: string;
  nombre: string;
  area: string | null;
  activa: boolean;
  /* En cuantos grados aparece. Es lo que dice si se puede retirar. */
  grados: number;
};

const LISTA = `
  select a.id, a.codigo, a.nombre, a.area, a.activa,
         (select count(*)::int from plan_estudio pe where pe.asignatura_id = a.id) as grados
    from asignaturas a
   where a.eliminado_en is null
   order by a.activa desc, a.nombre
`;

/*
  El catalogo de materias del colegio. Es una lista corta y estable -Matematica,
  Lengua Espanola, Ciencias Sociales- que se define una vez y casi no cambia.

  Una asignatura no es un curso: "Matematica" es la materia, y "Matematica de
  3ro A en 2026-2027" es el curso. Confundirlas es lo que lleva a duplicar la
  misma materia una vez por cada grupo que la recibe.
*/
@Injectable()
export class AsignaturasServicio {
  constructor(private readonly bd: BaseDatos) {}

  async listar(sesion: Sesion): Promise<{ asignaturas: Asignatura[] }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Asignatura>(LISTA);
      return { asignaturas: rows };
    });
  }

  async crear(sesion: Sesion, datos: CrearAsignaturaDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into asignaturas (institucion_id, codigo, nombre, area)
         values ($1, $2, $3, $4) returning id`,
        [institucionDe(sesion), datos.codigo, datos.nombre, datos.area ?? null],
      );

      await anotar(
        cliente,
        {
          accion: 'asignatura.creada',
          entidad: 'asignaturas',
          entidadId: rows[0].id,
          datos: { codigo: datos.codigo, nombre: datos.nombre },
        },
        origen,
      );

      const { rows: asignaturas } = await cliente.query<Asignatura>(LISTA);
      return { asignaturas };
    });
  }

  async actualizar(
    sesion: Sesion,
    id: string,
    datos: ActualizarAsignaturaDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leer(cliente, id);

      const cambios = diferencias(
        {
          codigo: antes.codigo,
          nombre: antes.nombre,
          area: antes.area,
          activa: antes.activa,
        },
        datos as Record<string, unknown>,
      );

      if (Object.keys(cambios).length > 0) {
        await cliente.query(
          `update asignaturas set codigo = $2, nombre = $3, area = $4, activa = $5
            where id = $1`,
          [
            id,
            datos.codigo ?? antes.codigo,
            datos.nombre ?? antes.nombre,
            'area' in datos ? (datos.area ?? null) : antes.area,
            datos.activa ?? antes.activa,
          ],
        );

        await anotar(
          cliente,
          {
            accion: 'asignatura.actualizada',
            entidad: 'asignaturas',
            entidadId: id,
            datos: { cambios },
          },
          origen,
        );
      }

      const { rows: asignaturas } = await cliente.query<Asignatura>(LISTA);
      return { asignaturas };
    });
  }

  async eliminar(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const asignatura = await this.leer(cliente, id);

      const { rows: usos } = await cliente.query<{ planes: number; cursos: number }>(
        `select (select count(*)::int from plan_estudio where asignatura_id = $1) as planes,
                (select count(*)::int from cursos
                  where asignatura_id = $1 and eliminado_en is null) as cursos`,
        [id],
      );

      if (usos[0].cursos > 0) {
        throw new BadRequestException(
          `Esa materia se esta impartiendo en ${usos[0].cursos} cursos. Desactivala en vez de eliminarla.`,
        );
      }
      if (usos[0].planes > 0) {
        throw new BadRequestException(
          `Esa materia esta en el plan de ${usos[0].planes} grados. Quitala de esos planes antes.`,
        );
      }

      await cliente.query(`update asignaturas set eliminado_en = now() where id = $1`, [id]);

      await anotar(
        cliente,
        {
          accion: 'asignatura.eliminada',
          entidad: 'asignaturas',
          entidadId: id,
          datos: { codigo: asignatura.codigo, nombre: asignatura.nombre },
        },
        origen,
      );

      const { rows: asignaturas } = await cliente.query<Asignatura>(LISTA);
      return { asignaturas };
    });
  }

  private async leer(cliente: PoolClient, id: string) {
    const { rows } = await cliente.query<{
      codigo: string;
      nombre: string;
      area: string | null;
      activa: boolean;
    }>(
      `select codigo, nombre, area, activa
         from asignaturas where id = $1 and eliminado_en is null for update`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Esa materia no existe.');
    return rows[0];
  }
}
