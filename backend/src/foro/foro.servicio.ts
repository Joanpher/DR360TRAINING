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
  ActualizarMensajeDto,
  ActualizarTemaDto,
  CrearMensajeDto,
  CrearTemaDto,
} from './dto/foro.dto';

export type Tema = {
  id: string;
  cursoId: string;
  titulo: string;
  cuerpo: string;
  fijado: boolean;
  cerrado: boolean;
  autor: string;
  autorMembresiaId: string;
  esMio: boolean;
  creadoEn: string;
  editadoEn: string | null;
  respuestas: number;
  ultimaActividadEn: string;
  ultimoAutor: string | null;
};

export type Mensaje = {
  id: string;
  temaId: string;
  cuerpo: string;
  autor: string;
  autorMembresiaId: string;
  esMio: boolean;
  esDocente: boolean;
  creadoEn: string;
  editadoEn: string | null;
};

/*
  Un timestamptz que el navegador pueda pasar por new Date() sin sorpresas.
  Devuelve solo la expresion, sin alias, para poder anidarla dentro de un case.
*/
const utc = (columna: string) =>
  `to_char(${columna} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

/* La misma conversion cuando la columna puede venir nula. */
const utcOpcional = (columna: string) =>
  `case when ${columna} is null then null else ${utc(columna)} end`;

/*
  La lista de temas y el detalle devuelven la misma forma para que el frontend
  tenga un solo tipo. respuestas y ultimaActividadEn salen de dos laterales en
  vez de columnas guardadas: ver la cabecera de la migracion 0016.
*/
const SELECT_TEMA = `
  select t.id, t.curso_id as "cursoId", t.titulo, t.cuerpo, t.fijado, t.cerrado,
         u.nombre_completo as autor,
         t.autor_membresia_id as "autorMembresiaId",
         (t.autor_membresia_id = app.mi_membresia()) as "esMio",
         ${utc('t.creado_en')} as "creadoEn",
         ${utcOpcional('t.editado_en')} as "editadoEn",
         coalesce(r.respuestas, 0) as respuestas,
         ${utc('coalesce(r.ultima, t.creado_en)')} as "ultimaActividadEn",
         ult.nombre as "ultimoAutor"
    from foro_temas t
    join membresias ma on ma.id = t.autor_membresia_id
    join usuarios u on u.id = ma.usuario_id
    left join lateral (
      select count(*)::int as respuestas, max(m.creado_en) as ultima
        from foro_mensajes m
       where m.tema_id = t.id
    ) r on true
    left join lateral (
      select u2.nombre_completo as nombre
        from foro_mensajes m2
        join membresias mb2 on mb2.id = m2.autor_membresia_id
        join usuarios u2 on u2.id = mb2.usuario_id
       where m2.tema_id = t.id
       order by m2.creado_en desc
       limit 1
    ) ult on true
