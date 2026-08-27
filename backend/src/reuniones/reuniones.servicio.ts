import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, diferencias, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import { JitsiServicio } from './jitsi.servicio';
import type {
  ActualizarReunionDto,
  CancelarReunionDto,
  CrearReunionDto,
} from './dto/reuniones.dto';

export type EstadoReunion =
  | 'programada'
  | 'en_curso'
  | 'finalizada'
  | 'cancelada';

export type MiAsistencia = {
  minutos: number;
  entradas: number;
  primeraEntradaEn: string;
  salidaEn: string | null;
};

export type Reunion = {
  id: string;
  cursoId: string;
  cursoCodigo: string;
  cursoNombre: string;
  titulo: string;
  descripcion: string | null;
  estado: EstadoReunion;
  programadaPara: string | null;
  duracionMinutos: number;
  abrirSinAnfitrion: boolean;
  silenciarAlEntrar: boolean;
  camaraApagadaAlEntrar: boolean;
  permiteGrabacion: boolean;
  iniciadaEn: string | null;
  finalizadaEn: string | null;
  canceladaEn: string | null;
  motivoCancelacion: string | null;
  anfitrion: string;
  esAnfitrion: boolean;
  puedeGestionar: boolean;
  /* La sala esta abierta ahora mismo: quien pulse "Entrar" pasa. */
  salaAbierta: boolean;
  participantes: number;
  presentes: number;
  miAsistencia: MiAsistencia | null;
};

export type Asistente = {
  id: string;
  membresiaId: string;
  nombre: string;
  matricula: string | null;
  esAnfitrion: boolean;
  primeraEntradaEn: string;
  salidaEn: string | null;
  minutos: number;
  entradas: number;
  dentro: boolean;
};

export type AccesoReunion = {
  reunion: Reunion;
  dominio: string;
  sala: string;
  token: string | null;
  esModerador: boolean;
  /* Lo que Jitsi pinta en el mosaico antes de que la persona escriba nada. */
  nombre: string;
  correo: string;
  avatarUrl: string | null;
};

/*
  Fecha en UTC con el mismo formato que el resto del sistema. Los timestamptz
  salen de Postgres como objetos Date del driver, y serializarlos con el huso
  del servidor haria que una clase de las nueve se viera a distinta hora segun
  donde este desplegada la API.
*/
const UTC = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;
const fecha = (columna: string) =>
  `case when ${columna} is null then null else to_char(${columna} at time zone 'UTC', ${UTC}) end`;

const CAMPOS = `
  r.id, r.curso_id as "cursoId",
  c.codigo as "cursoCodigo", c.nombre as "cursoNombre",
  r.titulo, r.descripcion, r.estado,
  ${fecha('r.programada_para')} as "programadaPara",
  r.duracion_minutos as "duracionMinutos",
  r.abrir_sin_anfitrion as "abrirSinAnfitrion",
  r.silenciar_al_entrar as "silenciarAlEntrar",
  r.camara_apagada_al_entrar as "camaraApagadaAlEntrar",
  r.permite_grabacion as "permiteGrabacion",
  ${fecha('r.iniciada_en')} as "iniciadaEn",
  ${fecha('r.finalizada_en')} as "finalizadaEn",
  ${fecha('r.cancelada_en')} as "canceladaEn",
  r.motivo_cancelacion as "motivoCancelacion",
  u.nombre_completo as anfitrion,
  (r.anfitrion_membresia_id = app.mi_membresia()) as "esAnfitrion",
  app.puede_gestionar_curso_aula(r.curso_id) as "puedeGestionar",
  app.reunion_abierta(r.id) as "salaAbierta",
  n.total as participantes,
  n.presentes,
  case when mia.id is null then null else
    jsonb_build_object(
      'minutos', mia.minutos,
      'entradas', mia.entradas,
      'primeraEntradaEn', ${fecha('mia.primera_entrada_en')},
      'salidaEn', ${fecha('mia.salida_en')}
    )
  end as "miAsistencia"`;

const DESDE = `
  from reuniones r
  join cursos c on c.id = r.curso_id
  join membresias am on am.id = r.anfitrion_membresia_id
  join usuarios u on u.id = am.usuario_id
  cross join lateral app.reunion_conteo(r.id) n
  left join reunion_asistencias mia
    on mia.reunion_id = r.id and mia.membresia_id = app.mi_membresia()`;

