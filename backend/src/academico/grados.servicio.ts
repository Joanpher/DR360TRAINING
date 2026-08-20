import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, diferencias, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type {
  ActualizarGradoDto,
  CrearGradoDto,
  PlanEstudioDto,
} from './dto/escolar.dto';

export type MateriaDelPlan = {
  asignaturaId: string;
  codigo: string;
  nombre: string;
  horasSemanales: number | null;
};

export type Grado = {
  id: string;
  nivel: string;
  orden: number;
  nombre: string;
  unidadAcademicaId: string | null;
  unidad: string | null;
  activo: boolean;
  secciones: number;
  plan: MateriaDelPlan[];
};

/*
  El plan de estudio viaja dentro del grado y no en una llamada aparte. Es la
  respuesta a "que lleva 3ro de Primaria", que es justo lo que se mira cuando se
  mira un grado; separarlo obligaria a la pantalla a pedir N planes para pintar
  N filas.
*/
const LISTA = `
  select g.id, g.nivel::text as nivel, g.orden, g.nombre,
         g.unidad_academica_id as "unidadAcademicaId",
         ua.nombre as unidad, g.activo,
         (select count(*)::int from secciones s
           where s.grado_id = g.id and s.eliminado_en is null) as secciones,
         coalesce((
           select json_agg(json_build_object(
                    'asignaturaId', a.id, 'codigo', a.codigo, 'nombre', a.nombre,
                    'horasSemanales', pe.horas_semanales)
                  order by pe.orden, a.nombre)
             from plan_estudio pe
             join asignaturas a on a.id = pe.asignatura_id and a.eliminado_en is null
            where pe.grado_id = g.id
         ), '[]'::json) as plan
    from grados g
    left join unidades_academicas ua
           on ua.id = g.unidad_academica_id and ua.eliminado_en is null
   where g.eliminado_en is null
   order by g.nivel, g.orden
`;

@Injectable()
export class GradosServicio {
  constructor(private readonly bd: BaseDatos) {}

  async listar(sesion: Sesion): Promise<{ grados: Grado[] }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Grado>(LISTA);
      return { grados: rows };
    });
  }

  async crear(sesion: Sesion, datos: CrearGradoDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into grados (institucion_id, nivel, orden, nombre, unidad_academica_id)
         values ($1, $2::nivel_escolar, $3, $4, $5)
         returning id`,
        [
          institucionDe(sesion),
          datos.nivel,
          datos.orden,
          datos.nombre,
          datos.unidadAcademicaId ?? null,
        ],
      );

      await anotar(
        cliente,
        {
          accion: 'grado.creado',
          entidad: 'grados',
          entidadId: rows[0].id,
          datos: { nivel: datos.nivel, orden: datos.orden, nombre: datos.nombre },
        },
        origen,
      );

      const { rows: grados } = await cliente.query<Grado>(LISTA);
      return { grados };
    });
  }

  async actualizar(sesion: Sesion, id: string, datos: ActualizarGradoDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leer(cliente, id);

      const cambios = diferencias(
        {
          nivel: antes.nivel,
          orden: antes.orden,
          nombre: antes.nombre,
          unidadAcademicaId: antes.unidadAcademicaId,
          activo: antes.activo,
        },
        datos as Record<string, unknown>,
      );

      if (Object.keys(cambios).length > 0) {
        await cliente.query(
          `update grados set
              nivel = $2::nivel_escolar, orden = $3, nombre = $4,
              unidad_academica_id = $5, activo = $6
            where id = $1`,
          [
            id,
            datos.nivel ?? antes.nivel,
            datos.orden ?? antes.orden,
            datos.nombre ?? antes.nombre,
            'unidadAcademicaId' in datos
              ? (datos.unidadAcademicaId ?? null)
              : antes.unidadAcademicaId,
            datos.activo ?? antes.activo,
          ],
        );

        await anotar(
          cliente,
          { accion: 'grado.actualizado', entidad: 'grados', entidadId: id, datos: { cambios } },
          origen,
        );
      }

      const { rows: grados } = await cliente.query<Grado>(LISTA);
      return { grados };
    });
  }

  /*
    El plan se manda entero y aqui se calcula la diferencia: lo que sobra se
    borra, lo que falta se inserta y lo que ya estaba solo cambia de horas. El
    orden se toma de la posicion en la lista, que es como se ve en pantalla.

    Cambiar el plan NO toca las secciones que ya existen. Un grupo que lleva
    medio ano cursando ocho materias no puede perder una porque alguien edite el
    plan; para eso esta la sincronizacion explicita de la seccion, que dice que
    va a anadir antes de hacerlo.
  */
  async guardarPlan(sesion: Sesion, id: string, datos: PlanEstudioDto, origen: Origen) {
    const materias = datos.materias;
    const ids = materias.map((m) => m.asignaturaId);

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Hay una materia repetida en el plan.');
    }

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const grado = await this.leer(cliente, id);

      await cliente.query(
        `delete from plan_estudio
          where grado_id = $1
            and ($2::uuid[] = '{}' or asignatura_id <> all ($2::uuid[]))`,
        [id, ids],
      );

      for (const [posicion, materia] of materias.entries()) {
        await cliente.query(
          `insert into plan_estudio
             (institucion_id, grado_id, asignatura_id, horas_semanales, orden)
           values ($1, $2, $3, $4, $5)
           on conflict (grado_id, asignatura_id)
           do update set horas_semanales = excluded.horas_semanales,
                         orden = excluded.orden`,
          [
            institucionDe(sesion),
            id,
            materia.asignaturaId,
            materia.horasSemanales ?? null,
            posicion,
          ],
        );
      }

      await anotar(
        cliente,
        {
          accion: 'grado.plan_actualizado',
          entidad: 'grados',
          entidadId: id,
          datos: { grado: grado.nombre, materias: materias.length },
        },
        origen,
      );

      const { rows: grados } = await cliente.query<Grado>(LISTA);
      return { grados };
    });
  }

  async eliminar(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const grado = await this.leer(cliente, id);

      const { rows: usos } = await cliente.query<{ secciones: number }>(
        `select count(*)::int as secciones from secciones
          where grado_id = $1 and eliminado_en is null`,
        [id],
      );

      if (usos[0].secciones > 0) {
        throw new BadRequestException(
          `Ese grado tiene ${usos[0].secciones} secciones. Desactivalo en vez de eliminarlo: el expediente de quien lo curso sigue apuntando aqui.`,
        );
      }

      await cliente.query(`update grados set eliminado_en = now() where id = $1`, [id]);
      await cliente.query(`delete from plan_estudio where grado_id = $1`, [id]);

      await anotar(
        cliente,
        {
          accion: 'grado.eliminado',
          entidad: 'grados',
          entidadId: id,
          datos: { nombre: grado.nombre },
        },
        origen,
      );

      const { rows: grados } = await cliente.query<Grado>(LISTA);
      return { grados };
    });
  }

  private async leer(cliente: PoolClient, id: string) {
    const { rows } = await cliente.query<{
      nivel: string;
      orden: number;
      nombre: string;
      unidadAcademicaId: string | null;
      activo: boolean;
    }>(
      `select nivel::text as nivel, orden, nombre,
              unidad_academica_id as "unidadAcademicaId", activo
         from grados where id = $1 and eliminado_en is null for update`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Ese grado no existe.');
    return rows[0];
  }
}
