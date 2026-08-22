import { randomUUID } from 'node:crypto';
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
  CalendarioEvaluacionesDto,
  CalificarRespuestaDto,
  CrearEvaluacionDto,
  GuardarRespuestasDto,
  PreguntaEvaluacionDto,
} from './dto/evaluaciones.dto';

type FilaEvaluacion = {
  id: string;
  cursoId: string;
  titulo: string;
  instrucciones: string | null;
  abreEn: string;
  cierraEn: string;
  duracionMinutos: number;
  intentosPermitidos: number;
  puntosTotal: string;
  barajarPreguntas: boolean;
  mostrarResultados: boolean;
  publicada: boolean;
  cantidadPreguntas: number;
  cantidadIntentos: number;
  intento: IntentoResumen | null;
};

type IntentoResumen = {
  id: string;
  numero: number;
  estado: 'en_progreso' | 'enviado' | 'calificado';
  iniciadoEn: string;
  expiraEn: string;
  enviadoEn: string | null;
  calificacion: string | null;
};

type FilaPregunta = {
  id: string;
  orden: number;
  tipo: TipoPregunta;
  enunciado: string;
  explicacion: string | null;
  puntos: string;
  obligatoria: boolean;
  opciones: Array<{ id: string; texto: string }>;
  respuestaCorrecta: Record<string, unknown> | null;
  respuestaId: string | null;
  respuesta: Record<string, unknown> | null;
  esCorrecta: boolean | null;
  puntosObtenidos: string | null;
  comentarioDocente: string | null;
};

type TipoPregunta =
  | 'seleccion_unica'
  | 'seleccion_multiple'
  | 'verdadero_falso'
  | 'respuesta_libre';

@Injectable()
export class EvaluacionesServicio {
  constructor(private readonly bd: BaseDatos) {}