@Injectable()
export class ReunionesServicio {
  constructor(
    private readonly bd: BaseDatos,
    private readonly jitsi: JitsiServicio,
  ) {}

  /*
    La agenda de quien pregunta: sus clases en vivo ahora, las que vienen y un
    recuerdo corto de las ultimas. No es "todas las reuniones del centro": las
    politicas ya recortan a los cursos que la persona imparte o cursa, asi que
    esta consulta no lleva ni un filtro de pertenencia. Si lo llevara, el dia
    que sobrara seria un filtro de mas y no un agujero.
  */
  async agenda(sesion: Sesion): Promise<{ reuniones: Reunion[] }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Reunion>(
        `select ${CAMPOS} ${DESDE}
          where r.estado in ('programada', 'en_curso')
             or r.finalizada_en > now() - interval '7 days'
          order by
            case r.estado when 'en_curso' then 0 when 'programada' then 1 else 2 end,
            coalesce(r.programada_para, r.iniciada_en, r.creado_en),
            r.titulo`,
      );
      return { reuniones: rows };
    });
  }

  /*
    Solo lo que se puede abrir ahora. Lo consulta la barra de navegacion cada
    pocos segundos para encender el punto de "en vivo", asi que devuelve lo
    minimo y no la agenda entera.
  */
  async enVivo(sesion: Sesion): Promise<{ reuniones: Reunion[] }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Reunion>(
        `select ${CAMPOS} ${DESDE}
          where app.reunion_abierta(r.id)
          order by coalesce(r.iniciada_en, r.programada_para), r.titulo`,
      );
      return { reuniones: rows };
    });
  }

  async deCurso(
    sesion: Sesion,
    cursoId: string,
  ): Promise<{ reuniones: Reunion[]; puedeGestionar: boolean }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows: permiso } = await cliente.query<{ puede: boolean }>(
        `select app.puede_gestionar_curso_aula($1::uuid) as puede`,
        [cursoId],
      );
      const { rows } = await cliente.query<Reunion>(
        `select ${CAMPOS} ${DESDE}
          where r.curso_id = $1
          order by
            case r.estado when 'en_curso' then 0 when 'programada' then 1 else 2 end,
            coalesce(r.programada_para, r.iniciada_en, r.creado_en) desc,
            r.titulo`,
        [cursoId],
      );
      return { reuniones: rows, puedeGestionar: permiso[0]?.puede ?? false };
    });
  }

  async crear(
    sesion: Sesion,
    cursoId: string,
    datos: CrearReunionDto,
    origen: Origen,
  ): Promise<{ reunion: Reunion }> {
    const ahora = Boolean(datos.iniciarAhora) || !datos.programadaPara;
    if (!ahora && new Date(datos.programadaPara!).getTime() < Date.now() - 86_400_000) {
      throw new BadRequestException(
        'No se puede programar una clase con mas de un dia de retraso.',
      );
    }

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const curso = await this.comprobarGestionCurso(cliente, cursoId);

      const { rows } = await cliente.query<{ id: string }>(
        `insert into reuniones
           (institucion_id, curso_id, sala, titulo, descripcion,
            estado, anfitrion_membresia_id, programada_para, duracion_minutos,
            abrir_sin_anfitrion, silenciar_al_entrar, camara_apagada_al_entrar,
            permite_grabacion, iniciada_en, creada_por)
         values ($1, $2, $3, $4, $5,
                 $6::estado_reunion,
                 coalesce($7::uuid, app.mi_membresia()),
                 $8::timestamptz, $9,
                 $10, $11, $12, $13,
                 case when $6 = 'en_curso' then now() end,
                 app.usuario_actual())
         returning id`,
        [
          institucionDe(sesion),
          cursoId,
          this.jitsi.nombreDeSala(),
          datos.titulo?.trim() || `Clase en vivo · ${curso.nombre}`,
          datos.descripcion?.trim() || null,
          ahora ? 'en_curso' : 'programada',
          curso.instructorMembresiaId,
          ahora ? null : datos.programadaPara,
          datos.duracionMinutos ?? 60,
          datos.abrirSinAnfitrion ?? false,
          datos.silenciarAlEntrar ?? true,
          datos.camaraApagadaAlEntrar ?? false,
          datos.permiteGrabacion ?? false,
        ],
      );

      const id = rows[0]!.id;
      await anotar(
        cliente,
        {
          accion: ahora ? 'reunion.iniciada' : 'reunion.programada',
          entidad: 'reuniones',
          entidadId: id,
          // La sala no se anota: es la credencial de entrada mientras el
          // despliegue de Jitsi no exija token, y la bitacora la leen mas
          // personas que las que estan invitadas a la clase.
          datos: { cursoId, programadaPara: datos.programadaPara ?? null },
        },
        origen,
      );

      return { reunion: await this.leer(cliente, id) };
    });
  }

  async actualizar(
    sesion: Sesion,
    id: string,
    datos: ActualizarReunionDto,
    origen: Origen,
  ): Promise<{ reunion: Reunion }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const actual = await this.comprobarGestion(cliente, id);
      if (actual.estado === 'finalizada' || actual.estado === 'cancelada') {
        throw new BadRequestException(
          'Una clase terminada o cancelada ya no se edita.',
        );
      }

      const cambios = diferencias(
        {
          titulo: actual.titulo,
          descripcion: actual.descripcion,
          programadaPara: actual.programadaPara,
          duracionMinutos: actual.duracionMinutos,
          abrirSinAnfitrion: actual.abrirSinAnfitrion,
          silenciarAlEntrar: actual.silenciarAlEntrar,
          camaraApagadaAlEntrar: actual.camaraApagadaAlEntrar,
          permiteGrabacion: actual.permiteGrabacion,
        },
        datos as Record<string, unknown>,
      );
      if (Object.keys(cambios).length === 0) {
        return { reunion: await this.leer(cliente, id) };
      }

      await cliente.query(
        `update reuniones set
           titulo = coalesce($2, titulo),
           descripcion = case when $3::boolean then $4 else descripcion end,
           programada_para = case when $5::boolean then $6::timestamptz else programada_para end,
           duracion_minutos = coalesce($7, duracion_minutos),
           abrir_sin_anfitrion = coalesce($8, abrir_sin_anfitrion),
           silenciar_al_entrar = coalesce($9, silenciar_al_entrar),
           camara_apagada_al_entrar = coalesce($10, camara_apagada_al_entrar),
           permite_grabacion = coalesce($11, permite_grabacion)
         where id = $1`,
        [
          id,
          datos.titulo?.trim() ?? null,
          datos.descripcion !== undefined,
          datos.descripcion?.trim() || null,
          datos.programadaPara !== undefined,
          datos.programadaPara ?? null,
          datos.duracionMinutos ?? null,
          datos.abrirSinAnfitrion ?? null,
          datos.silenciarAlEntrar ?? null,
          datos.camaraApagadaAlEntrar ?? null,
          datos.permiteGrabacion ?? null,
        ],
      );

      await anotar(
        cliente,
        {
          accion: 'reunion.actualizada',
          entidad: 'reuniones',
          entidadId: id,
          datos: cambios,
        },
        origen,
      );
      return { reunion: await this.leer(cliente, id) };
    });
  }

  async iniciar(
    sesion: Sesion,
    id: string,
    origen: Origen,
  ): Promise<{ reunion: Reunion }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const actual = await this.comprobarGestion(cliente, id);
      if (actual.estado === 'en_curso') {
        return { reunion: await this.leer(cliente, id) };
      }
      if (actual.estado !== 'programada') {
        throw new BadRequestException(
          'Esa clase ya termino. Programa una nueva.',
        );
      }

      await cliente.query(
        `update reuniones
            set estado = 'en_curso', iniciada_en = now()
          where id = $1`,
        [id],
      );
      await anotar(
        cliente,
        { accion: 'reunion.iniciada', entidad: 'reuniones', entidadId: id },
        origen,
      );
      return { reunion: await this.leer(cliente, id) };
    });
  }

  /*
    Terminar la clase cierra tambien las asistencias que quedaron abiertas.
    Quien cierra la pestana de golpe no llega a avisar de su salida, y sin este
    barrido su fila acumularia minutos hasta el fin de los tiempos.
  */
  async finalizar(
    sesion: Sesion,
    id: string,
    origen: Origen,
  ): Promise<{ reunion: Reunion }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const actual = await this.comprobarGestion(cliente, id);
      if (actual.estado === 'finalizada') {
        return { reunion: await this.leer(cliente, id) };
      }
      if (actual.estado === 'cancelada') {
        throw new BadRequestException('Esa clase esta cancelada.');
      }

      await cliente.query(
        `update reuniones
            set estado = 'finalizada',
                finalizada_en = now(),
                iniciada_en = coalesce(iniciada_en, now())
          where id = $1`,
        [id],
      );
      const { rowCount } = await this.cerrarAsistencias(cliente, id);

      await anotar(
        cliente,
        {
          accion: 'reunion.finalizada',
          entidad: 'reuniones',
          entidadId: id,
          datos: { asistenciasCerradas: rowCount },
        },
        origen,
      );
      return { reunion: await this.leer(cliente, id) };
    });
  }

  async cancelar(
    sesion: Sesion,
    id: string,
    datos: CancelarReunionDto,
    origen: Origen,
  ): Promise<{ reunion: Reunion }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const actual = await this.comprobarGestion(cliente, id);
      if (actual.estado === 'finalizada') {
        throw new BadRequestException(
          'Esa clase ya se impartio: no se puede cancelar.',
        );
      }
      if (actual.estado === 'cancelada') {
        return { reunion: await this.leer(cliente, id) };
      }

      await cliente.query(
        `update reuniones
            set estado = 'cancelada',
                cancelada_en = now(),
                motivo_cancelacion = $2
          where id = $1`,
        [id, datos.motivo?.trim() || null],
      );
      await this.cerrarAsistencias(cliente, id);

      await anotar(
        cliente,
        {
          accion: 'reunion.cancelada',
          entidad: 'reuniones',
          entidadId: id,
          datos: { motivo: datos.motivo?.trim() || null },
        },
        origen,
      );
      return { reunion: await this.leer(cliente, id) };
    });
  }

  /*
    La entrada a la sala.

    Aqui pasan tres cosas y ninguna sobra: se comprueba que la sala este
    abierta, se anota la asistencia y se firma el token. El token se firma al
    final y solo si lo anterior salio bien, de modo que no existe una credencial
    de entrada para una clase a la que esta persona no podia entrar.
  */
  async entrar(
    sesion: Sesion,
    id: string,
    origen: Origen,
  ): Promise<AccesoReunion> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{
        cursoId: string;
        sala: string;
        estado: EstadoReunion;
        abierta: boolean;
        puedeGestionar: boolean;
        permiteGrabacion: boolean;
        nombre: string;
        correo: string;
        avatarUrl: string | null;
      }>(
        `select r.curso_id as "cursoId", r.sala, r.estado,
                app.reunion_abierta(r.id) as abierta,
                app.puede_gestionar_curso_aula(r.curso_id) as "puedeGestionar",
                r.permite_grabacion as "permiteGrabacion",
                u.nombre_completo as nombre, u.correo::text as correo,
                u.avatar_url as "avatarUrl"
           from reuniones r
           join usuarios u on u.id = app.usuario_actual()
          where r.id = $1`,
        [id],
      );
      const reunion = rows[0];
      if (!reunion) throw new NotFoundException('Esa clase no existe.');

      if (reunion.estado === 'cancelada') {
        throw new BadRequestException('Esa clase fue cancelada.');
      }
      if (reunion.estado === 'finalizada') {
        throw new BadRequestException('Esa clase ya termino.');
      }

      /*
        Quien modera abre la sala con entrar: pulsar "Iniciar" y despues
        "Entrar" son dos gestos para una sola intencion, y el segundo se olvida
        justo cuando la clase ya deberia haber empezado.
      */
      if (reunion.estado === 'programada' && reunion.puedeGestionar) {
        await cliente.query(
          `update reuniones set estado = 'en_curso', iniciada_en = now()
            where id = $1 and estado = 'programada'`,
          [id],
        );
      } else if (!reunion.abierta) {
        throw new ForbiddenException(
          'La sala todavia no esta abierta. Se abrira cuando el instructor inicie la clase.',
        );
      }

      /*
        Reentrar no crea una fila nueva ni pisa la primera entrada: suma una
        vuelta y reabre el cronometro. Si la conexion se cayo a mitad, los
        minutos de antes de la caida ya estaban contados.
      */
      await cliente.query(
        `insert into reunion_asistencias
           (institucion_id, curso_id, reunion_id, membresia_id, es_anfitrion)
         values ($1, $2, $3, app.mi_membresia(), $4)
         on conflict (reunion_id, membresia_id) do update set
           ultima_entrada_en = now(),
           salida_en = null,
           entradas = reunion_asistencias.entradas + 1`,
        [
          institucionDe(sesion),
          reunion.cursoId,
          id,
          reunion.puedeGestionar,
        ],
      );

      await anotar(
        cliente,
        {
          accion: 'reunion.entrada',
          entidad: 'reuniones',
          entidadId: id,
          datos: { moderador: reunion.puedeGestionar },
        },
        origen,
      );

      const acceso = await this.jitsi.acceso(
        reunion.sala,
        {
          usuarioId: sesion.usuarioId,
          nombre: reunion.nombre,
          correo: reunion.correo,
          avatarUrl: reunion.avatarUrl,
        },
        reunion.puedeGestionar,
        reunion.permiteGrabacion,
      );

      return {
        reunion: await this.leer(cliente, id),
        ...acceso,
        nombre: reunion.nombre,
        correo: reunion.correo,
        avatarUrl: reunion.avatarUrl,
      };
    });
  }

  /*
    Salir. Se llama al cerrar la sala y tambien al cerrar la pestana, asi que
    tiene que aguantar llegar dos veces: la condicion salida_en is null hace
    que la segunda no sume minutos.
  */
  async salir(sesion: Sesion, id: string): Promise<{ minutos: number }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ minutos: number }>(
        `update reunion_asistencias
            set salida_en = now(),
                minutos = minutos
                  + greatest(0, floor(extract(epoch from (now() - ultima_entrada_en)) / 60))::int
          where reunion_id = $1
            and membresia_id = app.mi_membresia()
            and salida_en is null
        returning minutos`,
        [id],
      );
      return { minutos: rows[0]?.minutos ?? 0 };
    });
  }

  async asistencia(
    sesion: Sesion,
    id: string,
  ): Promise<{ reunion: Reunion; asistentes: Asistente[] }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      await this.comprobarGestion(cliente, id);
      const { rows } = await cliente.query<Asistente>(
        `select a.id, a.membresia_id as "membresiaId",
                u.nombre_completo as nombre,
                m.codigo as matricula,
                a.es_anfitrion as "esAnfitrion",
                ${fecha('a.primera_entrada_en')} as "primeraEntradaEn",
                ${fecha('a.salida_en')} as "salidaEn",
                case when a.salida_en is null
                     then a.minutos
                          + greatest(0, floor(extract(epoch from (now() - a.ultima_entrada_en)) / 60))::int
                     else a.minutos end as minutos,
                a.entradas,
                (a.salida_en is null) as dentro
           from reunion_asistencias a
           join membresias m on m.id = a.membresia_id
           join usuarios u on u.id = m.usuario_id
          where a.reunion_id = $1
          order by a.es_anfitrion desc, a.primera_entrada_en`,
        [id],
      );
      return { reunion: await this.leer(cliente, id), asistentes: rows };
    });
  }

  // -------------------------------------------------------------------------

  private async leer(cliente: PoolClient, id: string): Promise<Reunion> {
    const { rows } = await cliente.query<Reunion>(
      `select ${CAMPOS} ${DESDE} where r.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Esa clase no existe.');
    return rows[0];
  }

  private async cerrarAsistencias(cliente: PoolClient, id: string) {
    return cliente.query(
      `update reunion_asistencias
          set salida_en = now(),
              minutos = minutos
                + greatest(0, floor(extract(epoch from (now() - ultima_entrada_en)) / 60))::int
        where reunion_id = $1 and salida_en is null`,
      [id],
    );
  }

  private async comprobarGestionCurso(cliente: PoolClient, cursoId: string) {
    const { rows } = await cliente.query<{
      nombre: string;
      instructorMembresiaId: string | null;
      puede: boolean;
    }>(
      `select nombre,
              instructor_membresia_id as "instructorMembresiaId",
              app.puede_gestionar_curso_aula(id) as puede
         from cursos where id = $1 and eliminado_en is null`,
      [cursoId],
    );
    if (!rows[0]) throw new NotFoundException('Ese curso no existe.');
    if (!rows[0].puede) {
      throw new ForbiddenException(
        'No puedes convocar clases en vivo de este curso.',
      );
    }
    return rows[0];
  }

  private async comprobarGestion(
    cliente: PoolClient,
    id: string,
  ): Promise<Reunion> {
    const reunion = await this.leer(cliente, id);
    if (!reunion.puedeGestionar) {
      throw new ForbiddenException('No puedes administrar esta clase.');
    }
    return reunion;
  }
}
