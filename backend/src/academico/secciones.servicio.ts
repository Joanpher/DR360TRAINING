import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, diferencias, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type {
  ActualizarCursoDto,
  ActualizarSeccionDto,
  CrearSeccionDto,
  ListarCursosDto,
  ListarSeccionesDto,
} from './dto/escolar.dto';

export type Seccion = {
  id: string;
  anoEscolarId: string;
  ano: string;
  gradoId: string;
  grado: string;
  nivel: string;
  nombre: string;
  cupo: number | null;
  aula: string | null;
  sedeId: string | null;
  sede: string | null;
  tutorMembresiaId: string | null;
  tutor: string | null;
  activa: boolean;
  cursos: number;
  cursosSinDocente: number;
};

export type Curso = {
  id: string;
  anoEscolarId: string;
  seccionId: string;
  seccion: string;
  grado: string;
  asignaturaId: string;
  asignatura: string;
  codigoAsignatura: string;
  docenteMembresiaId: string | null;
  docente: string | null;
  estado: string;
};

const LISTA_SECCIONES = `
  select s.id, s.ano_escolar_id as "anoEscolarId", a.codigo as ano,
         s.grado_id as "gradoId", g.nombre as grado, g.nivel::text as nivel,
         s.nombre, s.cupo, s.aula,
         s.sede_id as "sedeId", sd.nombre as sede,
         s.tutor_membresia_id as "tutorMembresiaId", ut.nombre_completo as tutor,
         s.activa,
         (select count(*)::int from cursos c
           where c.seccion_id = s.id and c.eliminado_en is null) as cursos,
         (select count(*)::int from cursos c
           where c.seccion_id = s.id and c.eliminado_en is null
             and c.docente_membresia_id is null) as "cursosSinDocente"
    from secciones s
    join anos_escolares a on a.id = s.ano_escolar_id
    join grados g on g.id = s.grado_id
    left join sedes sd on sd.id = s.sede_id and sd.eliminado_en is null
    left join membresias mt on mt.id = s.tutor_membresia_id and mt.eliminado_en is null
    left join usuarios ut on ut.id = mt.usuario_id
   where s.eliminado_en is null
`;

const LISTA_CURSOS = `
  select c.id, c.ano_escolar_id as "anoEscolarId",
         c.seccion_id as "seccionId",
         (g.nombre || ' ' || s.nombre) as seccion, g.nombre as grado,
         c.asignatura_id as "asignaturaId", a.nombre as asignatura,
         a.codigo as "codigoAsignatura",
         c.docente_membresia_id as "docenteMembresiaId",
         ud.nombre_completo as docente,
         c.estado::text as estado
    from cursos c
    join secciones s on s.id = c.seccion_id
    join grados g on g.id = s.grado_id
    join asignaturas a on a.id = c.asignatura_id
    left join membresias md on md.id = c.docente_membresia_id and md.eliminado_en is null
    left join usuarios ud on ud.id = md.usuario_id
   where c.eliminado_en is null
`;

@Injectable()
export class SeccionesServicio {
  constructor(private readonly bd: BaseDatos) {}