  async listarCurso(sesion: Sesion, cursoId: string) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const puedeEditar = await this.puedeGestionar(cliente, cursoId);
      if (!puedeEditar) {
        await this.finalizarExpiradosDelEstudiante(cliente, cursoId);
      }
      const { rows } = await cliente.query<FilaEvaluacion>(
        `select e.id, e.curso_id as "cursoId", e.titulo, e.instrucciones,
                to_char(e.abre_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "abreEn",
                to_char(e.cierra_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "cierraEn",
                e.duracion_minutos as "duracionMinutos",
                e.intentos_permitidos as "intentosPermitidos",
                e.puntos_total::text as "puntosTotal",
                e.barajar_preguntas as "barajarPreguntas",
                e.mostrar_resultados as "mostrarResultados",
                e.publicada,
                (select count(*)::int from evaluacion_preguntas p where p.evaluacion_id = e.id) as "cantidadPreguntas",
                (select count(*)::int from evaluacion_intentos i where i.evaluacion_id = e.id) as "cantidadIntentos",
                (select jsonb_build_object(
                  'id', i.id, 'numero', i.numero, 'estado', i.estado,
                  'iniciadoEn', to_char(i.iniciado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                  'expiraEn', to_char(i.expira_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                  'enviadoEn', case when i.enviado_en is null then null else to_char(i.enviado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
                  'calificacion', i.calificacion::text
                ) from evaluacion_intentos i
                  where i.evaluacion_id = e.id and i.membresia_id = app.mi_membresia()
                  order by i.numero desc limit 1) as intento
           from evaluaciones e
          where e.curso_id = $1
          order by e.abre_en, e.creado_en`,
        [cursoId],
      );
      return { puedeEditar, evaluaciones: rows };
    });
  }

  async calendario(sesion: Sesion, rango: CalendarioEvaluacionesDto) {
    const desde = new Date(rango.desde);
    const hasta = new Date(rango.hasta);
    const dias = (hasta.getTime() - desde.getTime()) / 86_400_000;
    if (!Number.isFinite(dias) || dias <= 0 || dias > 370) {
      throw new BadRequestException(
        'El rango del calendario debe estar entre 1 y 370 dias.',
      );
    }
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query(
        `select e.id, e.titulo, e.instrucciones,
                to_char(e.abre_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "abreEn",
                to_char(e.cierra_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "cierraEn",
                e.duracion_minutos as "duracionMinutos", e.puntos_total::text as "puntosTotal",
                c.id as "cursoId", c.codigo as "cursoCodigo", c.nombre as "cursoNombre",
                (select jsonb_build_object('id', i.id, 'numero', i.numero, 'estado', i.estado,
                  'calificacion', i.calificacion::text, 'expiraEn', to_char(i.expira_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                   from evaluacion_intentos i
                  where i.evaluacion_id = e.id and i.membresia_id = app.mi_membresia()
                  order by i.numero desc limit 1) as intento
           from evaluaciones e
           join cursos c on c.id = e.curso_id
          where e.publicada
            and e.abre_en < $2::timestamptz
            and e.cierra_en >= $1::timestamptz
          order by e.abre_en, c.nombre, e.titulo`,
        [rango.desde, rango.hasta],
      );
      return { evaluaciones: rows };
    });
  }

  async crear(
    sesion: Sesion,
    cursoId: string,
    datos: CrearEvaluacionDto,
    origen: Origen,
  ) {
    const abre = new Date(datos.abreEn);
    const cierra = new Date(datos.cierraEn);
    if (cierra <= abre)
      throw new BadRequestException(
        'La hora de cierre debe ser posterior a la apertura.',
      );

    const preguntas = datos.preguntas.map((pregunta, indice) =>
      this.prepararPregunta(pregunta, indice + 1),
    );
    const total = preguntas.reduce(
      (suma, pregunta) => suma + pregunta.puntos,
      0,
    );

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      await this.comprobarGestion(cliente, cursoId);
      const { rows } = await cliente.query<{ id: string }>(
        `insert into evaluaciones
           (institucion_id, curso_id, titulo, instrucciones, abre_en, cierra_en,
            duracion_minutos, intentos_permitidos, puntos_total, barajar_preguntas,
            mostrar_resultados, publicada, creado_por)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, app.mi_membresia())
         returning id`,
        [
          institucionDe(sesion),
          cursoId,
          datos.titulo.trim(),
          datos.instrucciones?.trim() || null,
          datos.abreEn,
          datos.cierraEn,
          datos.duracionMinutos,
          datos.intentosPermitidos,
          total,
          datos.barajarPreguntas ?? false,
          datos.mostrarResultados ?? true,
          datos.publicada ?? false,
        ],
      );
      const evaluacionId = rows[0]?.id;
      if (!evaluacionId)
        throw new BadRequestException('No se pudo crear la evaluacion.');

      for (const pregunta of preguntas) {
        await cliente.query(
          `insert into evaluacion_preguntas
             (institucion_id, curso_id, evaluacion_id, orden, tipo, enunciado,
              explicacion, puntos, obligatoria, opciones, respuesta_correcta)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)`,
          [
            institucionDe(sesion),
            cursoId,
            evaluacionId,
            pregunta.orden,
            pregunta.tipo,
            pregunta.enunciado,
            pregunta.explicacion,
            pregunta.puntos,
            pregunta.obligatoria,
            JSON.stringify(pregunta.opciones),
            JSON.stringify(pregunta.respuestaCorrecta),
          ],
        );
      }

      await anotar(
        cliente,
        {
          accion: 'evaluacion.creada',
          entidad: 'evaluaciones',
          entidadId: evaluacionId,
          datos: {
            cursoId,
            preguntas: preguntas.length,
            puntos: total,
            publicada: datos.publicada ?? false,
          },
        },
        origen,
      );
      return this.listarCursoEnCliente(cliente, cursoId);
    });
  }

  async publicar(
    sesion: Sesion,
    id: string,
    publicada: boolean,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const evaluacion = await this.comprobarGestionEvaluacion(cliente, id);
      await cliente.query(
        `update evaluaciones set publicada = $2 where id = $1`,
        [id, publicada],
      );
      await anotar(
        cliente,
        {
          accion: publicada ? 'evaluacion.publicada' : 'evaluacion.ocultada',
          entidad: 'evaluaciones',
          entidadId: id,
          datos: { cursoId: evaluacion.cursoId },
        },
        origen,
      );
      return this.listarCursoEnCliente(cliente, evaluacion.cursoId);
    });
  }

  async eliminar(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const evaluacion = await this.comprobarGestionEvaluacion(cliente, id);
      const { rows } = await cliente.query<{ cantidad: number }>(
        `select count(*)::int as cantidad from evaluacion_intentos where evaluacion_id = $1`,
        [id],
      );
      if ((rows[0]?.cantidad ?? 0) > 0) {
        throw new BadRequestException(
          'No puedes eliminar un examen que ya tiene intentos. Ocultalo para conservar las calificaciones.',
        );
      }
      await cliente.query(`delete from evaluaciones where id = $1`, [id]);
      await anotar(
        cliente,
        {
          accion: 'evaluacion.eliminada',
          entidad: 'evaluaciones',
          entidadId: id,
          datos: { cursoId: evaluacion.cursoId },
        },
        origen,
      );
      return this.listarCursoEnCliente(cliente, evaluacion.cursoId);
    });
  }

  async iniciar(sesion: Sesion, evaluacionId: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const evaluacion = await this.leerEvaluacionDisponible(
        cliente,
        evaluacionId,
      );
      const ahora = new Date();
      if (!evaluacion.publicada)
        throw new NotFoundException('Ese examen no esta publicado.');
      if (ahora < new Date(evaluacion.abreEn))
        throw new BadRequestException('El examen todavia no esta abierto.');
      if (ahora >= new Date(evaluacion.cierraEn))
        throw new BadRequestException('La ventana de este examen ya cerro.');

      const { rows: activos } = await cliente.query<{
        id: string;
        expiraEn: string;
      }>(
        `select id, to_char(expira_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "expiraEn"
           from evaluacion_intentos
          where evaluacion_id = $1 and membresia_id = app.mi_membresia() and estado = 'en_progreso'
          order by numero desc limit 1`,
        [evaluacionId],
      );
      if (activos[0]) {
        if (new Date(activos[0].expiraEn) <= ahora)
          await this.finalizarIntento(cliente, activos[0].id);
        else return this.leerIntento(cliente, activos[0].id, false);
      }

      const { rows: conteo } = await cliente.query<{ cantidad: number }>(
        `select count(*)::int as cantidad from evaluacion_intentos
          where evaluacion_id = $1 and membresia_id = app.mi_membresia()`,
        [evaluacionId],
      );
      const numero = (conteo[0]?.cantidad ?? 0) + 1;
      if (numero > evaluacion.intentosPermitidos)
        throw new BadRequestException(
          'Ya utilizaste todos los intentos permitidos.',
        );

      const expira = new Date(
        Math.min(
          ahora.getTime() + evaluacion.duracionMinutos * 60_000,
          new Date(evaluacion.cierraEn).getTime(),
        ),
      );
      const { rows } = await cliente.query<{ id: string }>(
        `insert into evaluacion_intentos
           (institucion_id, curso_id, evaluacion_id, membresia_id, numero, expira_en)
         values ($1, $2, $3, app.mi_membresia(), $4, $5) returning id`,
        [
          institucionDe(sesion),
          evaluacion.cursoId,
          evaluacionId,
          numero,
          expira.toISOString(),
        ],
      );
      const intentoId = rows[0]?.id;
      if (!intentoId)
        throw new BadRequestException('No se pudo iniciar el intento.');
      await anotar(
        cliente,
        {
          accion: 'evaluacion.intento_iniciado',
          entidad: 'evaluacion_intentos',
          entidadId: intentoId,
          datos: { evaluacionId, numero },
        },
        origen,
      );
      return this.leerIntento(cliente, intentoId, false);
    });
  }

  async guardarRespuestas(
    sesion: Sesion,
    intentoId: string,
    datos: GuardarRespuestasDto,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const intento = await this.comprobarIntentoPropio(cliente, intentoId);
      if (intento.estado !== 'en_progreso')
        throw new BadRequestException('Este intento ya fue enviado.');
      if (new Date(intento.expiraEn) <= new Date()) {
        await this.finalizarIntento(cliente, intentoId);
        return this.leerIntento(cliente, intentoId, false);
      }
      for (const item of datos.respuestas) {
        const { rows } = await cliente.query<{
          tipo: TipoPregunta;
          opciones: Array<{ id: string }>;
        }>(
          `select tipo, opciones from evaluacion_preguntas where id = $1 and evaluacion_id = $2`,
          [item.preguntaId, intento.evaluacionId],
        );
        if (!rows[0])
          throw new BadRequestException(
            'Una de las preguntas no pertenece a este examen.',
          );
        const respuesta = this.normalizarRespuesta(
          rows[0].tipo,
          rows[0].opciones,
          item.respuesta,
        );
        await cliente.query(
          `insert into evaluacion_respuestas
             (institucion_id, curso_id, evaluacion_id, intento_id, pregunta_id, respuesta)
           values ($1, $2, $3, $4, $5, $6::jsonb)
           on conflict (intento_id, pregunta_id) do update set respuesta = excluded.respuesta,
             es_correcta = null, puntos_obtenidos = null, comentario_docente = null,
             calificado_por = null, calificado_en = null`,
          [
            institucionDe(sesion),
            intento.cursoId,
            intento.evaluacionId,
            intentoId,
            item.preguntaId,
            JSON.stringify(respuesta),
          ],
        );
      }
      return this.leerIntento(cliente, intentoId, false);
    });
  }

  async enviar(sesion: Sesion, intentoId: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const intento = await this.comprobarIntentoPropio(cliente, intentoId);
      if (intento.estado === 'en_progreso') {
        await this.finalizarIntento(cliente, intentoId);
        await anotar(
          cliente,
          {
            accion: 'evaluacion.intento_enviado',
            entidad: 'evaluacion_intentos',
            entidadId: intentoId,
            datos: { evaluacionId: intento.evaluacionId },
          },
          origen,
        );
      }
      return this.leerIntento(cliente, intentoId, false);
    });
  }

  async intentos(sesion: Sesion, evaluacionId: string) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const evaluacion = await this.comprobarGestionEvaluacion(
        cliente,
        evaluacionId,
      );
      const { rows: expirados } = await cliente.query<{ id: string }>(
        `select id from evaluacion_intentos
          where evaluacion_id = $1 and estado = 'en_progreso' and expira_en <= now()`,
        [evaluacionId],
      );
      for (const intento of expirados) {
        await this.finalizarIntento(cliente, intento.id);
      }
      const { rows } = await cliente.query(
        `select i.id, i.numero, i.estado,
                u.nombre_completo as estudiante,
                m.codigo as matricula,
                to_char(i.iniciado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "iniciadoEn",
                case when i.enviado_en is null then null else to_char(i.enviado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end as "enviadoEn",
                i.calificacion::text as calificacion
           from evaluacion_intentos i
           join membresias m on m.id = i.membresia_id
           join usuarios u on u.id = m.usuario_id
          where i.evaluacion_id = $1
          order by i.enviado_en desc nulls first, estudiante, i.numero desc`,
        [evaluacionId],
      );
      return {
        evaluacion: {
          id: evaluacionId,
          titulo: evaluacion.titulo,
          puntosTotal: evaluacion.puntosTotal,
        },
        intentos: rows,
      };
    });
  }

  async detalleIntento(sesion: Sesion, intentoId: string) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ cursoId: string }>(
        `select curso_id as "cursoId" from evaluacion_intentos where id = $1`,
        [intentoId],
      );
      if (!rows[0]) throw new NotFoundException('Ese intento no existe.');
      await this.comprobarGestion(cliente, rows[0].cursoId);
      return this.leerIntento(cliente, intentoId, true);
    });
  }

  async resultadoPropio(sesion: Sesion, intentoId: string) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const intento = await this.comprobarIntentoPropio(cliente, intentoId);
      if (
        intento.estado === 'en_progreso' &&
        new Date(intento.expiraEn) <= new Date()
      ) {
        await this.finalizarIntento(cliente, intentoId);
      } else if (intento.estado === 'en_progreso') {
        throw new BadRequestException(
          'El intento sigue activo. Continualo desde el examen.',
        );
      }
      return this.leerIntento(cliente, intentoId, false);
    });
  }

  async calificarRespuesta(
    sesion: Sesion,
    respuestaId: string,
    datos: CalificarRespuestaDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{
        intentoId: string;
        cursoId: string;
        tipo: TipoPregunta;
        maximo: string;
      }>(
        `select r.intento_id as "intentoId", r.curso_id as "cursoId", p.tipo, p.puntos::text as maximo
           from evaluacion_respuestas r join evaluacion_preguntas p on p.id = r.pregunta_id
          where r.id = $1`,
        [respuestaId],
      );
      const fila = rows[0];
      if (!fila) throw new NotFoundException('Esa respuesta no existe.');
      await this.comprobarGestion(cliente, fila.cursoId);
      if (fila.tipo !== 'respuesta_libre')
        throw new BadRequestException(
          'Las preguntas objetivas se califican automaticamente.',
        );
      if (datos.puntos > Number(fila.maximo))
        throw new BadRequestException(
          `La puntuacion no puede superar ${Number(fila.maximo)}.`,
        );
      await cliente.query(
        `update evaluacion_respuestas set puntos_obtenidos = $2, comentario_docente = $3,
           calificado_por = app.mi_membresia(), calificado_en = now() where id = $1`,
        [respuestaId, datos.puntos, datos.comentario?.trim() || null],
      );
      await this.recalcularIntento(cliente, fila.intentoId);
      await anotar(
        cliente,
        {
          accion: 'evaluacion.respuesta_calificada',
          entidad: 'evaluacion_respuestas',
          entidadId: respuestaId,
          datos: { puntos: datos.puntos },
        },
        origen,
      );
      return this.leerIntento(cliente, fila.intentoId, true);
    });
  }

  private prepararPregunta(datos: PreguntaEvaluacionDto, orden: number) {
    const tipo = datos.tipo;
    let opciones: Array<{ id: string; texto: string }> = [];
    let respuestaCorrecta: Record<string, unknown> | null = null;
    if (tipo === 'seleccion_unica' || tipo === 'seleccion_multiple') {
      const recibidas = (datos.opciones ?? []).map((opcion) => ({
        ...opcion,
        texto: opcion.texto.trim(),
      }));
      if (recibidas.length < 2 || recibidas.some((opcion) => !opcion.texto)) {
        throw new BadRequestException(
          `La pregunta ${orden} necesita al menos dos opciones.`,
        );
      }
      const conId = recibidas.map((opcion) => ({
        ...opcion,
        id: randomUUID(),
      }));
      const correctas = conId
        .filter((opcion) => opcion.correcta)
        .map((opcion) => opcion.id);
      if (
        (tipo === 'seleccion_unica' && correctas.length !== 1) ||
        (tipo === 'seleccion_multiple' && correctas.length < 1)
      ) {
        throw new BadRequestException(
          `Revisa las respuestas correctas de la pregunta ${orden}.`,
        );
      }
      opciones = conId.map(({ id, texto }) => ({ id, texto }));
      respuestaCorrecta = { opciones: correctas };
    } else if (tipo === 'verdadero_falso') {
      if (typeof datos.respuestaVerdadera !== 'boolean')
        throw new BadRequestException(
          `Indica si la pregunta ${orden} es verdadera o falsa.`,
        );
      respuestaCorrecta = { valor: datos.respuestaVerdadera };
    }
    return {
      orden,
      tipo,
      enunciado: datos.enunciado.trim(),
      explicacion: datos.explicacion?.trim() || null,
      puntos: datos.puntos,
      obligatoria: datos.obligatoria ?? true,
      opciones,
      respuestaCorrecta,
    };
  }

  private normalizarRespuesta(
    tipo: TipoPregunta,
    opciones: Array<{ id: string }>,
    respuesta: Record<string, unknown>,
  ) {
    if (tipo === 'respuesta_libre') {
      const texto =
        typeof respuesta.texto === 'string'
          ? respuesta.texto.trim().slice(0, 20000)
          : '';
      return { texto };
    }
    if (tipo === 'verdadero_falso') {
      if (typeof respuesta.valor !== 'boolean') return {};
      return { valor: respuesta.valor };
    }
    const permitidas = new Set(opciones.map((opcion) => opcion.id));
    const elegidas = Array.isArray(respuesta.opciones)
      ? [
          ...new Set(
            respuesta.opciones.filter(
              (id): id is string =>
                typeof id === 'string' && permitidas.has(id),
            ),
          ),
        ]
      : [];
    return {
      opciones: tipo === 'seleccion_unica' ? elegidas.slice(0, 1) : elegidas,
    };
  }

  private async finalizarIntento(cliente: PoolClient, intentoId: string) {
    const { rows } = await cliente.query<{
      preguntaId: string;
      tipo: TipoPregunta;
      puntos: string;
      correcta: Record<string, unknown> | null;
      respuestaId: string | null;
      respuesta: Record<string, unknown> | null;
    }>(
      `select p.id as "preguntaId", p.tipo, p.puntos::text, p.respuesta_correcta as correcta,
              r.id as "respuestaId", r.respuesta
         from evaluacion_intentos i
         join evaluacion_preguntas p on p.evaluacion_id = i.evaluacion_id
         left join evaluacion_respuestas r on r.intento_id = i.id and r.pregunta_id = p.id
        where i.id = $1 order by p.orden`,
      [intentoId],
    );
    let pendiente = false;
    for (const fila of rows) {
      const respuesta = fila.respuesta ?? {};
      let puntos: number | null = null;
      let correcta: boolean | null = null;
      if (fila.tipo === 'respuesta_libre') {
        const texto =
          typeof respuesta.texto === 'string' ? respuesta.texto.trim() : '';
        if (texto) pendiente = true;
        else puntos = 0;
      } else {
        correcta = this.esRespuestaCorrecta(
          fila.tipo,
          respuesta,
          fila.correcta ?? {},
        );
        puntos = correcta ? Number(fila.puntos) : 0;
      }
      await cliente.query(
        `insert into evaluacion_respuestas
           (institucion_id, curso_id, evaluacion_id, intento_id, pregunta_id, respuesta, es_correcta, puntos_obtenidos)
         select institucion_id, curso_id, evaluacion_id, id, $2, $3::jsonb, $4, $5
           from evaluacion_intentos where id = $1
         on conflict (intento_id, pregunta_id) do update set
           es_correcta = excluded.es_correcta, puntos_obtenidos = excluded.puntos_obtenidos`,
        [
          intentoId,
          fila.preguntaId,
          JSON.stringify(respuesta),
          correcta,
          puntos,
        ],
      );
    }
    const { rows: suma } = await cliente.query<{ total: string }>(
      `select coalesce(sum(puntos_obtenidos), 0)::text as total from evaluacion_respuestas where intento_id = $1`,
      [intentoId],
    );
    await cliente.query(
      `update evaluacion_intentos set estado = $2, enviado_en = coalesce(enviado_en, now()),
         calificacion = $3, calificado_en = case when $2 = 'calificado' then now() else null end
       where id = $1`,
      [
        intentoId,
        pendiente ? 'enviado' : 'calificado',
        pendiente ? null : Number(suma[0]?.total ?? 0),
      ],
    );
  }

  private async finalizarExpiradosDelEstudiante(
    cliente: PoolClient,
    cursoId: string,
  ) {
    const { rows } = await cliente.query<{ id: string }>(
      `select id from evaluacion_intentos
        where curso_id = $1 and membresia_id = app.mi_membresia()
          and estado = 'en_progreso' and expira_en <= now()`,
      [cursoId],
    );
    for (const intento of rows) {
      await this.finalizarIntento(cliente, intento.id);
    }
  }

  private esRespuestaCorrecta(
    tipo: TipoPregunta,
    respuesta: Record<string, unknown>,
    correcta: Record<string, unknown>,
  ) {
    if (tipo === 'verdadero_falso') return respuesta.valor === correcta.valor;
    const a = Array.isArray(respuesta.opciones)
      ? respuesta.opciones
          .filter((v): v is string => typeof v === 'string')
          .sort()
      : [];
    const b = Array.isArray(correcta.opciones)
      ? correcta.opciones
          .filter((v): v is string => typeof v === 'string')
          .sort()
      : [];
    return (
      a.length === b.length && a.every((valor, indice) => valor === b[indice])
    );
  }

  private async recalcularIntento(cliente: PoolClient, intentoId: string) {
    const { rows } = await cliente.query<{ pendientes: number; total: string }>(
      `select count(*) filter (where p.tipo = 'respuesta_libre' and r.puntos_obtenidos is null)::int as pendientes,
              coalesce(sum(r.puntos_obtenidos), 0)::text as total
         from evaluacion_respuestas r join evaluacion_preguntas p on p.id = r.pregunta_id
        where r.intento_id = $1`,
      [intentoId],
    );
    const completa = (rows[0]?.pendientes ?? 0) === 0;
    await cliente.query(
      `update evaluacion_intentos set estado = $2, calificacion = $3,
         calificado_por = case when $2 = 'calificado' then app.mi_membresia() else null end,
         calificado_en = case when $2 = 'calificado' then now() else null end where id = $1`,
      [
        intentoId,
        completa ? 'calificado' : 'enviado',
        completa ? Number(rows[0]?.total ?? 0) : null,
      ],
    );
  }

  private async leerIntento(
    cliente: PoolClient,
    intentoId: string,
    comoDocente: boolean,
  ) {
    const { rows } = await cliente.query<{
      id: string;
      evaluacionId: string;
      cursoId: string;
      numero: number;
      estado: IntentoResumen['estado'];
      iniciadoEn: string;
      expiraEn: string;
      enviadoEn: string | null;
      calificacion: string | null;
      titulo: string;
      instrucciones: string | null;
      puntosTotal: string;
      mostrarResultados: boolean;
      barajarPreguntas: boolean;
    }>(
      `select i.id, i.evaluacion_id as "evaluacionId", i.curso_id as "cursoId", i.numero, i.estado,
              to_char(i.iniciado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "iniciadoEn",
              to_char(i.expira_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "expiraEn",
              case when i.enviado_en is null then null else to_char(i.enviado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end as "enviadoEn",
              i.calificacion::text as calificacion, e.titulo, e.instrucciones,
              e.puntos_total::text as "puntosTotal", e.mostrar_resultados as "mostrarResultados",
              e.barajar_preguntas as "barajarPreguntas"
         from evaluacion_intentos i join evaluaciones e on e.id = i.evaluacion_id where i.id = $1`,
      [intentoId],
    );
    const intento = rows[0];
    if (!intento) throw new NotFoundException('Ese intento no existe.');
    const { rows: preguntas } = await cliente.query<FilaPregunta>(
      `select p.id, p.orden, p.tipo, p.enunciado, p.explicacion, p.puntos::text, p.obligatoria,
              p.opciones, p.respuesta_correcta as "respuestaCorrecta", r.id as "respuestaId",
              r.respuesta, r.es_correcta as "esCorrecta", r.puntos_obtenidos::text as "puntosObtenidos",
              r.comentario_docente as "comentarioDocente"
         from evaluacion_preguntas p
         left join evaluacion_respuestas r on r.pregunta_id = p.id and r.intento_id = $1
        where p.evaluacion_id = $2 order by p.orden`,
      [intentoId, intento.evaluacionId],
    );
    const mostrarCorreccion =
      comoDocente ||
      (intento.estado === 'calificado' && intento.mostrarResultados);
    const visibles = preguntas.map((pregunta) => ({
      id: pregunta.id,
      orden: pregunta.orden,
      tipo: pregunta.tipo,
      enunciado: pregunta.enunciado,
      puntos: pregunta.puntos,
      obligatoria: pregunta.obligatoria,
      opciones: pregunta.opciones,
      respuestaId: pregunta.respuestaId,
      respuesta: pregunta.respuesta ?? {},
      ...(intento.estado !== 'en_progreso'
        ? {
            esCorrecta: pregunta.esCorrecta,
            puntosObtenidos: pregunta.puntosObtenidos,
            comentarioDocente: pregunta.comentarioDocente,
          }
        : {}),
      ...(mostrarCorreccion
        ? {
            respuestaCorrecta: pregunta.respuestaCorrecta,
            explicacion: pregunta.explicacion,
          }
        : {}),
    }));
    if (intento.barajarPreguntas)
      visibles.sort(
        (a, b) =>
          this.ordenDeterminista(intentoId, a.id) -
          this.ordenDeterminista(intentoId, b.id),
      );
    return { intento: { ...intento, preguntas: visibles } };
  }

  private ordenDeterminista(intentoId: string, preguntaId: string) {
    const texto = intentoId + preguntaId;
    let valor = 0;
    for (let i = 0; i < texto.length; i += 1)
      valor = (valor * 31 + texto.charCodeAt(i)) | 0;
    return valor;
  }

  private async leerEvaluacionDisponible(cliente: PoolClient, id: string) {
    const { rows } = await cliente.query<{
      id: string;
      cursoId: string;
      titulo: string;
      abreEn: string;
      cierraEn: string;
      duracionMinutos: number;
      intentosPermitidos: number;
      publicada: boolean;
      puntosTotal: string;
    }>(
      `select id, curso_id as "cursoId", titulo,
              to_char(abre_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "abreEn",
              to_char(cierra_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "cierraEn",
              duracion_minutos as "duracionMinutos", intentos_permitidos as "intentosPermitidos",
              publicada, puntos_total::text as "puntosTotal" from evaluaciones where id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Ese examen no existe.');
    return rows[0];
  }

  private async comprobarIntentoPropio(cliente: PoolClient, id: string) {
    const { rows } = await cliente.query<{
      id: string;
      evaluacionId: string;
      cursoId: string;
      estado: IntentoResumen['estado'];
      expiraEn: string;
    }>(
      `select id, evaluacion_id as "evaluacionId", curso_id as "cursoId", estado,
              to_char(expira_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "expiraEn"
         from evaluacion_intentos where id = $1 and membresia_id = app.mi_membresia()`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Ese intento no existe.');
    return rows[0];
  }

  private async comprobarGestionEvaluacion(cliente: PoolClient, id: string) {
    const { rows } = await cliente.query<{
      cursoId: string;
      titulo: string;
      puntosTotal: string;
    }>(
      `select curso_id as "cursoId", titulo, puntos_total::text as "puntosTotal" from evaluaciones where id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Ese examen no existe.');
    await this.comprobarGestion(cliente, rows[0].cursoId);
    return rows[0];
  }

  private async puedeGestionar(cliente: PoolClient, cursoId: string) {
    const { rows } = await cliente.query<{ puede: boolean }>(
      `select app.puede_gestionar_curso_aula($1) as puede`,
      [cursoId],
    );
    return rows[0]?.puede ?? false;
  }

  private async comprobarGestion(cliente: PoolClient, cursoId: string) {
    if (!(await this.puedeGestionar(cliente, cursoId)))
      throw new ForbiddenException(
        'No puedes gestionar evaluaciones en este curso.',
      );
  }

  private async listarCursoEnCliente(cliente: PoolClient, cursoId: string) {
    const puedeEditar = await this.puedeGestionar(cliente, cursoId);
    const { rows } = await cliente.query<FilaEvaluacion>(
      `select e.id, e.curso_id as "cursoId", e.titulo, e.instrucciones,
              to_char(e.abre_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "abreEn",
              to_char(e.cierra_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "cierraEn",
              e.duracion_minutos as "duracionMinutos", e.intentos_permitidos as "intentosPermitidos",
              e.puntos_total::text as "puntosTotal", e.barajar_preguntas as "barajarPreguntas",
              e.mostrar_resultados as "mostrarResultados", e.publicada,
              (select count(*)::int from evaluacion_preguntas p where p.evaluacion_id = e.id) as "cantidadPreguntas",
              (select count(*)::int from evaluacion_intentos i where i.evaluacion_id = e.id) as "cantidadIntentos",
              null::jsonb as intento
         from evaluaciones e where e.curso_id = $1 order by e.abre_en, e.creado_en`,
      [cursoId],
    );
    return { puedeEditar, evaluaciones: rows };
  }
}