`;

@Injectable()
export class ForoServicio {
  constructor(private readonly bd: BaseDatos) {}

  // -------------------------------------------------------------------------
  // Lectura
  // -------------------------------------------------------------------------
  async listar(
    sesion: Sesion,
    cursoId: string,
  ): Promise<{ temas: Tema[]; puedeModerar: boolean }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      await this.comprobarCurso(cliente, cursoId);

      const { rows: temas } = await cliente.query<Tema>(
        `${SELECT_TEMA}
          where t.curso_id = $1
          order by t.fijado desc, coalesce(r.ultima, t.creado_en) desc`,
        [cursoId],
      );

      return { temas, puedeModerar: await this.puedeModerar(cliente, cursoId) };
    });
  }

  async detalle(
    sesion: Sesion,
    temaId: string,
  ): Promise<{ tema: Tema; mensajes: Mensaje[]; puedeModerar: boolean }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const tema = await this.leerTema(cliente, temaId);

      /*
        esDocente marca las respuestas de quien imparte el curso. No es adorno:
        en un hilo de treinta mensajes, la respuesta que zanja la duda es la
        suya, y sin la marca hay que reconocerla por el nombre.
      */
      const { rows: mensajes } = await cliente.query<Mensaje>(
        `select m.id, m.tema_id as "temaId", m.cuerpo,
                u.nombre_completo as autor,
                m.autor_membresia_id as "autorMembresiaId",
                (m.autor_membresia_id = app.mi_membresia()) as "esMio",
                (c.instructor_membresia_id = m.autor_membresia_id) as "esDocente",
                ${utc('m.creado_en')} as "creadoEn",
                ${utcOpcional('m.editado_en')} as "editadoEn"
           from foro_mensajes m
           join membresias mb on mb.id = m.autor_membresia_id
           join usuarios u on u.id = mb.usuario_id
           join cursos c on c.id = m.curso_id
          where m.tema_id = $1
          order by m.creado_en`,
        [temaId],
      );

      return {
        tema,
        mensajes,
        puedeModerar: await this.puedeModerar(cliente, tema.cursoId),
      };
    });
  }

  // -------------------------------------------------------------------------
  // Escritura
  // -------------------------------------------------------------------------
  /*
    El insert lleva returning y aqui si es seguro: la politica de select del
    foro es puede_ver_curso_aula, que quien acaba de escribir cumple por
    definicion. Es lo contrario del alta de usuarios, donde el returning falla
    porque la persona recien creada todavia no comparte institucion con nadie.
  */
  async crearTema(
    sesion: Sesion,
    cursoId: string,
    datos: CrearTemaDto,
    origen: Origen,
  ): Promise<{ tema: Tema }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      await this.comprobarCurso(cliente, cursoId);
      await this.comprobarMembresia(cliente);

      const { rows } = await cliente.query<{ id: string }>(
        `insert into foro_temas
           (institucion_id, curso_id, titulo, cuerpo, autor_membresia_id)
         values ($1, $2, $3, $4, app.mi_membresia())
         returning id`,
        [institucionDe(sesion), cursoId, datos.titulo, datos.cuerpo],
      );

      await anotar(
        cliente,
        {
          accion: 'foro.tema_abierto',
          entidad: 'foro_temas',
          entidadId: rows[0].id,
          datos: { cursoId, titulo: datos.titulo },
        },
        origen,
      );

      return { tema: await this.leerTema(cliente, rows[0].id) };
    });
  }

  async responder(
    sesion: Sesion,
    temaId: string,
    datos: CrearMensajeDto,
  ): Promise<{ mensaje: Mensaje }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const tema = await this.leerTema(cliente, temaId);
      await this.comprobarMembresia(cliente);

      /*
        La regla del tema cerrado se comprueba aqui y no en una politica: es
        una decision de moderacion, no un limite de acceso, y merece un mensaje
        que explique por que no se puede responder. Quien modera sigue pudiendo
        escribir, que es justo lo que hace falta para cerrar un hilo con una
        ultima aclaracion.
      */
      if (tema.cerrado && !(await this.puedeModerar(cliente, tema.cursoId))) {
        throw new BadRequestException(
          'Este tema esta cerrado: se puede leer, pero ya no admite respuestas.',
        );
      }

      const { rows } = await cliente.query<{ id: string }>(
        `insert into foro_mensajes
           (institucion_id, curso_id, tema_id, cuerpo, autor_membresia_id)
         values ($1, $2, $3, $4, app.mi_membresia())
         returning id`,
        [institucionDe(sesion), tema.cursoId, temaId, datos.cuerpo],
      );

      /*
        Sin anotar en la bitacora. Una respuesta de foro es contenido, no un
        cambio administrativo: registrar cada una llenaria la bitacora de ruido
        y taparia lo que de verdad hay que poder auditar. Lo que si se anota es
        la moderacion y el borrado, mas abajo.
      */
      return { mensaje: await this.leerMensaje(cliente, rows[0].id) };
    });
  }

  async actualizarTema(
    sesion: Sesion,
    temaId: string,
    datos: ActualizarTemaDto,
    origen: Origen,
  ): Promise<{ tema: Tema }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const tema = await this.leerTema(cliente, temaId);
      const modera = await this.puedeModerar(cliente, tema.cursoId);

      const tocaContenido = datos.titulo !== undefined || datos.cuerpo !== undefined;
      const tocaModeracion = datos.fijado !== undefined || datos.cerrado !== undefined;

      if (tocaContenido && !tema.esMio && !modera) {
        throw new ForbiddenException('Solo quien escribio el tema puede editarlo.');
      }
      if (tocaModeracion && !modera) {
        throw new ForbiddenException(
          'Fijar o cerrar un tema es cosa de quien imparte el curso.',
        );
      }
      if (!tocaContenido && !tocaModeracion) {
        throw new BadRequestException('No hay nada que cambiar.');
      }

      const { rows } = await cliente.query<{ id: string }>(
        `update foro_temas
            set titulo     = coalesce($2, titulo),
                cuerpo     = coalesce($3, cuerpo),
                fijado     = coalesce($4, fijado),
                cerrado    = coalesce($5, cerrado),
                editado_en = case when $6 then now() else editado_en end
          where id = $1
          returning id`,
        [
          temaId,
          datos.titulo ?? null,
          datos.cuerpo ?? null,
          datos.fijado ?? null,
          datos.cerrado ?? null,
          tocaContenido,
        ],
      );
      if (!rows[0]) {
        throw new ForbiddenException('No puedes modificar este tema.');
      }

      if (tocaModeracion) {
        await anotar(
          cliente,
          {
            accion: 'foro.tema_moderado',
            entidad: 'foro_temas',
            entidadId: temaId,
            datos: { fijado: datos.fijado, cerrado: datos.cerrado },
          },
          origen,
        );
      }

      return { tema: await this.leerTema(cliente, temaId) };
    });
  }

  async actualizarMensaje(
    sesion: Sesion,
    mensajeId: string,
    datos: ActualizarMensajeDto,
  ): Promise<{ mensaje: Mensaje }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const mensaje = await this.leerMensaje(cliente, mensajeId);
      if (!mensaje.esMio) {
        throw new ForbiddenException('Solo se puede editar el mensaje propio.');
      }

      await cliente.query(
        `update foro_mensajes set cuerpo = $2, editado_en = now() where id = $1`,
        [mensajeId, datos.cuerpo],
      );

      return { mensaje: await this.leerMensaje(cliente, mensajeId) };
    });
  }

  async eliminarTema(
    sesion: Sesion,
    temaId: string,
    origen: Origen,
  ): Promise<void> {
    await this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const tema = await this.leerTema(cliente, temaId);
      const modera = await this.puedeModerar(cliente, tema.cursoId);
      if (!tema.esMio && !modera) {
        throw new ForbiddenException('No puedes borrar este tema.');
      }

      /*
        Se anota antes de borrar: despues del delete la fila ya no existe y el
        evento se quedaria sin de que hablar. Los mensajes se van en cascada,
        asi que el conteo va en el evento.
      */
      await anotar(
        cliente,
        {
          accion: 'foro.tema_borrado',
          entidad: 'foro_temas',
          entidadId: temaId,
          datos: {
            titulo: tema.titulo,
            respuestas: tema.respuestas,
            propio: tema.esMio,
          },
        },
        origen,
      );

      const { rowCount } = await cliente.query(
        `delete from foro_temas where id = $1`,
        [temaId],
      );
      if (!rowCount) throw new ForbiddenException('No puedes borrar este tema.');
    });
  }

  async eliminarMensaje(
    sesion: Sesion,
    mensajeId: string,
    origen: Origen,
  ): Promise<void> {
    await this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const mensaje = await this.leerMensaje(cliente, mensajeId);
      const modera = await this.puedeModerar(cliente, mensaje.cursoId);
      if (!mensaje.esMio && !modera) {
        throw new ForbiddenException('No puedes borrar este mensaje.');
      }

      await anotar(
        cliente,
        {
          accion: 'foro.mensaje_borrado',
          entidad: 'foro_mensajes',
          entidadId: mensajeId,
          datos: { temaId: mensaje.temaId, propio: mensaje.esMio },
        },
        origen,
      );

      const { rowCount } = await cliente.query(
        `delete from foro_mensajes where id = $1`,
        [mensajeId],
      );
      if (!rowCount) {
        throw new ForbiddenException('No puedes borrar este mensaje.');
      }
    });
  }

  // -------------------------------------------------------------------------
  // Piezas compartidas
  // -------------------------------------------------------------------------
  /*
    Las tres comprobaciones que siguen no sustituyen a las politicas: la base ya
    devuelve cero filas a quien no le toca. Estan para que la respuesta sea un
    404 o un 403 con explicacion en vez de una lista vacia que parece un error
    de la aplicacion.
  */
  private async comprobarCurso(cliente: PoolClient, cursoId: string) {
    const { rows } = await cliente.query(
      `select 1 from cursos where id = $1 and eliminado_en is null`,
      [cursoId],
    );
    if (!rows[0]) {
      throw new NotFoundException('Ese curso no existe o no tienes acceso a el.');
    }
  }

  private async comprobarMembresia(cliente: PoolClient) {
    const { rows } = await cliente.query<{ membresia: string | null }>(
      `select app.mi_membresia() as membresia`,
    );
    if (!rows[0]?.membresia) {
      throw new ForbiddenException(
        'Necesitas una membresia activa en esta institucion para participar.',
      );
    }
  }

  private async puedeModerar(
    cliente: PoolClient,
    cursoId: string,
  ): Promise<boolean> {
    const { rows } = await cliente.query<{ puede: boolean }>(
      `select app.puede_gestionar_curso_aula($1) as puede`,
      [cursoId],
    );
    return rows[0]?.puede ?? false;
  }

  private async leerTema(cliente: PoolClient, temaId: string): Promise<Tema> {
    const { rows } = await cliente.query<Tema>(
      `${SELECT_TEMA} where t.id = $1`,
      [temaId],
    );
    if (!rows[0]) {
      throw new NotFoundException('Ese tema no existe o no tienes acceso a el.');
    }
    return rows[0];
  }

  private async leerMensaje(
    cliente: PoolClient,
    mensajeId: string,
  ): Promise<Mensaje & { cursoId: string }> {
    const { rows } = await cliente.query<Mensaje & { cursoId: string }>(
      `select m.id, m.tema_id as "temaId", m.curso_id as "cursoId", m.cuerpo,
              u.nombre_completo as autor,
              m.autor_membresia_id as "autorMembresiaId",
              (m.autor_membresia_id = app.mi_membresia()) as "esMio",
              (c.instructor_membresia_id = m.autor_membresia_id) as "esDocente",
              ${utc('m.creado_en')} as "creadoEn",
              ${utcOpcional('m.editado_en')} as "editadoEn"
         from foro_mensajes m
         join membresias mb on mb.id = m.autor_membresia_id
         join usuarios u on u.id = mb.usuario_id
         join cursos c on c.id = m.curso_id
        where m.id = $1`,
      [mensajeId],
    );
    if (!rows[0]) {
      throw new NotFoundException('Ese mensaje no existe o no tienes acceso a el.');
    }
    return rows[0];
  }
}
