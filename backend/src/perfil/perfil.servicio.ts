import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, diferencias, type Origen } from '../comun/auditoria';
import type { Sesion } from '../comun/sesion';
import {
  gastarTiempoDeVerificacion,
  hashearContrasena,
  verificarContrasena,
} from '../auth/contrasenas';
import type { ActualizarPerfilDto, CambiarContrasenaDto } from './dto/perfil.dto';

/*
  La cuenta, que es lo unico de esta plataforma que no pertenece a una
  institucion sino a la persona.

  De ahi la diferencia con el resto de modulos: el contexto se arma a mano con
  la institucion que traiga la sesion, que puede ser null. Un perfil se consulta
  y se corrige igual desde dentro de un centro que sin haber elegido ninguno, y
  contextoDe() habria hecho fallar el segundo caso con un "primero elige una
  institucion" que aqui no viene a cuento.

  Las politicas cubren las dos situaciones: usuarios_edicion deja tocar la fila
  propia por id = app.usuario_actual(), sin mirar la institucion, y
  sesiones_propias hace lo mismo con las sesiones.
*/

export type Perfil = {
  id: string;
  correo: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  telefono: string | null;
  avatarUrl: string | null;
  correoVerificado: boolean;
  tieneContrasena: boolean;
  creadoEn: string;
  ultimoAccesoEn: string | null;
};

export type SesionAbiertaPerfil = {
  id: string;
  ip: string | null;
  agente: string | null;
  creadoEn: string;
  ultimoUsoEn: string;
  expiraEn: string;
  esActual: boolean;
};

const utc = (columna: string) =>
  `to_char(${columna} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

const utcOpcional = (columna: string) =>
  `case when ${columna} is null then null else ${utc(columna)} end`;

const SELECT_PERFIL = `
  select id, correo::text as correo, nombres, apellidos,
         nombre_completo as "nombreCompleto",
         telefono, avatar_url as "avatarUrl",
         (correo_verificado_en is not null) as "correoVerificado",
         (hash_contrasena is not null) as "tieneContrasena",
         ${utc('creado_en')} as "creadoEn",
         ${utcOpcional('ultimo_acceso_en')} as "ultimoAccesoEn"
    from usuarios
