import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, diferencias, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type {
  ActualizarCursoDto,
  CrearCursoDto,
  HorarioDto,
  ListarCursosDto,
} from './dto/catalogo.dto';

export type Horario = {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
};

export type Curso = {
  id: string;
  codigo: string;
  nombre: string;
  resumen: string | null;
  descripcion: string | null;
  categoriaId: string | null;
  categoria: string | null;
  categoriaColor: string | null;
  instructorMembresiaId: string | null;
  instructor: string | null;
  modalidad: string;
  nivel: string | null;
  sedeId: string | null;
  sede: string | null;
  aula: string | null;
  imagenUrl: string | null;
  /* Los montos viajan como texto: numeric(12,2) tiene mas precision que el
     double de JavaScript, y es en la conversion donde 1500.00 se vuelve
     1499.99. El navegador lo formatea para mostrarlo. */
  precio: string;
  moneda: string;
  duracionHoras: string | null;
  duracionSemanas: number | null;
  iniciaEn: string | null;
  terminaEn: string | null;
  cupo: number | null;
  certificado: boolean;
  estado: string;
  inscritos: number;
  horarios: Horario[];
};

export type Instructor = {
  membresiaId: string;
  nombre: string;
  correo: string | null;
  cursos: number;
};

export type EstudianteDelCurso = {
  inscripcionId: string;
  membresiaId: string;
  matricula: string | null;
  nombre: string;
  estado: string;
  inscritoEn: string;
};

const DIAS = [
  '',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
];

/*
  La lista trae el curso entero, descripcion larga incluida, y no una version
  recortada con un segundo endpoint para el detalle.

  Es una decision de tamano, no de pereza: el catalogo de un centro son decenas
  de cursos, no millones, y traerlo completo ahorra al panel una peticion por
  cada dialogo que se abre y un estado de carga dentro del formulario. El dia
  que exista el catalogo publico -otra audiencia, otro volumen, sin sesion- ese
  si sera un endpoint aparte con solo lo que pinta una tarjeta.

  El horario se agrega aqui en vez de pedirse por separado por la misma razon:
  son tres o cuatro filas por curso y sin ellas la ficha esta incompleta.
*/
const LISTA = `
  select c.id, c.codigo, c.nombre, c.resumen, c.descripcion,
         c.categoria_id as "categoriaId", cat.nombre as categoria,
         cat.color as "categoriaColor",
         c.instructor_membresia_id as "instructorMembresiaId",
         ui.nombre_completo as instructor,
         c.modalidad::text as modalidad, c.nivel::text as nivel,
         c.sede_id as "sedeId", s.nombre as sede, c.aula,
         c.imagen_url as "imagenUrl",
         c.precio::text as precio, c.moneda,
         c.duracion_horas::text as "duracionHoras",
         c.duracion_semanas as "duracionSemanas",
         to_char(c.inicia_en, 'YYYY-MM-DD') as "iniciaEn",
         to_char(c.termina_en, 'YYYY-MM-DD') as "terminaEn",
         c.cupo, c.certificado,
         app.estado_curso_por_fechas(c.inicia_en, c.termina_en)::text as estado,
         (select count(*)::int from inscripciones i
           where i.curso_id = c.id and i.estado in ('preinscrita', 'activa')) as inscritos,
         coalesce((
           select json_agg(json_build_object(
                    'diaSemana', h.dia_semana,
                    'horaInicio', to_char(h.hora_inicio, 'HH24:MI'),
                    'horaFin', to_char(h.hora_fin, 'HH24:MI'))
                  order by h.dia_semana, h.hora_inicio)
             from curso_horarios h where h.curso_id = c.id
         ), '[]'::json) as horarios
    from cursos c
    left join categorias cat on cat.id = c.categoria_id
    left join sedes s on s.id = c.sede_id
    left join membresias mi on mi.id = c.instructor_membresia_id
    left join usuarios ui on ui.id = mi.usuario_id
   where c.eliminado_en is null
`;

