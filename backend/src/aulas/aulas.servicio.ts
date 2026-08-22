import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type {
  ActualizarSemanaDto,
  ActualizarTareaDto,
  CalificarEntregaDto,
  CalendarioTareasDto,
  CrearAulaDto,
  CrearEntregaDto,
  CrearMaterialDto,
  CrearSemanaDto,
  CrearTareaDto,
} from './dto/aulas.dto';

export type MaterialAula = {
  id: string;
  titulo: string;
  descripcion: string | null;
  archivoNombre: string;
  archivoMime: string;
  archivoTamano: number;
  publicado: boolean;
  creadoEn: string;
};

export type TareaAula = {
  id: string;
  titulo: string;
  instrucciones: string | null;
  venceEn: string | null;
  puntos: string;
  archivoNombre: string | null;
  archivoMime: string | null;
  archivoTamano: number | null;
  publicada: boolean;
  creadoEn: string;
  cantidadEntregas: number;
  entrega: EntregaAula | null;
};

export type EntregaAula = {
  id: string;
  comentario: string | null;
  archivoNombre: string | null;
  archivoMime: string | null;
  archivoTamano: number | null;
  entregadoEn: string;
  calificacion: string | null;
  retroalimentacion: string | null;
  calificadoEn: string | null;
};

export type EntregaDetalle = EntregaAula & {
  membresiaId: string;
  estudiante: string;
  matricula: string | null;
};

export type SemanaAula = {
  id: string;
  numero: number;
  titulo: string;
  descripcion: string | null;
  publicada: boolean;
  materiales: MaterialAula[];
  tareas: TareaAula[];
};

export type Aula = {
  id: string;
  cursoId: string;
  titulo: string;
  descripcion: string | null;
  publicada: boolean;
  puedeEditar: boolean;
  semanas: SemanaAula[];
};

export type TareaCalendario = {
  id: string;
  titulo: string;
  instrucciones: string | null;
  venceEn: string;
  puntos: string;
  archivoNombre: string | null;
  archivoMime: string | null;
  archivoTamano: number | null;
  semanaNumero: number;
  semanaTitulo: string;
  cursoId: string;
  cursoCodigo: string;
  cursoNombre: string;
  entrega: EntregaAula | null;
};

export type ArchivoSubido = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const MAX_ARCHIVO = 20 * 1024 * 1024;
const EXTENSIONES = new Set([
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'txt',
  'csv',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'zip',
]);

@Injectable()
export class AulasServicio {
  constructor(private readonly bd: BaseDatos) {}