`;

@Injectable()
export class PerfilServicio {
  constructor(private readonly bd: BaseDatos) {}

  private contexto(sesion: Sesion) {
    return {
      usuarioId: sesion.usuarioId,
      institucionId: sesion.institucionId,
    };
  }

  async ver(
    sesion: Sesion,
  ): Promise<{ perfil: Perfil; sesiones: SesionAbiertaPerfil[] }> {
    return this.bd.conContexto(this.contexto(sesion), async (cliente) => {
      const { rows } = await cliente.query<Perfil>(
        `${SELECT_PERFIL} where id = $1`,
        [sesion.usuarioId],
      );
      if (!rows[0]) throw new NotFoundException('La cuenta ya no existe.');

      /*
        Solo las vivas. Una sesion revocada o caducada no es informacion util
        para quien mira su cuenta: lo que quiere saber es desde donde se puede
        entrar ahora mismo con su nombre.
      */
      const { rows: sesiones } = await cliente.query<SesionAbiertaPerfil>(
        `select id, host(ip) as ip, agente,
                ${utc('creado_en')} as "creadoEn",
                ${utc('ultimo_uso_en')} as "ultimoUsoEn",
                ${utc('expira_en')} as "expiraEn",
                (id = $1) as "esActual"
           from sesiones
          where usuario_id = $2
            and revocada_en is null
            and expira_en > now()
          order by (id = $1) desc, ultimo_uso_en desc`,
        [sesion.sesionId, sesion.usuarioId],
      );

      return { perfil: rows[0], sesiones };
    });
  }

  async actualizar(
    sesion: Sesion,
    datos: ActualizarPerfilDto,
    origen: Origen,
  ): Promise<{ perfil: Perfil }> {
    return this.bd.conContexto(this.contexto(sesion), async (cliente) => {
      const { rows: previas } = await cliente.query<Perfil>(
        `${SELECT_PERFIL} where id = $1`,
        [sesion.usuarioId],
      );
      const antes = previas[0];
      if (!antes) throw new NotFoundException('La cuenta ya no existe.');

      const cambios = diferencias(
        {
          nombres: antes.nombres,
          apellidos: antes.apellidos,
          telefono: antes.telefono,
          avatarUrl: antes.avatarUrl,
        },
        {
          nombres: datos.nombres,
          apellidos: datos.apellidos,
          telefono: datos.telefono === '' ? null : datos.telefono,
          avatarUrl: datos.avatarUrl === '' ? null : datos.avatarUrl,
        },
      );
      if (!Object.keys(cambios).length) return { perfil: antes };

      const { rows } = await cliente.query<Perfil>(
        `update usuarios
            set nombres    = coalesce($2, nombres),
                apellidos  = coalesce($3, apellidos),
                telefono   = case when $4 then $5 else telefono end,
                avatar_url = case when $6 then $7 else avatar_url end
          where id = $1
          returning id, correo::text as correo, nombres, apellidos,
                    nombre_completo as "nombreCompleto",
                    telefono, avatar_url as "avatarUrl",
                    (correo_verificado_en is not null) as "correoVerificado",
                    (hash_contrasena is not null) as "tieneContrasena",
                    ${utc('creado_en')} as "creadoEn",
                    ${utcOpcional('ultimo_acceso_en')} as "ultimoAccesoEn"`,
        [
          sesion.usuarioId,
          datos.nombres ?? null,
          datos.apellidos ?? null,
          'telefono' in cambios,
          datos.telefono === '' ? null : (datos.telefono ?? null),
          'avatarUrl' in cambios,
          datos.avatarUrl === '' ? null : (datos.avatarUrl ?? null),
        ],
      );

      /*
        La foto no va al detalle del evento: un data URI de doscientos mil
        caracteres dentro de auditoria.eventos convertiria la bitacora en un
        almacen de imagenes. Basta con saber que cambio.
      */
      await anotar(
        cliente,
        {
          accion: 'perfil.actualizado',
          entidad: 'usuarios',
          entidadId: sesion.usuarioId,
          datos: {
            campos: Object.keys(cambios),
            avatar: 'avatarUrl' in cambios ? Boolean(datos.avatarUrl) : undefined,
          },
        },
        origen,
      );

      return { perfil: rows[0] };
    });
  }

  // -------------------------------------------------------------------------
  // Contrasena
  // -------------------------------------------------------------------------
  /*
    Por el pool de identidad y no por el de negocio: hash_contrasena no esta en
    los grants de columna de educa_app, a proposito. El rol con el que corre el
    resto de la aplicacion no puede tocar credenciales ni aunque alguien se lo
    pida, y este metodo es la unica forma de cambiarla desde dentro de la
    sesion.
  */
  async cambiarContrasena(
    sesion: Sesion,
    datos: CambiarContrasenaDto,
    origen: Origen,
  ): Promise<{ sesionesCerradas: number }> {
    if (datos.actual === datos.nueva) {
      throw new BadRequestException(
        'La contrasena nueva tiene que ser distinta de la actual.',
      );
    }

    const cerradas = await this.bd.conIdentidad(
      async (cliente) => {
        const { rows } = await cliente.query<{ hash: string | null }>(
          `select hash_contrasena as hash from usuarios where id = $1`,
          [sesion.usuarioId],
        );
        if (!rows[0]) throw new UnauthorizedException('La cuenta ya no existe.');

        if (!rows[0].hash) {
          throw new BadRequestException(
            'Esta cuenta no entra con contrasena, asi que no hay ninguna que cambiar.',
          );
        }

        const correcta = await verificarContrasena(datos.actual, rows[0].hash);
        if (!correcta) {
          // El mismo gasto de tiempo que el login fallido: sin el, lo que tarda
          // la respuesta delata si la actual era la buena.
          await gastarTiempoDeVerificacion();
          throw new UnauthorizedException('La contrasena actual no es correcta.');
        }

        await cliente.query(
          `update usuarios set hash_contrasena = $2 where id = $1`,
          [sesion.usuarioId, await hashearContrasena(datos.nueva)],
        );

        /*
          Cambiar la contrasena cierra las demas sesiones. Es la mitad util de
          la operacion: quien la cambia porque cree que alguien entro en su
          cuenta no gana nada si el intruso sigue dentro con su token de
          refresco. La propia se conserva para no echar a la calle a quien
          acaba de hacerlo bien.
        */
        const { rowCount } = await cliente.query(
          `update sesiones
              set revocada_en = now(), motivo_revocacion = 'cambio_de_contrasena'
            where usuario_id = $1 and id <> $2 and revocada_en is null`,
          [sesion.usuarioId, sesion.sesionId],
        );
        return rowCount ?? 0;
      },
      { usuarioId: sesion.usuarioId },
    );

    /*
      La bitacora se escribe en su propia transaccion, con el pool de negocio,
      porque educa_auth no tiene insert sobre auditoria.eventos. Que este fuera
      de la transaccion del cambio significa que un fallo aqui deja la
      contrasena cambiada y sin anotar; es preferible al reves, y no hay forma
      de tener las dos cosas con dos roles distintos.
    */
    await this.bd.conContexto(this.contexto(sesion), (cliente) =>
      anotar(
        cliente,
        {
          accion: 'perfil.contrasena_cambiada',
          entidad: 'usuarios',
          entidadId: sesion.usuarioId,
          datos: { sesionesCerradas: cerradas },
        },
        origen,
      ),
    );

    return { sesionesCerradas: cerradas };
  }

  // -------------------------------------------------------------------------
  // Sesiones
  // -------------------------------------------------------------------------
  async cerrarSesion(
    sesion: Sesion,
    sesionId: string,
    origen: Origen,
  ): Promise<void> {
    if (sesionId === sesion.sesionId) {
      throw new BadRequestException(
        'Esa es la sesion desde la que estas mirando: para cerrarla, sal de la plataforma.',
      );
    }

    await this.bd.conContexto(this.contexto(sesion), async (cliente) => {
      const { rowCount } = await cliente.query(
        `update sesiones
            set revocada_en = now(), motivo_revocacion = 'cerrada_desde_el_perfil'
          where id = $1 and usuario_id = $2 and revocada_en is null`,
        [sesionId, sesion.usuarioId],
      );
      if (!rowCount) {
        throw new NotFoundException('Esa sesion ya no estaba abierta.');
      }

      await anotar(
        cliente,
        {
          accion: 'perfil.sesion_cerrada',
          entidad: 'sesiones',
          entidadId: sesionId,
        },
        origen,
      );
    });
  }

  async cerrarLasDemas(
    sesion: Sesion,
    origen: Origen,
  ): Promise<{ sesionesCerradas: number }> {
    return this.bd.conContexto(this.contexto(sesion), async (cliente) => {
      const { rowCount } = await cliente.query(
        `update sesiones
            set revocada_en = now(), motivo_revocacion = 'cerradas_desde_el_perfil'
          where usuario_id = $1 and id <> $2 and revocada_en is null`,
        [sesion.usuarioId, sesion.sesionId],
      );
      const cerradas = rowCount ?? 0;

      if (cerradas) {
        await anotar(
          cliente,
          {
            accion: 'perfil.sesiones_cerradas',
            entidad: 'usuarios',
            entidadId: sesion.usuarioId,
            datos: { sesionesCerradas: cerradas },
          },
          origen,
        );
      }

      return { sesionesCerradas: cerradas };
    });
  }
}