const ORDEN = ` order by app.estado_curso_por_fechas(c.inicia_en, c.termina_en),
                        coalesce(c.inicia_en, '9999-12-31'::date), c.nombre`;

@Injectable()
export class CursosServicio {
  constructor(private readonly bd: BaseDatos) {}

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  async listar(
    sesion: Sesion,
    filtros: ListarCursosDto,
  ): Promise<{ cursos: Curso[] }> {
    const condiciones: string[] = [];
    const valores: unknown[] = [];

    if (filtros.categoriaId) {
      valores.push(filtros.categoriaId);
      condiciones.push(`c.categoria_id = $${valores.length}`);
    }
    if (filtros.instructorMembresiaId) {
      valores.push(filtros.instructorMembresiaId);
      condiciones.push(`c.instructor_membresia_id = $${valores.length}`);
    }
    if (filtros.estado) {
      valores.push(filtros.estado);
      condiciones.push(
        `app.estado_curso_por_fechas(c.inicia_en, c.termina_en) = $${valores.length}::estado_curso`,
      );
    }
    if (filtros.modalidad) {
      valores.push(filtros.modalidad);
      condiciones.push(`c.modalidad = $${valores.length}::modalidad_curso`);
    }
    if (filtros.busqueda) {
      valores.push(`%${filtros.busqueda}%`);
      const n = valores.length;
      condiciones.push(
        `(c.nombre ilike $${n} or c.codigo ilike $${n} or c.resumen ilike $${n})`,
      );
    }

    const donde = condiciones.length ? ` and ${condiciones.join(' and ')}` : '';

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Curso>(
        `${LISTA}${donde}${ORDEN}`,
        valores,
      );
      return { cursos: rows };
    });
  }

  /*
    Quien puede figurar como instructor. Vive aqui y no en /personas porque es
    lo que rellena un desplegable del formulario de curso, no el directorio: son
    dos preguntas distintas -"quien trabaja aqui" y "a quien puedo asignarle
    este curso"- y la segunda solo devuelve id y nombre.
  */
  async listarInstructores(
    sesion: Sesion,
  ): Promise<{ instructores: Instructor[] }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Instructor>(
        `select m.id as "membresiaId", u.nombre_completo as nombre, u.correo::text as correo,
                (select count(*)::int from cursos c
                  where c.instructor_membresia_id = m.id and c.eliminado_en is null) as cursos
           from membresias m
           join usuarios u on u.id = m.usuario_id
          where m.estado = 'activa'
            and m.eliminado_en is null
            and exists (select 1 from membresia_roles r
                         where r.membresia_id = m.id and r.rol = 'docente')
          order by u.nombre_completo`,
      );
      return { instructores: rows };
    });
  }

  async detalle(sesion: Sesion, id: string): Promise<{ curso: Curso }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Curso>(`${LISTA} and c.id = $1`, [
        id,
      ]);
      if (!rows[0]) throw new NotFoundException('Ese curso no existe.');
      return { curso: rows[0] };
    });
  }

  /*
    El portal no consume el catalogo administrativo. Comparte la forma de la
    ficha, pero limita las filas a la relacion real de quien inicio sesion:
    asignacion para docentes e inscripcion para estudiantes. Administracion
    conserva el catalogo completo cuando usa el selector de previsualizacion.
  */
  async listarPortal(sesion: Sesion): Promise<{ cursos: Curso[] }> {
    const alcance = this.alcancePortal(sesion);

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Curso>(`${LISTA}${alcance}${ORDEN}`);
      return { cursos: rows };
    });
  }

  async detallePortal(
    sesion: Sesion,
    codigo: string,
  ): Promise<{ curso: Curso; estudiantes: EstudianteDelCurso[] }> {
    const alcance = this.alcancePortal(sesion);

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Curso>(
        `${LISTA} and upper(c.codigo) = upper($1)${alcance}`,
        [codigo],
      );
      const curso = rows[0];
      if (!curso)
        throw new NotFoundException('Ese curso no esta asignado a tu portal.');

      const puedeVerGrupo = sesion.roles.some((rol) =>
        ['propietario', 'administrador', 'coordinador', 'docente'].includes(
          rol,
        ),
      );
      if (!puedeVerGrupo) return { curso, estudiantes: [] };

      const { rows: estudiantes } = await cliente.query<EstudianteDelCurso>(
        `select i.id as "inscripcionId", i.membresia_id as "membresiaId",
                m.codigo as matricula, u.nombre_completo as nombre,
                i.estado::text as estado,
                to_char(i.inscrito_en, 'YYYY-MM-DD') as "inscritoEn"
           from inscripciones i
           join membresias m on m.id = i.membresia_id
           join usuarios u on u.id = m.usuario_id
          where i.curso_id = $1
            and i.estado in ('preinscrita', 'activa', 'completada')
          order by u.nombre_completo`,
        [curso.id],
      );

      return { curso, estudiantes };
    });
  }

  // ---------------------------------------------------------------------------
  // Escritura
  // ---------------------------------------------------------------------------

  async crear(sesion: Sesion, datos: CrearCursoDto, origen: Origen) {
    const horarios = this.validarHorarios(datos.horarios ?? []);
    const terminaEn = this.calcularFechaFin(
      datos.iniciaEn,
      datos.duracionSemanas,
    );
    const duracionHoras = this.calcularHoras(horarios, datos.duracionSemanas);

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const institucionId = institucionDe(sesion);

      if (datos.instructorMembresiaId) {
        await this.comprobarInstructor(cliente, datos.instructorMembresiaId);
      }

      const { rows } = await cliente.query<{ id: string }>(
        `insert into cursos
           (institucion_id, codigo, nombre, resumen, descripcion, categoria_id,
            instructor_membresia_id, modalidad, nivel, sede_id, aula, imagen_url,
            precio, moneda, duracion_horas, duracion_semanas,
            inicia_en, termina_en, cupo, certificado, estado)
         values ($1, $2, $3, $4, $5, $6, $7, $8::modalidad_curso, $9::nivel_curso,
                 $10, $11, $12, $13::numeric, $14, $15::numeric, $16,
                 $17::date, $18::date, $19, $20,
                 app.estado_curso_por_fechas($17::date, $18::date))
         returning id`,
        [
          institucionId,
          datos.codigo,
          datos.nombre,
          datos.resumen ?? null,
          datos.descripcion ?? null,
          datos.categoriaId ?? null,
          datos.instructorMembresiaId ?? null,
          datos.modalidad ?? 'presencial',
          datos.nivel ?? null,
          datos.sedeId ?? null,
          datos.aula ?? null,
          datos.imagenUrl ?? null,
          datos.precio,
          datos.moneda ?? 'DOP',
          duracionHoras,
          datos.duracionSemanas,
          datos.iniciaEn,
          terminaEn,
          datos.cupo ?? null,
          datos.certificado ?? true,
        ],
      );
      const cursoId = rows[0].id;

      await this.reemplazarHorarios(cliente, institucionId, cursoId, horarios);

      await anotar(
        cliente,
        {
          accion: 'curso.creado',
          entidad: 'cursos',
          entidadId: cursoId,
          datos: {
            codigo: datos.codigo,
            nombre: datos.nombre,
            precio: String(datos.precio),
            iniciaEn: datos.iniciaEn,
            terminaEn,
            duracionSemanas: datos.duracionSemanas,
          },
        },
        origen,
      );

      return this.devolverLista(cliente);
    });
  }

  async actualizar(
    sesion: Sesion,
    id: string,
    datos: ActualizarCursoDto,
    origen: Origen,
  ) {
    const horarios =
      datos.horarios === undefined
        ? null
        : this.validarHorarios(datos.horarios);

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leer(cliente, id);

      const inicia =
        'iniciaEn' in datos ? (datos.iniciaEn ?? null) : antes.iniciaEn;
      const semanas =
        'duracionSemanas' in datos
          ? (datos.duracionSemanas ?? null)
          : antes.duracionSemanas;
      const horarioFinal = horarios ?? antes.horarios;
      const termina =
        inicia && semanas ? this.calcularFechaFin(inicia, semanas) : null;
      const horas = semanas ? this.calcularHoras(horarioFinal, semanas) : null;

      const instructor =
        'instructorMembresiaId' in datos
          ? (datos.instructorMembresiaId ?? null)
          : antes.instructorMembresiaId;

      if (instructor && instructor !== antes.instructorMembresiaId) {
        await this.comprobarInstructor(cliente, instructor);
      }

      const deseado: Record<string, unknown> = {
        codigo: datos.codigo ?? antes.codigo,
        nombre: datos.nombre ?? antes.nombre,
        resumen: 'resumen' in datos ? (datos.resumen ?? null) : antes.resumen,
        descripcion:
          'descripcion' in datos
            ? (datos.descripcion ?? null)
            : antes.descripcion,
        categoriaId:
          'categoriaId' in datos
            ? (datos.categoriaId ?? null)
            : antes.categoriaId,
        instructorMembresiaId: instructor,
        modalidad: datos.modalidad ?? antes.modalidad,
        nivel: 'nivel' in datos ? (datos.nivel ?? null) : antes.nivel,
        sedeId: 'sedeId' in datos ? (datos.sedeId ?? null) : antes.sedeId,
        aula: 'aula' in datos ? (datos.aula ?? null) : antes.aula,
        imagenUrl:
          'imagenUrl' in datos ? (datos.imagenUrl ?? null) : antes.imagenUrl,
        /*
          toFixed(2) y no String(): antes.precio llega de numeric(12,2) como
          "5000.00" y el formulario manda 5000. Sin normalizar, cada guardado
          registraria en la bitacora un cambio de precio que no ocurrio.
        */
        precio:
          datos.precio === undefined ? antes.precio : datos.precio.toFixed(2),
        moneda: datos.moneda ?? antes.moneda,
        duracionHoras: horas,
        duracionSemanas: semanas,
        iniciaEn: inicia,
        terminaEn: termina,
        cupo: 'cupo' in datos ? (datos.cupo ?? null) : antes.cupo,
        certificado: datos.certificado ?? antes.certificado,
      };

      /*
        El cupo no puede quedar por debajo de la gente que ya esta dentro. La
        base no lo sabe -no hay constraint que cruce dos tablas-, asi que se
        comprueba aqui.
      */
      const cupoNuevo = deseado.cupo as number | null;
      if (cupoNuevo !== null && cupoNuevo < antes.inscritos) {
        throw new BadRequestException(
          `Ya hay ${antes.inscritos} inscrito(s): el cupo no puede bajar de ahi.`,
        );
      }

      const cambios = diferencias(
        antes as unknown as Record<string, unknown>,
        deseado,
      );

      if (Object.keys(cambios).length > 0 || horarios !== null) {
        await cliente.query(
          `update cursos set
              codigo = $2, nombre = $3, resumen = $4, descripcion = $5,
              categoria_id = $6, instructor_membresia_id = $7,
              modalidad = $8::modalidad_curso, nivel = $9::nivel_curso,
              sede_id = $10, aula = $11, imagen_url = $12,
              precio = $13::numeric, moneda = $14, duracion_horas = $15::numeric,
              duracion_semanas = $16, inicia_en = $17::date, termina_en = $18::date,
              cupo = $19, certificado = $20,
              estado = app.estado_curso_por_fechas($17::date, $18::date)
            where id = $1`,
          [
            id,
            deseado.codigo,
            deseado.nombre,
            deseado.resumen,
            deseado.descripcion,
            deseado.categoriaId,
            deseado.instructorMembresiaId,
            deseado.modalidad,
            deseado.nivel,
            deseado.sedeId,
            deseado.aula,
            deseado.imagenUrl,
            deseado.precio,
            deseado.moneda,
            deseado.duracionHoras,
            deseado.duracionSemanas,
            deseado.iniciaEn,
            deseado.terminaEn,
            deseado.cupo,
            deseado.certificado,
          ],
        );
      }

      if (horarios) {
        await this.reemplazarHorarios(
          cliente,
          institucionDe(sesion),
          id,
          horarios,
        );
      }

      if (Object.keys(cambios).length > 0 || horarios) {
        await anotar(
          cliente,
          {
            accion: 'curso.actualizado',
            entidad: 'cursos',
            entidadId: id,
            datos: {
              codigo: antes.codigo,
              cambios,
              horarioReescrito: horarios !== null,
            },
          },
          origen,
        );
      }

      return this.devolverLista(cliente);
    });
  }

  /* Un curso con historial se conserva; solo se elimina el que nunca se uso. */
  async eliminar(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const curso = await this.leer(cliente, id);

      const { rows: usos } = await cliente.query<{ total: number }>(
        `select count(*)::int as total from inscripciones where curso_id = $1`,
        [id],
      );

      if (usos[0].total > 0) {
        throw new BadRequestException(
          `Ese curso tiene ${usos[0].total} inscripcion(es) en su historial y no se puede eliminar.`,
        );
      }

      await cliente.query(
        `update cursos set eliminado_en = now() where id = $1`,
        [id],
      );

      await anotar(
        cliente,
        {
          accion: 'curso.eliminado',
          entidad: 'cursos',
          entidadId: id,
          datos: { codigo: curso.codigo, nombre: curso.nombre },
        },
        origen,
      );

      return this.devolverLista(cliente);
    });
  }

  // ---------------------------------------------------------------------------
  // Piezas internas
  // ---------------------------------------------------------------------------

  private async devolverLista(
    cliente: PoolClient,
  ): Promise<{ cursos: Curso[] }> {
    const { rows } = await cliente.query<Curso>(`${LISTA}${ORDEN}`);
    return { cursos: rows };
  }

  private alcancePortal(sesion: Sesion): string {
    if (
      sesion.roles.some(
        (rol) =>
          rol === 'propietario' ||
          rol === 'administrador' ||
          rol === 'coordinador',
      )
    ) {
      return '';
    }
    if (sesion.roles.includes('docente')) {
      return ' and c.instructor_membresia_id = app.mi_membresia()';
    }
    return ` and exists (
      select 1 from inscripciones ip
       where ip.curso_id = c.id and ip.membresia_id = app.mi_membresia()
    )`;
  }

  /*
    El bloqueo va en su propia consulta y no como un "for update" pegado a
    LISTA: aquella lleva joins externos y subconsultas agregadas, y ahi el for
    update se vuelve fragil -Postgres lo rechaza en cuanto la fila bloqueada
    cae del lado nulo de un join-. Dos consultas dentro de la misma transaccion
    dan la misma garantia sin depender de la forma del select.
  */
  private async leer(cliente: PoolClient, id: string): Promise<Curso> {
    const { rowCount } = await cliente.query(
      `select 1 from cursos where id = $1 and eliminado_en is null for update`,
      [id],
    );
    if (!rowCount) throw new NotFoundException('Ese curso no existe.');

    const { rows } = await cliente.query<Curso>(`${LISTA} and c.id = $1`, [id]);
    return rows[0];
  }

  /*
    El instructor tiene que ser alguien de la institucion con rol docente. La
    clave foranea ya impide que sea de otra institucion; esto impide que sea la
    secretaria o un alumno, que la base no tiene forma de distinguir.
  */
  private async comprobarInstructor(cliente: PoolClient, membresiaId: string) {
    const { rows } = await cliente.query<{
      nombre: string;
      esDocente: boolean;
    }>(
      `select u.nombre_completo as nombre,
              exists (select 1 from membresia_roles r
                       where r.membresia_id = m.id and r.rol = 'docente') as "esDocente"
         from membresias m
         join usuarios u on u.id = m.usuario_id
        where m.id = $1 and m.estado = 'activa' and m.eliminado_en is null`,
      [membresiaId],
    );

    if (!rows[0]) {
      throw new NotFoundException(
        'Ese instructor no existe o su membresia no esta activa.',
      );
    }
    if (!rows[0].esDocente) {
      throw new BadRequestException(
        `${rows[0].nombre} no tiene el rol de instructor. Asignaselo desde Usuarios antes de ponerle un curso.`,
      );
    }
  }

  /*
    Dos bloques del mismo dia no pueden solaparse. El indice unico de la base
    solo caza el caso exacto -mismo dia, misma hora de inicio-, y "lunes de 6 a
    8" con "lunes de 7 a 9" pasaria sin que nadie lo note hasta que dos grupos
    se encuentren en el aula.
  */
  private validarHorarios(horarios: HorarioDto[]): HorarioDto[] {
    for (const bloque of horarios) {
      if (bloque.horaFin <= bloque.horaInicio) {
        throw new BadRequestException(
          `El bloque del ${DIAS[bloque.diaSemana]} termina antes de empezar.`,
        );
      }
    }

    const porDia = new Map<number, HorarioDto[]>();
    for (const bloque of horarios) {
      const delDia = porDia.get(bloque.diaSemana) ?? [];
      for (const otro of delDia) {
        if (
          bloque.horaInicio < otro.horaFin &&
          otro.horaInicio < bloque.horaFin
        ) {
          throw new BadRequestException(
            `Los bloques del ${DIAS[bloque.diaSemana]} se solapan: ` +
              `${otro.horaInicio}-${otro.horaFin} y ${bloque.horaInicio}-${bloque.horaFin}.`,
          );
        }
      }
      delDia.push(bloque);
      porDia.set(bloque.diaSemana, delDia);
    }

    return horarios;
  }

  private calcularFechaFin(inicia: string, semanas: number): string {
    const fecha = new Date(`${inicia}T00:00:00.000Z`);
    fecha.setUTCDate(fecha.getUTCDate() + semanas * 7 - 1);
    return fecha.toISOString().slice(0, 10);
  }

  private calcularHoras(
    horarios: HorarioDto[],
    semanas: number,
  ): string | null {
    if (horarios.length === 0) return null;

    const minutosSemanales = horarios.reduce((total, bloque) => {
      const [horaInicio, minutoInicio] = bloque.horaInicio
        .split(':')
        .map(Number);
      const [horaFin, minutoFin] = bloque.horaFin.split(':').map(Number);
      return (
        total + horaFin * 60 + minutoFin - (horaInicio * 60 + minutoInicio)
      );
    }, 0);

    return ((minutosSemanales * semanas) / 60).toFixed(2);
  }

  /*
    Se borra y se reinserta en vez de calcular el diferencial. Son tres o cuatro
    filas sin nada colgando de ellas, y dentro de la transaccion nadie ve el
    hueco intermedio.
  */
  private async reemplazarHorarios(
    cliente: PoolClient,
    institucionId: string,
    cursoId: string,
    horarios: HorarioDto[],
  ) {
    await cliente.query(`delete from curso_horarios where curso_id = $1`, [
      cursoId,
    ]);

    for (const bloque of horarios) {
      await cliente.query(
        `insert into curso_horarios
           (institucion_id, curso_id, dia_semana, hora_inicio, hora_fin)
         values ($1, $2, $3, $4::time, $5::time)`,
        [
          institucionId,
          cursoId,
          bloque.diaSemana,
          bloque.horaInicio,
          bloque.horaFin,
        ],
      );
    }
  }
}