  async listar(sesion: Sesion, filtros: ListarSeccionesDto) {
    const condiciones: string[] = [];
    const valores: unknown[] = [];

    if (filtros.anoEscolarId) {
      valores.push(filtros.anoEscolarId);
      condiciones.push(`s.ano_escolar_id = $${valores.length}`);
    }
    if (filtros.gradoId) {
      valores.push(filtros.gradoId);
      condiciones.push(`s.grado_id = $${valores.length}`);
    }

    const extra = condiciones.length ? ` and ${condiciones.join(' and ')}` : '';

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Seccion>(
        `${LISTA_SECCIONES} ${extra} order by g.nivel, g.orden, s.nombre`,
        valores,
      );
      return { secciones: rows };
    });
  }

  /*
    Crear una seccion crea tambien sus cursos, uno por cada materia del plan de
    estudio del grado.

    Es la pieza central del modelo escolar. En una universidad el estudiante
    elige asignaturas y hay que matricularlo en cada una; en un colegio, 3ro A
    lleva las materias de 3ro y punto. Generarlas aqui significa que inscribir a
    un nino en 3ro A lo deja con sus ocho cursos sin que nadie los toque uno por
    uno, y que un curso no pueda "olvidarse" para un grupo.

    Si el grado no tiene plan todavia, la seccion se crea vacia y se avisa: es
    preferible a bloquear la creacion, porque a veces se arman los grupos antes
    de cerrar el plan.
  */
  async crear(sesion: Sesion, datos: CrearSeccionDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows: ano } = await cliente.query<{ estado: string }>(
        `select estado::text as estado from anos_escolares where id = $1`,
        [datos.anoEscolarId],
      );
      if (!ano[0]) throw new NotFoundException('Ese ano escolar no existe.');
      if (ano[0].estado === 'cerrado') {
        throw new BadRequestException('No se pueden crear secciones en un ano cerrado.');
      }

      const { rows } = await cliente.query<{ id: string }>(
        `insert into secciones
           (institucion_id, ano_escolar_id, grado_id, nombre, cupo, aula,
            sede_id, tutor_membresia_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning id`,
        [
          institucionDe(sesion),
          datos.anoEscolarId,
          datos.gradoId,
          datos.nombre,
          datos.cupo ?? null,
          datos.aula ?? null,
          datos.sedeId ?? null,
          datos.tutorMembresiaId ?? null,
        ],
      );

      const creados = await this.generarCursos(cliente, sesion, rows[0].id);

      await anotar(
        cliente,
        {
          accion: 'seccion.creada',
          entidad: 'secciones',
          entidadId: rows[0].id,
          datos: { nombre: datos.nombre, cursosGenerados: creados },
        },
        origen,
      );

      const { rows: secciones } = await cliente.query<Seccion>(
        `${LISTA_SECCIONES} order by g.nivel, g.orden, s.nombre`,
      );
      return { secciones, cursosGenerados: creados };
    });
  }

  async actualizar(sesion: Sesion, id: string, datos: ActualizarSeccionDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leerSeccion(cliente, id);

      const cambios = diferencias(
        {
          nombre: antes.nombre,
          cupo: antes.cupo,
          aula: antes.aula,
          sedeId: antes.sedeId,
          tutorMembresiaId: antes.tutorMembresiaId,
          activa: antes.activa,
        },
        datos as Record<string, unknown>,
      );

      if (Object.keys(cambios).length > 0) {
        await cliente.query(
          `update secciones set
              nombre = $2, cupo = $3, aula = $4, sede_id = $5,
              tutor_membresia_id = $6, activa = $7
            where id = $1`,
          [
            id,
            datos.nombre ?? antes.nombre,
            'cupo' in datos ? (datos.cupo ?? null) : antes.cupo,
            'aula' in datos ? (datos.aula ?? null) : antes.aula,
            'sedeId' in datos ? (datos.sedeId ?? null) : antes.sedeId,
            'tutorMembresiaId' in datos
              ? (datos.tutorMembresiaId ?? null)
              : antes.tutorMembresiaId,
            datos.activa ?? antes.activa,
          ],
        );

        await anotar(
          cliente,
          {
            accion: 'seccion.actualizada',
            entidad: 'secciones',
            entidadId: id,
            datos: { cambios },
          },
          origen,
        );
      }

      const { rows: secciones } = await cliente.query<Seccion>(
        `${LISTA_SECCIONES} order by g.nivel, g.orden, s.nombre`,
      );
      return { secciones };
    });
  }

  /*
    Cuando el plan del grado cambia despues de haber creado la seccion, esto
    anade los cursos que faltan. No quita nada: si una materia sale del plan
    pero el grupo lleva medio ano cursandola, con sus notas dentro, borrarla
    seria destruir el expediente. Retirar un curso es una decision explicita.
  */
  async sincronizarCursos(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const seccion = await this.leerSeccion(cliente, id);
      const creados = await this.generarCursos(cliente, sesion, id);

      if (creados > 0) {
        await anotar(
          cliente,
          {
            accion: 'seccion.cursos_sincronizados',
            entidad: 'secciones',
            entidadId: id,
            datos: { seccion: seccion.nombre, cursosGenerados: creados },
          },
          origen,
        );
      }

      const { rows: secciones } = await cliente.query<Seccion>(
        `${LISTA_SECCIONES} order by g.nivel, g.orden, s.nombre`,
      );
      return { secciones, cursosGenerados: creados };
    });
  }

  async eliminar(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const seccion = await this.leerSeccion(cliente, id);

      await cliente.query(`update secciones set eliminado_en = now() where id = $1`, [id]);
      await cliente.query(
        `update cursos set eliminado_en = now() where seccion_id = $1 and eliminado_en is null`,
        [id],
      );

      await anotar(
        cliente,
        {
          accion: 'seccion.eliminada',
          entidad: 'secciones',
          entidadId: id,
          datos: { nombre: seccion.nombre },
        },
        origen,
      );

      const { rows: secciones } = await cliente.query<Seccion>(
        `${LISTA_SECCIONES} order by g.nivel, g.orden, s.nombre`,
      );
      return { secciones };
    });
  }

  // --- Cursos ----------------------------------------------------------------

  async listarCursos(sesion: Sesion, filtros: ListarCursosDto) {
    const condiciones: string[] = [];
    const valores: unknown[] = [];

    if (filtros.anoEscolarId) {
      valores.push(filtros.anoEscolarId);
      condiciones.push(`c.ano_escolar_id = $${valores.length}`);
    }
    if (filtros.seccionId) {
      valores.push(filtros.seccionId);
      condiciones.push(`c.seccion_id = $${valores.length}`);
    }
    if (filtros.docenteMembresiaId) {
      valores.push(filtros.docenteMembresiaId);
      condiciones.push(`c.docente_membresia_id = $${valores.length}`);
    }
    if (filtros.estado === 'sin-docente') {
      condiciones.push(`c.docente_membresia_id is null`);
    } else if (filtros.estado) {
      valores.push(filtros.estado);
      condiciones.push(`c.estado = $${valores.length}::estado_curso`);
    }

    const extra = condiciones.length ? ` and ${condiciones.join(' and ')}` : '';

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Curso>(
        `${LISTA_CURSOS} ${extra} order by g.nivel, g.orden, s.nombre, a.nombre`,
        valores,
      );
      return { cursos: rows };
    });
  }

  async actualizarCurso(sesion: Sesion, id: string, datos: ActualizarCursoDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows: antes } = await cliente.query<{
        docenteMembresiaId: string | null;
        estado: string;
        asignatura: string;
      }>(
        `select c.docente_membresia_id as "docenteMembresiaId", c.estado::text as estado,
                a.nombre as asignatura
           from cursos c join asignaturas a on a.id = c.asignatura_id
          where c.id = $1 and c.eliminado_en is null
          for update of c`,
        [id],
      );
      if (!antes[0]) throw new NotFoundException('Ese curso no existe.');

      const docente =
        'docenteMembresiaId' in datos
          ? (datos.docenteMembresiaId ?? null)
          : antes[0].docenteMembresiaId;
      const estado = datos.estado ?? antes[0].estado;

      // Un curso sin docente no tiene quien publique material ni califique:
      // publicarlo solo lo haria visible para que nadie lo atienda.
      if (estado === 'publicado' && !docente) {
        throw new BadRequestException(
          'No se puede publicar un curso sin docente asignado.',
        );
      }

      const cambios = diferencias(
        { docenteMembresiaId: antes[0].docenteMembresiaId, estado: antes[0].estado },
        { docenteMembresiaId: docente, estado },
      );

      if (Object.keys(cambios).length > 0) {
        await cliente.query(
          `update cursos set docente_membresia_id = $2, estado = $3::estado_curso
            where id = $1`,
          [id, docente, estado],
        );

        await anotar(
          cliente,
          {
            accion: 'curso.actualizado',
            entidad: 'cursos',
            entidadId: id,
            datos: { asignatura: antes[0].asignatura, cambios },
          },
          origen,
        );
      }

      const { rows } = await cliente.query<Curso>(
        `${LISTA_CURSOS} and c.id = $1`,
        [id],
      );
      return { curso: rows[0] };
    });
  }

  // ---------------------------------------------------------------------------

  /*
    Inserta un curso por cada materia del plan que la seccion no tenga ya. El
    "on conflict do nothing" contra el indice unico de (seccion, asignatura) es
    lo que hace que llamarlo dos veces no duplique nada, asi que sirve igual
    para crear la seccion que para sincronizarla despues.
  */
  private async generarCursos(
    cliente: PoolClient,
    sesion: Sesion,
    seccionId: string,
  ): Promise<number> {
    const { rowCount } = await cliente.query(
      `insert into cursos (institucion_id, ano_escolar_id, seccion_id, asignatura_id)
       select $1, s.ano_escolar_id, s.id, pe.asignatura_id
         from secciones s
         join plan_estudio pe on pe.grado_id = s.grado_id
         join asignaturas a on a.id = pe.asignatura_id
                           and a.eliminado_en is null and a.activa
        where s.id = $2
          and not exists (
            select 1 from cursos c
             where c.seccion_id = s.id
               and c.asignatura_id = pe.asignatura_id
               and c.eliminado_en is null
          )`,
      [institucionDe(sesion), seccionId],
    );
    return rowCount ?? 0;
  }

  private async leerSeccion(cliente: PoolClient, id: string) {
    const { rows } = await cliente.query<{
      nombre: string;
      cupo: number | null;
      aula: string | null;
      sedeId: string | null;
      tutorMembresiaId: string | null;
      activa: boolean;
    }>(
      `select nombre, cupo, aula, sede_id as "sedeId",
              tutor_membresia_id as "tutorMembresiaId", activa
         from secciones where id = $1 and eliminado_en is null for update`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Esa seccion no existe.');
    return rows[0];
  }
}