  async obtener(
    sesion: Sesion,
    cursoId: string,
  ): Promise<{ aula: Aula | null }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      return { aula: await this.leerAula(cliente, cursoId) };
    });
  }

  async actualizarPortada(
    sesion: Sesion,
    cursoId: string,
    imagenUrl: string | null,
    origen: Origen,
  ): Promise<{ imagenUrl: string | null }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      await this.comprobarGestionCurso(cliente, cursoId);
      await cliente.query(`update cursos set imagen_url = $2 where id = $1`, [
        cursoId,
        imagenUrl,
      ]);
      await anotar(
        cliente,
        {
          accion: 'curso.portada_actualizada',
          entidad: 'cursos',
          entidadId: cursoId,
          datos: { tienePortada: Boolean(imagenUrl) },
        },
        origen,
      );
      return { imagenUrl };
    });
  }

  async tareasCalendario(
    sesion: Sesion,
    rango: CalendarioTareasDto,
  ): Promise<{ tareas: TareaCalendario[] }> {
    const desde = new Date(rango.desde);
    const hasta = new Date(rango.hasta);
    const dias = (hasta.getTime() - desde.getTime()) / 86_400_000;
    if (!Number.isFinite(dias) || dias <= 0 || dias > 370) {
      throw new BadRequestException(
        'El rango del calendario debe estar entre 1 y 370 dias.',
      );
    }

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<TareaCalendario>(
        `select t.id, t.titulo, t.instrucciones,
                to_char(t.vence_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "venceEn",
                t.puntos::text as puntos,
                t.archivo_nombre as "archivoNombre",
                t.archivo_mime as "archivoMime",
                t.archivo_tamano as "archivoTamano",
                s.numero as "semanaNumero", s.titulo as "semanaTitulo",
                c.id as "cursoId", c.codigo as "cursoCodigo", c.nombre as "cursoNombre",
                case when e.id is null then null else
                  jsonb_build_object(
                    'id', e.id,
                    'comentario', e.comentario,
                    'archivoNombre', e.archivo_nombre,
                    'archivoMime', e.archivo_mime,
                    'archivoTamano', e.archivo_tamano,
                    'entregadoEn', to_char(e.entregado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                    'calificacion', e.calificacion::text,
                    'retroalimentacion', e.retroalimentacion,
                    'calificadoEn', case when e.calificado_en is null then null else
                      to_char(e.calificado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end
                  )
                end as entrega
           from aula_tareas t
           join aula_semanas s on s.id = t.semana_id
           join aulas_curso a on a.id = s.aula_id
           join cursos c on c.id = t.curso_id
           left join aula_entregas e
             on e.tarea_id = t.id and e.membresia_id = app.mi_membresia()
          where a.publicada and s.publicada and t.publicada
            and t.vence_en >= $1::timestamptz
            and t.vence_en < $2::timestamptz
          order by t.vence_en, c.nombre, t.titulo`,
        [rango.desde, rango.hasta],
      );
      return { tareas: rows };
    });
  }

  async entregarTarea(
    sesion: Sesion,
    tareaId: string,
    datos: CrearEntregaDto,
    archivo: ArchivoSubido | undefined,
    origen: Origen,
  ) {
    if (archivo) this.validarArchivo(archivo);
    const comentario = datos.comentario?.trim() || null;
    if (!archivo && !comentario) {
      throw new BadRequestException(
        'Escribe un comentario o selecciona un archivo para entregar.',
      );
    }

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows: tareas } = await cliente.query<{ cursoId: string }>(
        `select t.curso_id as "cursoId"
           from aula_tareas t
           join aula_semanas s on s.id = t.semana_id
          where t.id = $1 and t.publicada and s.publicada`,
        [tareaId],
      );
      if (!tareas[0]) {
        throw new NotFoundException('Esa tarea no existe o no esta publicada.');
      }

      const { rows: existente } = await cliente.query<{
        calificacion: string | null;
      }>(
        `select calificacion::text as calificacion
           from aula_entregas
          where tarea_id = $1 and membresia_id = app.mi_membresia()`,
        [tareaId],
      );
      if (existente[0] && existente[0].calificacion !== null) {
        throw new BadRequestException(
          'La entrega ya fue calificada y no se puede reemplazar.',
        );
      }

      const nombre = archivo ? this.nombreSeguro(archivo.originalname) : null;
      const { rows } = await cliente.query<{ id: string }>(
        `insert into aula_entregas as e
           (institucion_id, curso_id, tarea_id, membresia_id, comentario,
            archivo_nombre, archivo_mime, archivo_tamano, archivo)
         values ($1, $2, $3, app.mi_membresia(), $4, $5, $6, $7, $8)
         on conflict (tarea_id, membresia_id) do update set
           comentario = excluded.comentario,
           archivo_nombre = case when $9::boolean then excluded.archivo_nombre else e.archivo_nombre end,
           archivo_mime = case when $9::boolean then excluded.archivo_mime else e.archivo_mime end,
           archivo_tamano = case when $9::boolean then excluded.archivo_tamano else e.archivo_tamano end,
           archivo = case when $9::boolean then excluded.archivo else e.archivo end,
           entregado_en = now()
         returning id`,
        [
          institucionDe(sesion),
          tareas[0].cursoId,
          tareaId,
          comentario,
          nombre,
          archivo?.mimetype || null,
          archivo?.size ?? null,
          archivo?.buffer ?? null,
          Boolean(archivo),
        ],
      );
      if (!rows[0]) {
        throw new BadRequestException('No se pudo guardar la entrega.');
      }

      await anotar(
        cliente,
        {
          accion: existente[0]
            ? 'aula.entrega_actualizada'
            : 'aula.entrega_enviada',
          entidad: 'aula_entregas',
          entidadId: rows[0].id,
          datos: { tareaId, archivo: nombre },
        },
        origen,
      );
      return { aula: await this.leerAula(cliente, tareas[0].cursoId) };
    });
  }

  async entregasTarea(sesion: Sesion, tareaId: string) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      await this.comprobarGestionTarea(cliente, tareaId);
      return this.leerEntregasTarea(cliente, tareaId);
    });
  }

  async calificarEntrega(
    sesion: Sesion,
    entregaId: string,
    datos: CalificarEntregaDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{
        tareaId: string;
        cursoId: string;
        puntos: string;
      }>(
        `select e.tarea_id as "tareaId", e.curso_id as "cursoId", t.puntos::text
           from aula_entregas e
           join aula_tareas t on t.id = e.tarea_id
          where e.id = $1`,
        [entregaId],
      );
      if (!rows[0]) throw new NotFoundException('Esa entrega no existe.');
      await this.comprobarGestionCurso(cliente, rows[0].cursoId);
      if (datos.calificacion > Number(rows[0].puntos)) {
        throw new BadRequestException(
          `La calificacion no puede superar ${Number(rows[0].puntos)} puntos.`,
        );
      }

      await cliente.query(`select app.calificar_entrega($1, $2, $3)`, [
        entregaId,
        datos.calificacion,
        datos.retroalimentacion?.trim() || null,
      ]);
      await anotar(
        cliente,
        {
          accion: 'aula.entrega_calificada',
          entidad: 'aula_entregas',
          entidadId: entregaId,
          datos: {
            tareaId: rows[0].tareaId,
            calificacion: datos.calificacion,
          },
        },
        origen,
      );
      return this.leerEntregasTarea(cliente, rows[0].tareaId);
    });
  }

  async archivoEntrega(sesion: Sesion, id: string) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{
        nombre: string | null;
        mime: string | null;
        contenido: Buffer | null;
      }>(
        `select archivo_nombre as nombre, archivo_mime as mime, archivo as contenido
           from aula_entregas where id = $1`,
        [id],
      );
      if (!rows[0]?.contenido || !rows[0].nombre) {
        throw new NotFoundException(
          'Esa entrega no tiene un archivo disponible.',
        );
      }
      return {
        nombre: rows[0].nombre,
        mime: rows[0].mime || 'application/octet-stream',
        contenido: rows[0].contenido,
      };
    });
  }

  async crear(
    sesion: Sesion,
    cursoId: string,
    datos: CrearAulaDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const curso = await this.comprobarGestionCurso(cliente, cursoId);
      const semanas = Math.max(1, Math.min(curso.duracionSemanas ?? 1, 104));

      const { rows } = await cliente.query<{ id: string }>(
        `insert into aulas_curso (institucion_id, curso_id, titulo, descripcion)
         values ($1, $2, $3, $4)
         on conflict (curso_id) do nothing
         returning id`,
        [
          institucionDe(sesion),
          cursoId,
          datos.titulo?.trim() || `Aula de ${curso.nombre}`,
          datos.descripcion?.trim() || null,
        ],
      );
      if (!rows[0])
        throw new BadRequestException('Este curso ya tiene un aula virtual.');

      await cliente.query(
        `insert into aula_semanas
           (institucion_id, curso_id, aula_id, numero, titulo)
         select $1, $2, $3, n, 'Semana ' || n
           from generate_series(1, $4::integer) n`,
        [institucionDe(sesion), cursoId, rows[0].id, semanas],
      );

      await anotar(
        cliente,
        {
          accion: 'aula.creada',
          entidad: 'aulas_curso',
          entidadId: rows[0].id,
          datos: { curso: curso.codigo, semanas },
        },
        origen,
      );

      return { aula: await this.leerAula(cliente, cursoId) };
    });
  }

  async agregarSemana(
    sesion: Sesion,
    aulaId: string,
    datos: CrearSemanaDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows: aulas } = await cliente.query<{ cursoId: string }>(
        `select curso_id as "cursoId" from aulas_curso where id = $1 for update`,
        [aulaId],
      );
      if (!aulas[0]) throw new NotFoundException('Esa aula no existe.');
      await this.comprobarGestionCurso(cliente, aulas[0].cursoId);

      const { rows: numero } = await cliente.query<{ siguiente: number }>(
        `select coalesce(max(numero), 0)::int + 1 as siguiente
           from aula_semanas where aula_id = $1`,
        [aulaId],
      );
      if (numero[0].siguiente > 104) {
        throw new BadRequestException('Un aula no puede superar 104 semanas.');
      }

      const { rows } = await cliente.query<{ id: string }>(
        `insert into aula_semanas
           (institucion_id, curso_id, aula_id, numero, titulo, descripcion)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        [
          institucionDe(sesion),
          aulas[0].cursoId,
          aulaId,
          numero[0].siguiente,
          datos.titulo?.trim() || `Semana ${numero[0].siguiente}`,
          datos.descripcion?.trim() || null,
        ],
      );
      await anotar(
        cliente,
        {
          accion: 'aula.semana_creada',
          entidad: 'aula_semanas',
          entidadId: rows[0].id,
          datos: { numero: numero[0].siguiente },
        },
        origen,
      );
      return { aula: await this.leerAula(cliente, aulas[0].cursoId) };
    });
  }

  async actualizarSemana(
    sesion: Sesion,
    semanaId: string,
    datos: ActualizarSemanaDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const semana = await this.comprobarGestionSemana(cliente, semanaId);
      await cliente.query(
        `update aula_semanas set
           titulo = coalesce($2, titulo),
           descripcion = case when $3::boolean then $4 else descripcion end,
           publicada = coalesce($5, publicada)
         where id = $1`,
        [
          semanaId,
          datos.titulo?.trim() || null,
          Object.prototype.hasOwnProperty.call(datos, 'descripcion'),
          datos.descripcion?.trim() || null,
          datos.publicada ?? null,
        ],
      );
      await anotar(
        cliente,
        {
          accion: 'aula.semana_actualizada',
          entidad: 'aula_semanas',
          entidadId: semanaId,
          datos: { campos: Object.keys(datos) },
        },
        origen,
      );
      return { aula: await this.leerAula(cliente, semana.cursoId) };
    });
  }

  async agregarMaterial(
    sesion: Sesion,
    semanaId: string,
    datos: CrearMaterialDto,
    archivo: ArchivoSubido | undefined,
    origen: Origen,
  ) {
    if (!archivo) throw new BadRequestException('Selecciona un archivo.');
    this.validarArchivo(archivo);

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const semana = await this.comprobarGestionSemana(cliente, semanaId);
      const nombre = this.nombreSeguro(archivo.originalname);
      const { rows } = await cliente.query<{ id: string }>(
        `insert into aula_materiales
           (institucion_id, curso_id, semana_id, titulo, descripcion,
            archivo_nombre, archivo_mime, archivo_tamano, archivo)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
        [
          institucionDe(sesion),
          semana.cursoId,
          semanaId,
          datos.titulo?.trim() || nombre,
          datos.descripcion?.trim() || null,
          nombre,
          archivo.mimetype || 'application/octet-stream',
          archivo.size,
          archivo.buffer,
        ],
      );
      await anotar(
        cliente,
        {
          accion: 'aula.material_subido',
          entidad: 'aula_materiales',
          entidadId: rows[0].id,
          datos: { archivo: nombre, bytes: archivo.size },
        },
        origen,
      );
      return { aula: await this.leerAula(cliente, semana.cursoId) };
    });
  }

  async eliminarMaterial(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ cursoId: string; nombre: string }>(
        `select curso_id as "cursoId", archivo_nombre as nombre
           from aula_materiales where id = $1`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('Ese material no existe.');
      await this.comprobarGestionCurso(cliente, rows[0].cursoId);
      await cliente.query(`delete from aula_materiales where id = $1`, [id]);
      await anotar(
        cliente,
        {
          accion: 'aula.material_eliminado',
          entidad: 'aula_materiales',
          entidadId: id,
          datos: { archivo: rows[0].nombre },
        },
        origen,
      );
      return { aula: await this.leerAula(cliente, rows[0].cursoId) };
    });
  }

  async archivo(sesion: Sesion, id: string) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{
        nombre: string;
        mime: string;
        contenido: Buffer;
      }>(
        `select archivo_nombre as nombre, archivo_mime as mime, archivo as contenido
           from aula_materiales where id = $1 and publicado`,
        [id],
      );
      if (!rows[0])
        throw new NotFoundException(
          'Ese archivo no existe o no esta publicado.',
        );
      return rows[0];
    });
  }

  async crearTarea(
    sesion: Sesion,
    semanaId: string,
    datos: CrearTareaDto,
    archivo: ArchivoSubido | undefined,
    origen: Origen,
  ) {
    if (archivo) this.validarArchivo(archivo);
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const semana = await this.comprobarGestionSemana(cliente, semanaId);
      const nombre = archivo ? this.nombreSeguro(archivo.originalname) : null;
      const { rows } = await cliente.query<{ id: string }>(
        `insert into aula_tareas
           (institucion_id, curso_id, semana_id, titulo, instrucciones,
            vence_en, puntos, archivo_nombre, archivo_mime, archivo_tamano,
            archivo, publicada)
         values ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10, $11, $12)
         returning id`,
        [
          institucionDe(sesion),
          semana.cursoId,
          semanaId,
          datos.titulo.trim(),
          datos.instrucciones?.trim() || null,
          datos.venceEn ?? null,
          datos.puntos,
          nombre,
          archivo?.mimetype || null,
          archivo?.size ?? null,
          archivo?.buffer ?? null,
          datos.publicada ?? true,
        ],
      );
      await anotar(
        cliente,
        {
          accion: 'aula.tarea_creada',
          entidad: 'aula_tareas',
          entidadId: rows[0].id,
          datos: {
            titulo: datos.titulo,
            venceEn: datos.venceEn ?? null,
            archivo: nombre,
          },
        },
        origen,
      );
      return { aula: await this.leerAula(cliente, semana.cursoId) };
    });
  }

  async actualizarTarea(
    sesion: Sesion,
    id: string,
    datos: ActualizarTareaDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ cursoId: string }>(
        `select curso_id as "cursoId" from aula_tareas where id = $1`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('Esa tarea no existe.');
      await this.comprobarGestionCurso(cliente, rows[0].cursoId);
      await cliente.query(
        `update aula_tareas set
           titulo = coalesce($2, titulo),
           instrucciones = case when $3::boolean then $4 else instrucciones end,
           vence_en = case when $5::boolean then $6::timestamptz else vence_en end,
           puntos = coalesce($7, puntos), publicada = coalesce($8, publicada)
         where id = $1`,
        [
          id,
          datos.titulo?.trim() || null,
          Object.prototype.hasOwnProperty.call(datos, 'instrucciones'),
          datos.instrucciones?.trim() || null,
          Object.prototype.hasOwnProperty.call(datos, 'venceEn'),
          datos.venceEn ?? null,
          datos.puntos ?? null,
          datos.publicada ?? null,
        ],
      );
      await anotar(
        cliente,
        {
          accion: 'aula.tarea_actualizada',
          entidad: 'aula_tareas',
          entidadId: id,
          datos: { campos: Object.keys(datos) },
        },
        origen,
      );
      return { aula: await this.leerAula(cliente, rows[0].cursoId) };
    });
  }

  async eliminarTarea(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ cursoId: string; titulo: string }>(
        `select curso_id as "cursoId", titulo from aula_tareas where id = $1`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('Esa tarea no existe.');
      await this.comprobarGestionCurso(cliente, rows[0].cursoId);
      await cliente.query(`delete from aula_tareas where id = $1`, [id]);
      await anotar(
        cliente,
        {
          accion: 'aula.tarea_eliminada',
          entidad: 'aula_tareas',
          entidadId: id,
          datos: { titulo: rows[0].titulo },
        },
        origen,
      );
      return { aula: await this.leerAula(cliente, rows[0].cursoId) };
    });
  }

  async archivoTarea(sesion: Sesion, id: string) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{
        nombre: string | null;
        mime: string | null;
        contenido: Buffer | null;
      }>(
        `select archivo_nombre as nombre, archivo_mime as mime, archivo as contenido
           from aula_tareas where id = $1 and publicada`,
        [id],
      );
      if (!rows[0]?.contenido || !rows[0].nombre) {
        throw new NotFoundException(
          'Esa tarea no tiene un archivo disponible.',
        );
      }
      return {
        nombre: rows[0].nombre,
        mime: rows[0].mime || 'application/octet-stream',
        contenido: rows[0].contenido,
      };
    });
  }

  private async leerAula(
    cliente: PoolClient,
    cursoId: string,
  ): Promise<Aula | null> {
    const { rows } = await cliente.query<{
      id: string;
      cursoId: string;
      titulo: string;
      descripcion: string | null;
      publicada: boolean;
      puedeEditar: boolean;
    }>(
      `select a.id, a.curso_id as "cursoId", a.titulo, a.descripcion, a.publicada,
              app.puede_gestionar_curso_aula(a.curso_id) as "puedeEditar"
         from aulas_curso a where a.curso_id = $1`,
      [cursoId],
    );
    const aula = rows[0];
    if (!aula) return null;

    const { rows: semanas } = await cliente.query<
      Omit<SemanaAula, 'materiales' | 'tareas'>
    >(
      `select id, numero, titulo, descripcion, publicada
         from aula_semanas
        where aula_id = $1 and ($2::boolean or publicada)
        order by numero`,
      [aula.id, aula.puedeEditar],
    );
    const ids = semanas.map((semana) => semana.id);
    if (ids.length === 0) return { ...aula, semanas: [] };

    const { rows: materiales } = await cliente.query<
      MaterialAula & { semanaId: string }
    >(
      `select id, semana_id as "semanaId", titulo, descripcion,
              archivo_nombre as "archivoNombre", archivo_mime as "archivoMime",
              archivo_tamano as "archivoTamano", publicado,
              to_char(creado_en, 'YYYY-MM-DD') as "creadoEn"
         from aula_materiales
        where semana_id = any($1::uuid[]) and ($2::boolean or publicado)
        order by creado_en`,
      [ids, aula.puedeEditar],
    );
    const { rows: tareas } = await cliente.query<
      Omit<TareaAula, 'cantidadEntregas' | 'entrega'> & { semanaId: string }
    >(
      `select id, semana_id as "semanaId", titulo, instrucciones,
              case when vence_en is null then null else
                to_char(vence_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end as "venceEn",
              puntos::text,
              archivo_nombre as "archivoNombre",
              archivo_mime as "archivoMime",
              archivo_tamano as "archivoTamano",
              publicada,
              to_char(creado_en, 'YYYY-MM-DD') as "creadoEn"
         from aula_tareas
        where semana_id = any($1::uuid[]) and ($2::boolean or publicada)
        order by vence_en nulls last, creado_en`,
      [ids, aula.puedeEditar],
    );
    const tareaIds = tareas.map((tarea) => tarea.id);
    const entregas = tareaIds.length
      ? (
          await cliente.query<
            EntregaAula & { tareaId: string; esPropia: boolean }
          >(
            `select id, tarea_id as "tareaId", comentario,
                    archivo_nombre as "archivoNombre", archivo_mime as "archivoMime",
                    archivo_tamano as "archivoTamano",
                    to_char(entregado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "entregadoEn",
                    calificacion::text, retroalimentacion,
                    case when calificado_en is null then null else
                      to_char(calificado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end as "calificadoEn",
                    membresia_id = app.mi_membresia() as "esPropia"
               from aula_entregas
              where tarea_id = any($1::uuid[])
              order by entregado_en`,
            [tareaIds],
          )
        ).rows
      : [];

    return {
      ...aula,
      semanas: semanas.map((semana) => ({
        ...semana,
        materiales: materiales.filter(
          (material) => material.semanaId === semana.id,
        ),
        tareas: tareas
          .filter((tarea) => tarea.semanaId === semana.id)
          .map((tarea) => {
            const deTarea = entregas.filter(
              (entrega) => entrega.tareaId === tarea.id,
            );
            return {
              ...tarea,
              cantidadEntregas: deTarea.length,
              entrega: deTarea.find((entrega) => entrega.esPropia) ?? null,
            };
          }),
      })),
    };
  }

  private async leerEntregasTarea(cliente: PoolClient, tareaId: string) {
    const { rows: tareas } = await cliente.query<{
      id: string;
      titulo: string;
      puntos: string;
    }>(`select id, titulo, puntos::text from aula_tareas where id = $1`, [
      tareaId,
    ]);
    if (!tareas[0]) throw new NotFoundException('Esa tarea no existe.');

    const { rows: entregas } = await cliente.query<EntregaDetalle>(
      `select e.id, e.membresia_id as "membresiaId",
              u.nombre_completo as estudiante, m.codigo as matricula,
              e.comentario, e.archivo_nombre as "archivoNombre",
              e.archivo_mime as "archivoMime", e.archivo_tamano as "archivoTamano",
              to_char(e.entregado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "entregadoEn",
              e.calificacion::text, e.retroalimentacion,
              case when e.calificado_en is null then null else
                to_char(e.calificado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end as "calificadoEn"
         from aula_entregas e
         join membresias m on m.id = e.membresia_id
         join usuarios u on u.id = m.usuario_id
        where e.tarea_id = $1
        order by e.entregado_en`,
      [tareaId],
    );
    return { tarea: tareas[0], entregas };
  }

  private async comprobarGestionCurso(cliente: PoolClient, cursoId: string) {
    const { rows } = await cliente.query<{
      codigo: string;
      nombre: string;
      duracionSemanas: number | null;
      puede: boolean;
    }>(
      `select codigo, nombre, duracion_semanas as "duracionSemanas",
              app.puede_gestionar_curso_aula(id) as puede
         from cursos where id = $1 and eliminado_en is null`,
      [cursoId],
    );
    if (!rows[0]) throw new NotFoundException('Ese curso no existe.');
    if (!rows[0].puede)
      throw new ForbiddenException('No puedes editar el aula de este curso.');
    return rows[0];
  }

  private async comprobarGestionSemana(cliente: PoolClient, semanaId: string) {
    const { rows } = await cliente.query<{ cursoId: string }>(
      `select curso_id as "cursoId" from aula_semanas where id = $1`,
      [semanaId],
    );
    if (!rows[0]) throw new NotFoundException('Esa semana no existe.');
    await this.comprobarGestionCurso(cliente, rows[0].cursoId);
    return rows[0];
  }

  private async comprobarGestionTarea(cliente: PoolClient, tareaId: string) {
    const { rows } = await cliente.query<{ cursoId: string }>(
      `select curso_id as "cursoId" from aula_tareas where id = $1`,
      [tareaId],
    );
    if (!rows[0]) throw new NotFoundException('Esa tarea no existe.');
    await this.comprobarGestionCurso(cliente, rows[0].cursoId);
    return rows[0];
  }

  private validarArchivo(archivo: ArchivoSubido) {
    if (archivo.size <= 0)
      throw new BadRequestException('El archivo esta vacio.');
    if (archivo.size > MAX_ARCHIVO) {
      throw new BadRequestException('El archivo supera el limite de 20 MB.');
    }
    const extension =
      archivo.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!EXTENSIONES.has(extension)) {
      throw new BadRequestException(
        'Formato no permitido. Usa PDF, Office, texto, imagen o ZIP.',
      );
    }
  }

  private nombreSeguro(nombre: string): string {
    const limpio = nombre.replace(/[\r\n\\/]/g, '_').trim();
    return (limpio || 'material').slice(0, 240);
  }
}
