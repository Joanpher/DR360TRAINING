import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { contextoDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type { AgendaDto } from './dto/docencia.dto';

/*
  Todo lo que ve quien imparte por encima de un curso concreto: como va cada
  curso, como va cada estudiante, y que hay por delante en el calendario.

  Es un modulo de solo lectura. No crea ni cambia nada, y por eso no anota en la
  bitacora: consultar un reporte no es un hecho que haya que poder auditar.

  Los numeros salen de las tablas transaccionales y no de vistas materializadas.
  Con los volumenes de un centro de cursos -decenas de estudiantes por curso, no
  decenas de miles- una vista materializada solo anadiria el problema de cuando
  refrescarla, y el reporte se leeria viejo justo despues de calificar.
*/

export type ResumenCurso = {
  cursoId: string;
  codigo: string;
  nombre: string;
  estado: string;
  modalidad: string;
  estudiantes: number;
  tareasPublicadas: number;
  entregas: number;
  porCalificar: number;
  promedioTareas: string | null;
  evaluacionesPublicadas: number;
  intentos: number;
  promedioEvaluaciones: string | null;
  clasesCelebradas: number;
  asistenciaMedia: string | null;
};

export type FilaEstudiante = {
  membresiaId: string;
  nombre: string;
  matricula: string | null;
  estado: string;
  entregas: number;
  promedioTareas: string | null;
  intentos: number;
  promedioEvaluaciones: string | null;
  clasesAsistidas: number;
  minutos: number;
  ultimaActividadEn: string | null;
};

export type CabeceraCurso = {
  cursoId: string;
  codigo: string;
  nombre: string;
  estado: string;
  instructor: string | null;
  tareasPublicadas: number;
  evaluacionesPublicadas: number;
  clasesCelebradas: number;
};

export type TareaAgenda = {
  id: string;
  titulo: string;
  venceEn: string;
  publicada: boolean;
  puntos: string;
  cursoId: string;
  cursoCodigo: string;
  cursoNombre: string;
  estudiantes: number;
  entregas: number;
  porCalificar: number;
};

export type EvaluacionAgenda = {
  id: string;
  titulo: string;
  abreEn: string;
  cierraEn: string;
  publicada: boolean;
  cursoId: string;
  cursoCodigo: string;
  cursoNombre: string;
  estudiantes: number;
  intentos: number;
  porCalificar: number;
};

export type ReunionAgenda = {
  id: string;
  titulo: string;
  programadaPara: string;
  duracionMinutos: number;
  estado: string;
  cursoId: string;
  cursoCodigo: string;
  cursoNombre: string;
  asistentes: number;
};

const utc = (columna: string) =>
  `to_char(${columna} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

/* Las que cuentan como matricula viva: la retirada y la cancelada no. */
const ESTADOS_VIVOS = `('preinscrita', 'activa', 'completada')`;

/*
  El alcance de todo este modulo. Es la misma funcion que gobierna el aula, asi
  que reportes y aula nunca discrepan sobre que cursos son "los mios": quien
  imparte ve los suyos, y administracion y coordinacion los ven todos.
*/
const MIOS = `c.eliminado_en is null and app.puede_gestionar_curso_aula(c.id)`;

@Injectable()
export class DocenciaServicio {
  constructor(private readonly bd: BaseDatos) {}

  // -------------------------------------------------------------------------
  // Reportes · una fila por curso
  // -------------------------------------------------------------------------
  async reportes(sesion: Sesion): Promise<{ cursos: ResumenCurso[] }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<ResumenCurso>(
        `select c.id as "cursoId", c.codigo, c.nombre,
                c.estado::text as estado, c.modalidad::text as modalidad,
                coalesce(e.estudiantes, 0) as estudiantes,
                coalesce(t.tareas, 0) as "tareasPublicadas",
                coalesce(t.entregas, 0) as entregas,
                coalesce(t.por_calificar, 0) as "porCalificar",
                t.promedio::text as "promedioTareas",
                coalesce(v.evaluaciones, 0) as "evaluacionesPublicadas",
                coalesce(v.intentos, 0) as intentos,
                vp.promedio::text as "promedioEvaluaciones",
                coalesce(r.clases, 0) as "clasesCelebradas",
                -- Media de asistentes por clase sobre el total de matriculados.
                -- Se acota a 100 porque a una sala puede entrar alguien que no
                -- esta inscrito, y un 118% de asistencia no significa nada.
                case
                  when coalesce(e.estudiantes, 0) > 0 and r.promedio_asistentes is not null
                  then least(100, round(100 * r.promedio_asistentes / e.estudiantes, 1))::text
                end as "asistenciaMedia"
           from cursos c
           left join lateral (
             select count(*)::int as estudiantes
               from inscripciones i
              where i.curso_id = c.id and i.estado::text in ${ESTADOS_VIVOS}
           ) e on true
           left join lateral (
             select count(distinct tk.id)::int as tareas,
                    count(en.id)::int as entregas,
                    count(en.id) filter (where en.calificacion is null)::int as por_calificar,
                    round(
                      100 * sum(en.calificacion)
                      / nullif(sum(tk.puntos) filter (where en.calificacion is not null), 0),
                      1
                    ) as promedio
               from aula_tareas tk
               left join aula_entregas en on en.tarea_id = tk.id
              where tk.curso_id = c.id and tk.publicada
           ) t on true
           left join lateral (
             select count(distinct ev.id)::int as evaluaciones,
                    count(it.id)::int as intentos
               from evaluaciones ev
               left join evaluacion_intentos it
                 on it.evaluacion_id = ev.id and it.estado in ('enviado', 'calificado')
              where ev.curso_id = c.id and ev.publicada
           ) v on true
           left join lateral (
             -- El promedio se calcula sobre el MEJOR intento de cada persona en
             -- cada evaluacion. Promediar todos los intentos castigaria a quien
             -- reintenta, que es justo lo que un reintento existe para permitir.
             select round(100 * sum(b.mejor) / nullif(sum(b.puntos), 0), 1) as promedio
               from (
                 select max(it.calificacion) as mejor, max(ev.puntos_total) as puntos
                   from evaluaciones ev
                   join evaluacion_intentos it on it.evaluacion_id = ev.id
                  where ev.curso_id = c.id and ev.publicada and it.calificacion is not null
                  group by ev.id, it.membresia_id
               ) b
           ) vp on true
           left join lateral (
             select count(*)::int as clases, avg(asis.n) as promedio_asistentes
               from reuniones rn
               left join lateral (
                 select count(*)::int as n
                   from reunion_asistencias ra
                  where ra.reunion_id = rn.id and not ra.es_anfitrion
               ) asis on true
              where rn.curso_id = c.id and rn.estado in ('en_curso', 'finalizada')
           ) r on true
          where ${MIOS}
          order by c.nombre`,
      );
      return { cursos: rows };
    });
  }

  // -------------------------------------------------------------------------
  // Reportes · una fila por estudiante dentro de un curso
  // -------------------------------------------------------------------------
  async reporteCurso(
    sesion: Sesion,
    cursoId: string,
  ): Promise<{ curso: CabeceraCurso; estudiantes: FilaEstudiante[] }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const curso = await this.cabecera(cliente, cursoId);

      const { rows: estudiantes } = await cliente.query<FilaEstudiante>(
        `select i.membresia_id as "membresiaId",
                u.nombre_completo as nombre,
                m.codigo as matricula,
                i.estado::text as estado,
                coalesce(t.entregas, 0) as entregas,
                t.promedio::text as "promedioTareas",
                coalesce(v.intentos, 0) as intentos,
                vp.promedio::text as "promedioEvaluaciones",
                coalesce(r.asistidas, 0) as "clasesAsistidas",
                coalesce(r.minutos, 0) as minutos,
                -- greatest ignora los nulos, asi que sirve de "ultima señal de
                -- vida" aunque la persona solo haya hecho una de las tres cosas.
                ${utc('greatest(t.ultima, v.ultima, r.ultima)')} as "ultimaActividadEn"
           from inscripciones i
           join membresias m on m.id = i.membresia_id
           join usuarios u on u.id = m.usuario_id
           left join lateral (
             select count(*)::int as entregas,
                    max(en.entregado_en) as ultima,
                    round(
                      100 * sum(en.calificacion)
                      / nullif(sum(tk.puntos) filter (where en.calificacion is not null), 0),
                      1
                    ) as promedio
               from aula_entregas en
               join aula_tareas tk on tk.id = en.tarea_id and tk.publicada
              where en.curso_id = $1 and en.membresia_id = i.membresia_id
           ) t on true
           left join lateral (
             select count(*)::int as intentos, max(it.enviado_en) as ultima
               from evaluacion_intentos it
               join evaluaciones ev on ev.id = it.evaluacion_id and ev.publicada
              where it.curso_id = $1 and it.membresia_id = i.membresia_id
                and it.estado in ('enviado', 'calificado')
           ) v on true
           left join lateral (
             select round(100 * sum(b.mejor) / nullif(sum(b.puntos), 0), 1) as promedio
               from (
                 select max(it.calificacion) as mejor, max(ev.puntos_total) as puntos
                   from evaluacion_intentos it
                   join evaluaciones ev on ev.id = it.evaluacion_id and ev.publicada
                  where it.curso_id = $1 and it.membresia_id = i.membresia_id
                    and it.calificacion is not null
                  group by ev.id
               ) b
           ) vp on true
           left join lateral (
             select count(*)::int as asistidas,
                    coalesce(sum(ra.minutos), 0)::int as minutos,
                    max(ra.ultima_entrada_en) as ultima
               from reunion_asistencias ra
               join reuniones rn on rn.id = ra.reunion_id
                and rn.estado in ('en_curso', 'finalizada')
              where ra.curso_id = $1 and ra.membresia_id = i.membresia_id
                and not ra.es_anfitrion
           ) r on true
          where i.curso_id = $1 and i.estado::text in ${ESTADOS_VIVOS}
          order by u.nombre_completo`,
        [cursoId],
      );

      return { curso, estudiantes };
    });
  }

  // -------------------------------------------------------------------------
  // Agenda · lo que cae dentro de un rango de fechas
  // -------------------------------------------------------------------------
  /*
    Tres consultas y no una union: los tres tipos de evento tienen columnas
    distintas y forzarlos a una sola forma obligaria a rellenar de nulos lo que
    no aplica. El calendario los mezcla al pintarlos, que es donde de verdad
    conviven.

    A diferencia del calendario del estudiante, aqui SI se devuelven las tareas y
    evaluaciones sin publicar: quien las prepara necesita ver el borrador en su
    sitio del mes, y por eso cada evento lleva su bandera `publicada`.
  */
  async agenda(
    sesion: Sesion,
    rango: AgendaDto,
  ): Promise<{
    tareas: TareaAgenda[];
    evaluaciones: EvaluacionAgenda[];
    reuniones: ReunionAgenda[];
  }> {
    const dias =
      (new Date(rango.hasta).getTime() - new Date(rango.desde).getTime()) /
      86_400_000;
    if (!Number.isFinite(dias) || dias <= 0 || dias > 370) {
      throw new BadRequestException(
        'El rango de la agenda debe estar entre 1 y 370 dias.',
      );
    }

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const parametros = [rango.desde, rango.hasta];

      const { rows: tareas } = await cliente.query<TareaAgenda>(
        `select tk.id, tk.titulo, ${utc('tk.vence_en')} as "venceEn",
                tk.publicada, tk.puntos::text as puntos,
                c.id as "cursoId", c.codigo as "cursoCodigo", c.nombre as "cursoNombre",
                coalesce(e.estudiantes, 0) as estudiantes,
                coalesce(en.entregas, 0) as entregas,
                coalesce(en.por_calificar, 0) as "porCalificar"
           from aula_tareas tk
           join cursos c on c.id = tk.curso_id
           left join lateral (
             select count(*)::int as estudiantes
               from inscripciones i
              where i.curso_id = c.id and i.estado::text in ${ESTADOS_VIVOS}
           ) e on true
           left join lateral (
             select count(*)::int as entregas,
                    count(*) filter (where x.calificacion is null)::int as por_calificar
               from aula_entregas x
              where x.tarea_id = tk.id
           ) en on true
          where ${MIOS}
            and tk.vence_en >= $1::timestamptz and tk.vence_en < $2::timestamptz
          order by tk.vence_en`,
        parametros,
      );

      const { rows: evaluaciones } = await cliente.query<EvaluacionAgenda>(
        `select ev.id, ev.titulo,
                ${utc('ev.abre_en')} as "abreEn",
                ${utc('ev.cierra_en')} as "cierraEn",
                ev.publicada,
                c.id as "cursoId", c.codigo as "cursoCodigo", c.nombre as "cursoNombre",
                coalesce(e.estudiantes, 0) as estudiantes,
                coalesce(it.intentos, 0) as intentos,
                coalesce(it.por_calificar, 0) as "porCalificar"
           from evaluaciones ev
           join cursos c on c.id = ev.curso_id
           left join lateral (
             select count(*)::int as estudiantes
               from inscripciones i
              where i.curso_id = c.id and i.estado::text in ${ESTADOS_VIVOS}
           ) e on true
           left join lateral (
             select count(*)::int as intentos,
                    count(*) filter (where x.estado = 'enviado')::int as por_calificar
               from evaluacion_intentos x
              where x.evaluacion_id = ev.id and x.estado in ('enviado', 'calificado')
           ) it on true
          where ${MIOS}
            -- La ventana entera, no solo el cierre: una evaluacion que abre
            -- dentro del mes es un evento del mes aunque cierre en el siguiente.
            and ev.cierra_en >= $1::timestamptz and ev.abre_en < $2::timestamptz
          order by ev.abre_en`,
        parametros,
      );

      const { rows: reuniones } = await cliente.query<ReunionAgenda>(
        `select rn.id, rn.titulo,
                ${utc('rn.programada_para')} as "programadaPara",
                rn.duracion_minutos as "duracionMinutos",
                rn.estado::text as estado,
                c.id as "cursoId", c.codigo as "cursoCodigo", c.nombre as "cursoNombre",
                coalesce(a.asistentes, 0) as asistentes
           from reuniones rn
           join cursos c on c.id = rn.curso_id
           left join lateral (
             select count(*)::int as asistentes
               from reunion_asistencias ra
              where ra.reunion_id = rn.id and not ra.es_anfitrion
           ) a on true
          where ${MIOS}
            and rn.programada_para is not null
            and rn.programada_para >= $1::timestamptz
            and rn.programada_para < $2::timestamptz
          order by rn.programada_para`,
        parametros,
      );

      return { tareas, evaluaciones, reuniones };
    });
  }

  // -------------------------------------------------------------------------
  private async cabecera(
    cliente: PoolClient,
    cursoId: string,
  ): Promise<CabeceraCurso> {
    const { rows } = await cliente.query<CabeceraCurso>(
      `select c.id as "cursoId", c.codigo, c.nombre, c.estado::text as estado,
              u.nombre_completo as instructor,
              (select count(*)::int from aula_tareas tk
                where tk.curso_id = c.id and tk.publicada) as "tareasPublicadas",
              (select count(*)::int from evaluaciones ev
                where ev.curso_id = c.id and ev.publicada) as "evaluacionesPublicadas",
              (select count(*)::int from reuniones rn
                where rn.curso_id = c.id
                  and rn.estado in ('en_curso', 'finalizada')) as "clasesCelebradas"
         from cursos c
         left join membresias mi on mi.id = c.instructor_membresia_id
         left join usuarios u on u.id = mi.usuario_id
        where c.id = $1 and ${MIOS}`,
      [cursoId],
    );
    if (!rows[0]) {
      throw new NotFoundException(
        'Ese curso no existe o no esta entre los que impartes.',
      );
    }
    return rows[0];
  }
}
