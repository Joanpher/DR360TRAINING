import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import type { Sesion } from '../comun/sesion';
import {
  gastarTiempoDeVerificacion,
  hashearContrasena,
  verificarContrasena,
} from './contrasenas';
import type { EntrarDto, RegistroDto } from './dto/auth.dto';

const INTENTOS_ANTES_DE_BLOQUEAR = 5;
const MINUTOS_DE_BLOQUEO = 15;

export type Usuario = {
  id: string;
  correo: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  correoVerificado: boolean;
};

export type InstitucionDelUsuario = {
  id: string;
  slug: string;
  nombre: string;
  siglas: string | null;
  estado: string;
  roles: string[];
  membresiaId: string;
};

export type SesionAbierta = {
  acceso: string;
  refresco: string;
  usuario: Usuario;
  instituciones: InstitucionDelUsuario[];
  institucionActual: string | null;
};

const hashDeFicha = (ficha: string) =>
  createHash('sha256').update(ficha).digest('hex');

@Injectable()
export class AuthServicio {
  private readonly bitacora = new Logger(AuthServicio.name);

  constructor(
    private readonly bd: BaseDatos,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // Registro
  // -------------------------------------------------------------------------
  /*
    Quien se registra por su cuenta todavia no pertenece a ninguna institucion:
    nace sin membresias. Desde ahi hay dos caminos, y los dos son normales:
    crear una institucion propia (y quedarse como propietario) o aceptar una
    invitacion. Esa es la razon de que usuarios viva por encima del tenancy.
  */
  async registrar(datos: RegistroDto, ip: string, agente: string): Promise<SesionAbierta> {
    const hash = await hashearContrasena(datos.contrasena);

    const usuario = await this.bd.conIdentidad(async (cliente) => {
      const { rows } = await cliente.query<Usuario & { id: string }>(
        `insert into usuarios (correo, hash_contrasena, nombres, apellidos, estado)
         values ($1, $2, $3, $4, 'activo')
         returning id, correo, nombres, apellidos, nombre_completo as "nombreCompleto",
                   (correo_verificado_en is not null) as "correoVerificado"`,
        [datos.correo, hash, datos.nombres, datos.apellidos],
      );
      const creado = rows[0];

      // El correo aun no esta verificado. Se deja el token guardado (solo su
      // hash) para cuando exista el envio; por ahora el enlace va al log.
      const ficha = randomBytes(32).toString('base64url');
      await cliente.query(
        `insert into tokens_verificacion (usuario_id, tipo, hash_token, expira_en, ip)
         values ($1, 'verificacion_correo', $2, now() + interval '2 days', $3)`,
        [creado.id, hashDeFicha(ficha), ip || null],
      );
      this.bitacora.log(`Verificacion de ${creado.correo}: /verificar?ficha=${ficha}`);

      return creado;
    });

    return this.abrirSesion(usuario, null, ip, agente);
  }

  // -------------------------------------------------------------------------
  // Entrar
  // -------------------------------------------------------------------------
  /*
    Dos credenciales, una consulta.

    Si lo escrito lleva arroba se busca por correo; si no, por matricula. La
    matricula es unica en toda la plataforma justamente para que esta busqueda
    no necesite saber de que colegio es: se busca la cadena tal cual, nunca se
    parte para deducir la institucion. Asi un colegio puede cambiar sus siglas
    sin invalidar los carnets ya impresos.

    La consulta por matricula pasa por membresias, que es donde vive el codigo,
    y exige que la membresia siga activa: a un estudiante retirado no se le
    cierra la puerta borrando su cuenta, sino dejando de reconocer su matricula.
  */
  async entrar(datos: EntrarDto, ip: string, agente: string): Promise<SesionAbierta> {
    const esCorreo = datos.identidad.includes('@');

    const fila = await this.bd.conIdentidad(async (cliente) => {
      const { rows } = await cliente.query<{
        id: string;
        correo: string;
        nombres: string;
        apellidos: string;
        nombreCompleto: string;
        correoVerificado: boolean;
        hashContrasena: string | null;
        estado: string;
        intentos: number;
        bloqueadoHasta: Date | null;
      }>(
        esCorreo
          ? `select u.id, u.correo, u.nombres, u.apellidos,
                    u.nombre_completo as "nombreCompleto",
                    (u.correo_verificado_en is not null) as "correoVerificado",
                    u.hash_contrasena as "hashContrasena", u.estado,
                    u.intentos_fallidos as intentos, u.bloqueado_hasta as "bloqueadoHasta"
               from usuarios u
              where u.correo = $1::citext and u.eliminado_en is null`
          : `select u.id, u.correo, u.nombres, u.apellidos,
                    u.nombre_completo as "nombreCompleto",
                    (u.correo_verificado_en is not null) as "correoVerificado",
                    u.hash_contrasena as "hashContrasena", u.estado,
                    u.intentos_fallidos as intentos, u.bloqueado_hasta as "bloqueadoHasta"
               from membresias m
               join usuarios u on u.id = m.usuario_id
              where m.codigo = $1
                and m.estado = 'activa'
                and m.eliminado_en is null
                and u.eliminado_en is null`,
        [esCorreo ? datos.identidad.toLowerCase() : datos.identidad.toUpperCase()],
      );
      return rows[0] ?? null;
    });

    // Mismo mensaje y mismo coste para "no existe" y "contrasena mala": el
    // formulario de acceso no es sitio para averiguar quien tiene cuenta.
    if (!fila) {
      await gastarTiempoDeVerificacion();
      throw new UnauthorizedException(
        esCorreo ? 'Correo o contrasena incorrectos.' : 'Matricula o clave incorrectas.',
      );
    }

    if (fila.bloqueadoHasta && fila.bloqueadoHasta > new Date()) {
      throw new ForbiddenException(
        'Demasiados intentos fallidos. Vuelve a intentarlo en unos minutos.',
      );
    }

    const correcta = await verificarContrasena(datos.contrasena, fila.hashContrasena);

    if (!correcta) {
      await this.anotarIntentoFallido(fila.id, fila.intentos);
      throw new UnauthorizedException(
        esCorreo ? 'Correo o contrasena incorrectos.' : 'Matricula o clave incorrectas.',
      );
    }

    if (fila.estado === 'suspendido' || fila.estado === 'bloqueado') {
      throw new ForbiddenException('Esta cuenta esta inhabilitada.');
    }

    await this.bd.conIdentidad((cliente) =>
      cliente.query(
        `update usuarios
            set intentos_fallidos = 0, bloqueado_hasta = null, ultimo_acceso_en = now()
          where id = $1`,
        [fila.id],
      ),
    );

    return this.abrirSesion(
      {
        id: fila.id,
        correo: fila.correo,
        nombres: fila.nombres,
        apellidos: fila.apellidos,
        nombreCompleto: fila.nombreCompleto,
        correoVerificado: fila.correoVerificado,
      },
      null,
      ip,
      agente,
    );
  }

  private async anotarIntentoFallido(usuarioId: string, intentosPrevios: number) {
    const intentos = intentosPrevios + 1;
    const bloquear = intentos >= INTENTOS_ANTES_DE_BLOQUEAR;
    await this.bd.conIdentidad((cliente) =>
      cliente.query(
        `update usuarios
            set intentos_fallidos = $2,
                bloqueado_hasta = case when $3 then now() + ($4 || ' minutes')::interval else bloqueado_hasta end
          where id = $1`,
        [usuarioId, bloquear ? 0 : intentos, bloquear, String(MINUTOS_DE_BLOQUEO)],
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Sesiones
  // -------------------------------------------------------------------------
  /*
    Abrir sesion es dos cosas a la vez: una fila en sesiones con el hash del
    refresco (lo unico que sobrevive a un reinicio) y un access token corto que
    no se guarda en ninguna parte. Del refresco solo se guarda el hash: si
    alguien se lleva la tabla, no se lleva sesiones utilizables.

    Si el usuario pertenece a una sola institucion se entra directo. Preguntar
    "¿a cual quieres entrar?" cuando solo hay una respuesta posible es hacerle
    perder un clic a la mayoria de la gente.
  */
  private async abrirSesion(
    usuario: Usuario,
    institucionPedida: string | null,
    ip: string,
    agente: string,
  ): Promise<SesionAbierta> {
    const instituciones = await this.listarInstituciones(usuario.id);

    let institucionActual = institucionPedida;
    if (!institucionActual && instituciones.length === 1) {
      institucionActual = instituciones[0].id;
    }

    const refresco = randomBytes(32).toString('base64url');
    const dias = Number(this.config.get('REFRESCO_DIAS') ?? 30);

    const sesionId = await this.bd.conIdentidad(async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into sesiones (usuario_id, institucion_id, hash_refresco, ip, agente, expira_en)
         values ($1, $2, $3, $4, $5, now() + ($6 || ' days')::interval)
         returning id`,
        [
          usuario.id,
          institucionActual,
          hashDeFicha(refresco),
          ip || null,
          agente?.slice(0, 400) || null,
          String(dias),
        ],
      );
      return rows[0].id;
    });

    return {
      acceso: await this.firmarAcceso(usuario, sesionId, institucionActual, instituciones),
      refresco,
      usuario,
      instituciones,
      institucionActual,
    };
  }

  /*
    Rotacion en cada refresco: el token usado deja de servir en el momento en
    que se entrega el siguiente. Si un refresco robado se usa despues del
    legitimo, no encuentra sesion y el intruso se queda fuera.
  */
  async refrescar(fichaRefresco: string, ip: string, agente: string): Promise<SesionAbierta> {
    if (!fichaRefresco) throw new UnauthorizedException('No hay sesion que refrescar.');

    const datos = await this.bd.conIdentidad(async (cliente) => {
      const { rows } = await cliente.query<{
        sesionId: string;
        institucionId: string | null;
        id: string;
        correo: string;
        nombres: string;
        apellidos: string;
        nombreCompleto: string;
        correoVerificado: boolean;
        estado: string;
      }>(
        `select s.id as "sesionId", s.institucion_id as "institucionId",
                u.id, u.correo, u.nombres, u.apellidos,
                u.nombre_completo as "nombreCompleto",
                (u.correo_verificado_en is not null) as "correoVerificado",
                u.estado
           from sesiones s
           join usuarios u on u.id = s.usuario_id
          where s.hash_refresco = $1
            and s.revocada_en is null
            and s.expira_en > now()
            and u.eliminado_en is null`,
        [hashDeFicha(fichaRefresco)],
      );
      return rows[0] ?? null;
    });

    if (!datos) throw new UnauthorizedException('La sesion expiro o fue cerrada.');
    if (datos.estado === 'suspendido' || datos.estado === 'bloqueado') {
      throw new ForbiddenException('Esta cuenta esta inhabilitada.');
    }

    const nuevoRefresco = randomBytes(32).toString('base64url');
    await this.bd.conIdentidad((cliente) =>
      cliente.query(
        `update sesiones
            set hash_refresco = $2, ultimo_uso_en = now(), ip = $3, agente = $4
          where id = $1`,
        [datos.sesionId, hashDeFicha(nuevoRefresco), ip || null, agente?.slice(0, 400) || null],
      ),
    );

    const usuario: Usuario = {
      id: datos.id,
      correo: datos.correo,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      nombreCompleto: datos.nombreCompleto,
      correoVerificado: datos.correoVerificado,
    };
    const instituciones = await this.listarInstituciones(usuario.id);

    // Si perdio la membresia mientras la sesion seguia abierta, el contexto se
    // cae solo: la institucion deja de estar en la lista y el token nuevo no la
    // lleva.
    const sigueSiendoMiembro = instituciones.some((i) => i.id === datos.institucionId);
    const institucionActual = sigueSiendoMiembro ? datos.institucionId : null;

    return {
      acceso: await this.firmarAcceso(usuario, datos.sesionId, institucionActual, instituciones),
      refresco: nuevoRefresco,
      usuario,
      instituciones,
      institucionActual,
    };
  }

  async salir(fichaRefresco: string | undefined): Promise<void> {
    if (!fichaRefresco) return;
    await this.bd.conIdentidad((cliente) =>
      cliente.query(
        `update sesiones
            set revocada_en = now(), motivo_revocacion = 'cierre de sesion'
          where hash_refresco = $1 and revocada_en is null`,
        [hashDeFicha(fichaRefresco)],
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Elegir institucion
  // -------------------------------------------------------------------------
  /*
    El paso que convierte "una cuenta" en "una cuenta dentro de una
    institucion". Hasta que ocurre, el access token no lleva institucion y las
    politicas de RLS no dejan ver nada del negocio: es el estado seguro.

    La pertenencia se comprueba con el pool de negocio y sin filtrar a mano:
    si la consulta no devuelve fila es porque las politicas no la dejaron ver,
    que es exactamente la respuesta que se necesita.
  */
  async elegirInstitucion(sesion: Sesion, institucionId: string): Promise<SesionAbierta> {
    const instituciones = await this.listarInstituciones(sesion.usuarioId);
    const elegida = instituciones.find((i) => i.id === institucionId);

    if (!elegida) {
      throw new ForbiddenException('No perteneces a esa institucion.');
    }
    if (elegida.estado === 'suspendida' || elegida.estado === 'archivada') {
      throw new ForbiddenException('Esa institucion no esta activa.');
    }

    await this.bd.conIdentidad((cliente) =>
      cliente.query(
        `update sesiones set institucion_id = $2, ultimo_uso_en = now()
          where id = $1 and revocada_en is null`,
        [sesion.sesionId, institucionId],
      ),
    );

    const usuario = await this.leerUsuario(sesion.usuarioId);
    return {
      acceso: await this.firmarAcceso(usuario, sesion.sesionId, institucionId, instituciones),
      refresco: '',
      usuario,
      instituciones,
      institucionActual: institucionId,
    };
  }

  // -------------------------------------------------------------------------
  // Consultas
  // -------------------------------------------------------------------------
  async yo(sesion: Sesion) {
    const [usuario, instituciones] = await Promise.all([
      this.leerUsuario(sesion.usuarioId),
      this.listarInstituciones(sesion.usuarioId),
    ]);
    return {
      usuario,
      instituciones,
      institucionActual: sesion.institucionId,
      roles: sesion.roles,
    };
  }

  private async leerUsuario(usuarioId: string): Promise<Usuario> {
    return this.bd.conContexto({ usuarioId }, async (cliente) => {
      const { rows } = await cliente.query<Usuario>(
        `select id, correo, nombres, apellidos, nombre_completo as "nombreCompleto",
                (correo_verificado_en is not null) as "correoVerificado"
           from usuarios where id = $1`,
        [usuarioId],
      );
      if (!rows[0]) throw new UnauthorizedException('La cuenta ya no existe.');
      return rows[0];
    });
  }

  /*
    Sin institucion en el contexto. Es la unica consulta del sistema que cruza
    tenants a proposito, y solo puede hacerlo porque las politicas de membresias
    y membresia_roles dejan a cada quien ver lo suyo aunque no haya elegido
    todavia a donde entrar.
  */
  private async listarInstituciones(usuarioId: string): Promise<InstitucionDelUsuario[]> {
    return this.bd.conContexto({ usuarioId }, async (cliente: PoolClient) => {
      const { rows } = await cliente.query<InstitucionDelUsuario>(
        `select i.id, i.slug, i.nombre, i.siglas, i.estado::text as estado,
                m.id as "membresiaId",
                coalesce(
                  array_agg(r.rol::text order by r.rol) filter (where r.rol is not null),
                  '{}'
                ) as roles
           from membresias m
           join instituciones i on i.id = m.institucion_id
           left join membresia_roles r on r.membresia_id = m.id
          where m.usuario_id = $1
            and m.estado = 'activa'
            and m.eliminado_en is null
            and i.eliminado_en is null
          group by i.id, i.slug, i.nombre, i.siglas, i.estado, m.id
          order by i.nombre`,
        [usuarioId],
      );
      return rows;
    });
  }

  private async firmarAcceso(
    usuario: Usuario,
    sesionId: string,
    institucionId: string | null,
    instituciones: InstitucionDelUsuario[],
  ): Promise<string> {
    const roles = institucionId
      ? (instituciones.find((i) => i.id === institucionId)?.roles ?? [])
      : [];

    return this.jwt.signAsync({
      sub: usuario.id,
      sid: sesionId,
      correo: usuario.correo,
      ins: institucionId,
      roles,
    });
  }
}
