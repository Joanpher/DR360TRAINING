import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, diferencias, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type { ActualizarUnidadDto, CrearUnidadDto } from './dto/academico.dto';

export type Unidad = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  padreId: string | null;
  sedeId: string | null;
  sede: string | null;
  activa: boolean;
  grados: number;
  /*
    Quien coordina la unidad no es una columna: es quien tiene rol coordinador
    y esta unidad en su membresia. Se deriva en vez de duplicarse para que no
    puedan contradecirse una a la otra.
  */
  responsables: string[];
};

const LISTA = `
  select u.id, u.codigo, u.nombre, u.tipo::text as tipo,
         u.padre_id as "padreId", u.sede_id as "sedeId",
         s.nombre as sede, u.activa,
         (select count(*)::int from grados g
           where g.unidad_academica_id = u.id and g.eliminado_en is null) as grados,
         coalesce((
           select array_agg(us.nombre_completo order by us.nombre_completo)
             from membresias m
             join membresia_roles r on r.membresia_id = m.id and r.rol = 'coordinador'
             join usuarios us on us.id = m.usuario_id
            where m.unidad_academica_id = u.id
              and m.estado = 'activa'
              and m.eliminado_en is null
         ), '{}') as responsables
    from unidades_academicas u
    left join sedes s on s.id = u.sede_id and s.eliminado_en is null
   where u.eliminado_en is null
   order by u.nombre
`;

@Injectable()
export class UnidadesServicio {
  constructor(private readonly bd: BaseDatos) {}

  async listar(sesion: Sesion): Promise<{ unidades: Unidad[] }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Unidad>(LISTA);
      return { unidades: rows };
    });
  }

  async crear(sesion: Sesion, datos: CrearUnidadDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into unidades_academicas
           (institucion_id, codigo, nombre, tipo, padre_id, sede_id)
         values ($1, $2, $3, $4::tipo_unidad_academica, $5, $6)
         returning id`,
        [
          institucionDe(sesion),
          datos.codigo,
          datos.nombre,
          datos.tipo,
          datos.padreId ?? null,
          datos.sedeId ?? null,
        ],
      );

      await anotar(
        cliente,
        {
          accion: 'unidad.creada',
          entidad: 'unidades_academicas',
          entidadId: rows[0].id,
          datos: { codigo: datos.codigo, nombre: datos.nombre, tipo: datos.tipo },
        },
        origen,
      );

      const { rows: unidades } = await cliente.query<Unidad>(LISTA);
      return { unidades };
    });
  }

  async actualizar(sesion: Sesion, id: string, datos: ActualizarUnidadDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leer(cliente, id);

      // padreId con null significa "pasa a ser de primer nivel", que no es lo
      // mismo que no mandarlo. Por eso se mira si la clave viene, no su valor.
      const cambiaPadre = 'padreId' in datos;
      const nuevoPadre = cambiaPadre ? (datos.padreId ?? null) : antes.padreId;

      if (cambiaPadre && nuevoPadre !== antes.padreId && nuevoPadre !== null) {
        await this.comprobarCiclo(cliente, id, nuevoPadre);
      }

      const cambios = diferencias(
        {
          codigo: antes.codigo,
          nombre: antes.nombre,
          tipo: antes.tipo,
          padreId: antes.padreId,
          sedeId: antes.sedeId,
          activa: antes.activa,
        },
        {
          ...(datos as Record<string, unknown>),
          ...(cambiaPadre ? { padreId: nuevoPadre } : {}),
        },
      );

      if (Object.keys(cambios).length > 0) {
        await cliente.query(
          `update unidades_academicas set
              codigo = $2, nombre = $3, tipo = $4::tipo_unidad_academica,
              padre_id = $5, sede_id = $6, activa = $7
            where id = $1`,
          [
            id,
            datos.codigo ?? antes.codigo,
            datos.nombre ?? antes.nombre,
            datos.tipo ?? antes.tipo,
            nuevoPadre,
            'sedeId' in datos ? (datos.sedeId ?? null) : antes.sedeId,
            datos.activa ?? antes.activa,
          ],
        );

        await anotar(
          cliente,
          {
            accion: 'unidad.actualizada',
            entidad: 'unidades_academicas',
            entidadId: id,
            datos: { cambios },
          },
          origen,
        );
      }

      const { rows: unidades } = await cliente.query<Unidad>(LISTA);
      return { unidades };
    });
  }

  async eliminar(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const unidad = await this.leer(cliente, id);

      const { rows: usos } = await cliente.query<{ hijas: number; grados: number }>(
        `select (select count(*)::int from unidades_academicas
                  where padre_id = $1 and eliminado_en is null) as hijas,
                (select count(*)::int from grados
                  where unidad_academica_id = $1 and eliminado_en is null) as grados`,
        [id],
      );

      if (usos[0].hijas > 0) {
        throw new BadRequestException(
          `De esa unidad cuelgan ${usos[0].hijas} subunidades. Muevelas o eliminalas antes.`,
        );
      }
      if (usos[0].grados > 0) {
        throw new BadRequestException(
          `Esa unidad tiene ${usos[0].grados} grados. Asignalos a otra unidad antes de eliminarla.`,
        );
      }

      await cliente.query(
        `update unidades_academicas set eliminado_en = now() where id = $1`,
        [id],
      );

      await anotar(
        cliente,
        {
          accion: 'unidad.eliminada',
          entidad: 'unidades_academicas',
          entidadId: id,
          datos: { codigo: unidad.codigo, nombre: unidad.nombre },
        },
        origen,
      );

      const { rows: unidades } = await cliente.query<Unidad>(LISTA);
      return { unidades };
    });
  }

  /*
    La base impide que una unidad sea su propio padre, pero no que A cuelgue de
    B mientras B cuelga de A: para verlo hay que recorrer el arbol, y eso una
    restriccion de columna no lo hace. Sin esta comprobacion, la lista se
    quedaria dando vueltas al pintar la jerarquia.

    Se sube desde el padre propuesto hacia la raiz; si por el camino aparece la
    unidad que se esta moviendo, el movimiento cerraria un ciclo.
  */
  private async comprobarCiclo(cliente: PoolClient, id: string, padreId: string) {
    const { rows } = await cliente.query<{ ciclo: boolean }>(
      `with recursive ascendientes as (
         select id, padre_id
           from unidades_academicas
          where id = $2 and eliminado_en is null
         union all
         select u.id, u.padre_id
           from unidades_academicas u
           join ascendientes a on u.id = a.padre_id
          where u.eliminado_en is null
       )
       select exists (select 1 from ascendientes where id = $1) as ciclo`,
      [id, padreId],
    );

    if (rows[0]?.ciclo) {
      throw new BadRequestException(
        'Esa unidad no puede colgar de una de sus propias subunidades.',
      );
    }
  }

  private async leer(cliente: PoolClient, id: string) {
    const { rows } = await cliente.query<{
      codigo: string;
      nombre: string;
      tipo: string;
      padreId: string | null;
      sedeId: string | null;
      activa: boolean;
    }>(
      `select codigo, nombre, tipo::text as tipo, padre_id as "padreId",
              sede_id as "sedeId", activa
         from unidades_academicas
        where id = $1 and eliminado_en is null for update`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Esa unidad academica no existe.');
    return rows[0];
  }
}
