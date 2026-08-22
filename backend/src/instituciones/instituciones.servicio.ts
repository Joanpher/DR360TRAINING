import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, diferencias, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import { AuthServicio, type SesionAbierta } from '../auth/auth.servicio';
import type { CrearInstitucionDto } from '../auth/dto/auth.dto';
import type {
  ActualizarDominioDto,
  ActualizarInstitucionDto,
  ArchivarDto,
  CrearDominioDto,
  EscalaDto,
  MarcaDto,
} from './dto/institucion.dto';

export type InstitucionCreada = {
  id: string;
  slug: string;
  nombre: string;
  siglas: string | null;
  estado: string;
};

type FilaInstitucion = {
  id: string;
  slug: string;
  nombre: string;
  siglas: string | null;
  tipo: string;
  estado: string;
  pais: string;
  zonaHoraria: string;
  idioma: string;
  correoSoporte: string | null;
  sitioWeb: string | null;
  marca: Record<string, unknown>;
  configuracion: Record<string, unknown>;
  creadoEn: Date;
};

export type Dominio = {
  id: string;
  dominio: string;
  autoafiliar: boolean;
  rolPorDefecto: string;
  verificado: boolean;
  verificadoEn: Date | null;
  /* Lo que hay que publicar en el DNS para probar que el dominio es tuyo. */
  registroTxt: string;
};

export type Tramo = {
  letra: string;
  desde: number;
  hasta: number;
  puntos: number;
};

/*
  Escala por defecto: la de casi todas las universidades dominicanas. Se guarda
  solo cuando alguien la cambia; mientras nadie la toque, esta constante es la
  respuesta y no hay una fila con datos duplicados en cada institucion.
*/
const ESCALA_POR_DEFECTO: Tramo[] = [
  { letra: 'A', desde: 90, hasta: 100, puntos: 400 },
  { letra: 'B', desde: 80, hasta: 89, puntos: 300 },
  { letra: 'C', desde: 70, hasta: 79, puntos: 200 },
  { letra: 'D', desde: 60, hasta: 69, puntos: 100 },
  { letra: 'F', desde: 0, hasta: 59, puntos: 0 },
];

const SELECCION = `
  id, slug::text as slug, nombre, siglas, tipo::text as tipo,
  estado::text as estado, pais, zona_horaria as "zonaHoraria", idioma,
  correo_soporte::text as "correoSoporte", sitio_web as "sitioWeb",
  marca, configuracion, creado_en as "creadoEn"
`;

@Injectable()
export class InstitucionesServicio {
  private readonly bitacora = new Logger(InstitucionesServicio.name);

  constructor(
    private readonly bd: BaseDatos,
    private readonly auth: AuthServicio,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Alta
  // ---------------------------------------------------------------------------
  /*
    El alta de un tenant no se arma aqui a base de inserts sueltos: se delega en
    app.crear_institucion(), que hace institucion + membresia + rol propietario
    + bitacora en una sola transaccion de la base.

    Podria haberse escrito en TypeScript, pero entonces habria dos caminos para
    crear una institucion (este y el SQL directo) y solo uno garantizaria que
    nace con propietario. Con la funcion, instituciones no necesita politica de
    insert: no hay otra puerta.
  */
  async crear(
    sesion: Sesion,
    datos: CrearInstitucionDto,
  ): Promise<SesionAbierta> {
    const institucion = await this.bd.conContexto(
      { usuarioId: sesion.usuarioId },
      async (cliente) => {
        const { rows } = await cliente.query<InstitucionCreada>(
          `select id, slug::text as slug, nombre, siglas, estado::text as estado
             from app.crear_institucion($1, $2::citext, $3, $4::tipo_institucion,
                                        $5::char(2), $6)`,
          [
            datos.nombre,
            datos.slug,
            datos.siglas,
            datos.tipo,
            datos.pais,
            datos.zonaHoraria,
          ],
        );
        return rows[0];
      },
    );

    this.bitacora.log(
      `Institucion ${institucion.slug} creada por ${sesion.correo}`,
    );

    // Se devuelve un access token que ya lleva la institucion en el contexto,
    // para que el asistente entre directo en vez de pedir "elige una".
    return this.auth.elegirInstitucion(sesion, institucion.id);
  }

  /*
    Responde si o no. No dice de quien es el identificador ocupado: la funcion
    de la base devuelve un booleano y nada mas, justamente para que este
    endpoint no se convierta en un directorio de instituciones.
  */
  async slugDisponible(
    sesion: Sesion,
    slug: string,
  ): Promise<{ disponible: boolean }> {
    if (!/^[a-z0-9]([a-z0-9-]{1,38})?[a-z0-9]$/.test(slug)) {
      throw new BadRequestException(
        'Ese identificador no tiene un formato valido.',
      );
    }

    return this.bd.conContexto(
      { usuarioId: sesion.usuarioId },
      async (cliente) => {
        const { rows } = await cliente.query<{ disponible: boolean }>(
          'select app.slug_disponible($1::citext) as disponible',
          [slug],
        );
        return rows[0];
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Lectura
  // ---------------------------------------------------------------------------
  /*
    Todo lo que necesita la pantalla de configuracion en una sola llamada. Son
    tres consultas contra tablas pequeñas dentro de la misma transaccion: partir
    esto en tres endpoints obligaria a la interfaz a orquestar tres estados de
    carga para pintar una sola pagina.
  */
  async leerActual(sesion: Sesion) {
    const contexto = contextoDe(sesion);

    return this.bd.conContexto(contexto, async (cliente) => {
      const institucion = await this.leerFila(cliente, sesion);
      const dominios = await this.leerDominios(cliente, institucion.id);

      return {
        institucion: this.publica(institucion),
        dominios,
        escala: this.escalaDe(institucion),
        /* La interfaz necesita saber si puede ofrecer archivar. */
        esPropietario: sesion.roles.includes('propietario'),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Datos generales
  // ---------------------------------------------------------------------------
  async actualizar(
    sesion: Sesion,
    datos: ActualizarInstitucionDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leerFila(cliente, sesion, true);

      // descripcion no tiene columna propia: vive en configuracion, que es
      // donde va todo lo que se lee siempre entero y no se filtra nunca.
      const { descripcion, ...columnas } = datos;
      const configuracion =
        descripcion === undefined
          ? antes.configuracion
          : { ...antes.configuracion, descripcion };

      const cambios = diferencias(
        {
          ...this.publica(antes),
          descripcion: antes.configuracion.descripcion ?? null,
        },
        { ...columnas, descripcion },
      );

      if (Object.keys(cambios).length === 0) {
        return {
          institucion: this.publica(antes),
          dominios: await this.leerDominios(cliente, antes.id),
          escala: this.escalaDe(antes),
          esPropietario: sesion.roles.includes('propietario'),
        };
      }

      const { rows } = await cliente.query<FilaInstitucion>(
        `update instituciones set
            nombre         = $2,
            siglas         = $3,
            slug           = $4::citext,
            tipo           = $5::tipo_institucion,
            pais           = $6::char(2),
            zona_horaria   = $7,
            idioma         = $8::char(2),
            correo_soporte = $9::citext,
            sitio_web      = $10,
            configuracion  = $11::jsonb
          where id = $1
        returning ${SELECCION}`,
        [
          antes.id,
          columnas.nombre ?? antes.nombre,
          columnas.siglas ?? antes.siglas,
          columnas.slug ?? antes.slug,
          columnas.tipo ?? antes.tipo,
          columnas.pais ?? antes.pais,
          columnas.zonaHoraria ?? antes.zonaHoraria,
          columnas.idioma ?? antes.idioma,
          columnas.correoSoporte === undefined
            ? antes.correoSoporte
            : columnas.correoSoporte,
          columnas.sitioWeb === undefined ? antes.sitioWeb : columnas.sitioWeb,
          JSON.stringify(configuracion),
        ],
      );

      await anotar(
        cliente,
        {
          accion: 'institucion.datos_actualizados',
          entidad: 'instituciones',
          entidadId: antes.id,
          datos: { cambios },
        },
        origen,
      );

      return {
        institucion: this.publica(rows[0]),
        dominios: await this.leerDominios(cliente, antes.id),
        escala: this.escalaDe(rows[0]),
        esPropietario: sesion.roles.includes('propietario'),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Marca
  // ---------------------------------------------------------------------------
  async guardarMarca(sesion: Sesion, datos: MarcaDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leerFila(cliente, sesion, true);
      const marca = { ...antes.marca, ...limpiar(datos) };
      const cambios = diferencias(antes.marca, limpiar(datos));

      const { rows } = await cliente.query<FilaInstitucion>(
        `update instituciones set marca = $2::jsonb where id = $1 returning ${SELECCION}`,
        [antes.id, JSON.stringify(marca)],
      );

      if (Object.keys(cambios).length > 0) {
        await anotar(
          cliente,
          {
            accion: 'institucion.marca_actualizada',
            entidad: 'instituciones',
            entidadId: antes.id,
            datos: { cambios },
          },
          origen,
        );
      }

      return { marca: rows[0].marca };
    });
  }

  // ---------------------------------------------------------------------------
  // Escala de calificacion
  // ---------------------------------------------------------------------------
  /*
    La escala se guarda entera o no se guarda: un tramo suelto no significa
    nada. Antes de escribirla se comprueba que cubra de 0 a 100 sin huecos ni
    solapes, porque una nota que cae en un hueco no tiene traduccion posible y
    el error aparecería meses despues, al calificar.
  */
  async guardarEscala(sesion: Sesion, datos: EscalaDto, origen: Origen) {
    const tramos = [...datos.tramos].sort((a, b) => a.desde - b.desde);

    if (tramos.length < 2) {
      throw new BadRequestException('La escala necesita al menos dos tramos.');
    }

    for (const tramo of tramos) {
      if (tramo.desde > tramo.hasta) {
        throw new BadRequestException(
          `El tramo ${tramo.letra} empieza en ${tramo.desde} y termina en ${tramo.hasta}.`,
        );
      }
    }

    if (tramos[0].desde !== 0 || tramos[tramos.length - 1].hasta !== 100) {
      throw new BadRequestException('La escala debe cubrir de 0 a 100.');
    }

    for (let i = 1; i < tramos.length; i++) {
      const anterior = tramos[i - 1];
      const actual = tramos[i];
      if (actual.desde !== anterior.hasta + 1) {
        throw new BadRequestException(
          anterior.hasta >= actual.desde
            ? `Los tramos ${anterior.letra} y ${actual.letra} se solapan.`
            : `Entre ${anterior.letra} y ${actual.letra} quedan puntajes sin letra.`,
        );
      }
    }

    const letras = new Set(tramos.map((t) => t.letra.toUpperCase()));
    if (letras.size !== tramos.length) {
      throw new BadRequestException('Hay dos tramos con la misma letra.');
    }

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leerFila(cliente, sesion, true);
      const configuracion = { ...antes.configuracion, escala: tramos };

      await cliente.query(
        'update instituciones set configuracion = $2::jsonb where id = $1',
        [antes.id, JSON.stringify(configuracion)],
      );

      await anotar(
        cliente,
        {
          accion: 'institucion.escala_actualizada',
          entidad: 'instituciones',
          entidadId: antes.id,
          datos: { antes: this.escalaDe(antes), despues: tramos },
        },
        origen,
      );

      return { escala: tramos };
    });
  }

  // ---------------------------------------------------------------------------
  // Dominios de correo
  // ---------------------------------------------------------------------------
  async agregarDominio(sesion: Sesion, datos: CrearDominioDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const institucionId = institucionDe(sesion);

      const { rows } = await cliente.query<{ id: string }>(
        `insert into dominios_institucion
           (institucion_id, dominio, autoafiliar, rol_por_defecto)
         values ($1, $2::citext, $3, $4::rol_institucional)
         returning id`,
        [
          institucionId,
          datos.dominio,
          datos.autoafiliar ?? false,
          datos.rolPorDefecto ?? 'estudiante',
        ],
      );

      await anotar(
        cliente,
        {
          accion: 'dominio.agregado',
          entidad: 'dominios_institucion',
          entidadId: rows[0].id,
          datos: {
            dominio: datos.dominio,
            autoafiliar: datos.autoafiliar ?? false,
            rolPorDefecto: datos.rolPorDefecto ?? 'estudiante',
          },
        },
        origen,
      );

      return { dominios: await this.leerDominios(cliente, institucionId) };
    });
  }

  async actualizarDominio(
    sesion: Sesion,
    id: string,
    datos: ActualizarDominioDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const institucionId = institucionDe(sesion);

      const { rows } = await cliente.query<{
        dominio: string;
        autoafiliar: boolean;
        rolPorDefecto: string;
      }>(
        `update dominios_institucion set
            autoafiliar     = coalesce($2, autoafiliar),
            rol_por_defecto = coalesce($3::rol_institucional, rol_por_defecto)
          where id = $1
        returning dominio::text as dominio, autoafiliar,
                  rol_por_defecto::text as "rolPorDefecto"`,
        [id, datos.autoafiliar ?? null, datos.rolPorDefecto ?? null],
      );

      if (!rows[0]) throw new NotFoundException('Ese dominio no existe.');

      await anotar(
        cliente,
        {
          accion: 'dominio.actualizado',
          entidad: 'dominios_institucion',
          entidadId: id,
          datos: rows[0],
        },
        origen,
      );

      return { dominios: await this.leerDominios(cliente, institucionId) };
    });
  }

  async eliminarDominio(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const institucionId = institucionDe(sesion);

      const { rows } = await cliente.query<{ dominio: string }>(
        'delete from dominios_institucion where id = $1 returning dominio::text as dominio',
        [id],
      );

      if (!rows[0]) throw new NotFoundException('Ese dominio no existe.');

      await anotar(
        cliente,
        {
          accion: 'dominio.eliminado',
          entidad: 'dominios_institucion',
          entidadId: id,
          datos: { dominio: rows[0].dominio },
        },
        origen,
      );

      return { dominios: await this.leerDominios(cliente, institucionId) };
    });
  }

  /*
    Verificar un dominio es preguntarle al DNS, no a la base. La consulta va
    fuera de cualquier transaccion a proposito: es una llamada de red que puede
    tardar segundos, y sostener abierta una conexion del pool mientras tanto es
    regalar el recurso mas escaso que tiene la API.
  */
  async verificarDominio(sesion: Sesion, id: string, origen: Origen) {
    const institucionId = institucionDe(sesion);

    const fila = await this.bd.conContexto(
      contextoDe(sesion),
      async (cliente) => {
        const { rows } = await cliente.query<{
          dominio: string;
          verificadoEn: Date | null;
        }>(
          `select dominio::text as dominio, verificado_en as "verificadoEn"
           from dominios_institucion where id = $1`,
          [id],
        );
        return rows[0] ?? null;
      },
    );

    if (!fila) throw new NotFoundException('Ese dominio no existe.');

    const esperado = this.tokenDominio(institucionId, fila.dominio);

    let registros: string[][];
    try {
      registros = await resolveTxt(fila.dominio);
    } catch {
      throw new BadRequestException(
        `No se pudo leer el DNS de ${fila.dominio}. Si acabas de publicar el registro, puede tardar unos minutos en propagarse.`,
      );
    }

    // Un registro TXT largo llega partido en trozos; hay que unirlos.
    const encontrado = registros.some((partes) => partes.join('') === esperado);

    if (!encontrado) {
      throw new BadRequestException(
        `Todavia no aparece el registro TXT en ${fila.dominio}. Publica exactamente: ${esperado}`,
      );
    }

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      await cliente.query(
        'update dominios_institucion set verificado_en = now() where id = $1',
        [id],
      );

      await anotar(
        cliente,
        {
          accion: 'dominio.verificado',
          entidad: 'dominios_institucion',
          entidadId: id,
          datos: { dominio: fila.dominio },
        },
        origen,
      );

      return { dominios: await this.leerDominios(cliente, institucionId) };
    });
  }

  // ---------------------------------------------------------------------------
  // Archivar
  // ---------------------------------------------------------------------------
  /*
    Archivar no borra nada: cambia el estado y con eso deja de admitir accesos,
    porque elegirInstitucion rechaza las que no estan activas. Es la salida
    cuando una institucion deja de operar.

    Solo el propietario. El rol se comprueba aqui y no solo con el decorador
    porque el decorador acepta cualquiera de los roles que se le pasen, y aqui
    hace falta exactamente uno.
  */
  async archivar(sesion: Sesion, datos: ArchivarDto, origen: Origen) {
    if (!sesion.roles.includes('propietario')) {
      throw new ForbiddenException(
        'Solo el propietario puede archivar la institucion.',
      );
    }

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leerFila(cliente, sesion, true);

      if (
        datos.confirmacion.trim().toLowerCase() !==
        antes.nombre.trim().toLowerCase()
      ) {
        throw new BadRequestException(
          'Para archivar, escribe el nombre exacto de la institucion.',
        );
      }

      await cliente.query(
        `update instituciones set estado = 'archivada'::estado_institucion where id = $1`,
        [antes.id],
      );

      await anotar(
        cliente,
        {
          accion: 'institucion.archivada',
          entidad: 'instituciones',
          entidadId: antes.id,
          datos: { nombre: antes.nombre, estadoAnterior: antes.estado },
        },
        origen,
      );

      this.bitacora.warn(
        `Institucion ${antes.slug} archivada por ${sesion.correo}`,
      );
      return { archivada: true };
    });
  }

  // ---------------------------------------------------------------------------
  // Piezas internas
  // ---------------------------------------------------------------------------

  /*
    for update bloquea la fila hasta el commit. Sin eso, dos administradores
    guardando a la vez podrian leer el mismo estado previo y el segundo
    escribiria encima de los cambios del primero sin que nadie se entere.
  */
  private async leerFila(
    cliente: PoolClient,
    sesion: Sesion,
    bloquear = false,
  ): Promise<FilaInstitucion> {
    const { rows } = await cliente.query<FilaInstitucion>(
      `select ${SELECCION} from instituciones where id = $1${bloquear ? ' for update' : ''}`,
      [institucionDe(sesion)],
    );
    if (!rows[0]) throw new NotFoundException('Esa institucion ya no existe.');
    return rows[0];
  }

  private async leerDominios(
    cliente: PoolClient,
    institucionId: string,
  ): Promise<Dominio[]> {
    const { rows } = await cliente.query<
      Omit<Dominio, 'registroTxt' | 'verificado'>
    >(
      // Sin "where institucion_id": el aislamiento lo hace la politica, igual
      // que en el resto del sistema. El id que llega es solo para firmar el
      // registro TXT de cada dominio.
      `select id, dominio::text as dominio, autoafiliar,
              rol_por_defecto::text as "rolPorDefecto",
              verificado_en as "verificadoEn"
         from dominios_institucion
        order by verificado_en is not null, dominio`,
    );

    return rows.map((fila) => ({
      ...fila,
      verificado: fila.verificadoEn !== null,
      registroTxt: this.tokenDominio(institucionId, fila.dominio),
    }));
  }

  /*
    El valor que hay que publicar en el DNS. Se deriva de la institucion y el
    dominio con la clave del servidor en vez de guardarse en una columna: es
    estable, no se puede adivinar sin la clave, y no hace falta migrar nada
    para tenerlo.
  */
  private tokenDominio(institucionId: string, dominio: string): string {
    const firma = createHmac(
      'sha256',
      this.config.getOrThrow<string>('JWT_SECRETO'),
    )
      .update(`dominio:${institucionId}:${dominio}`)
      .digest('base64url')
      .slice(0, 32);
    return `dr360training-verificacion=${firma}`;
  }

  private escalaDe(fila: FilaInstitucion): Tramo[] {
    const guardada = fila.configuracion.escala;
    return Array.isArray(guardada) && guardada.length > 0
      ? (guardada as Tramo[])
      : ESCALA_POR_DEFECTO;
  }

  /* Lo que sale al navegador. configuracion entera no: lleva banderas internas. */
  private publica(fila: FilaInstitucion) {
    return {
      id: fila.id,
      slug: fila.slug,
      nombre: fila.nombre,
      siglas: fila.siglas,
      tipo: fila.tipo,
      estado: fila.estado,
      pais: fila.pais,
      zonaHoraria: fila.zonaHoraria,
      idioma: fila.idioma,
      correoSoporte: fila.correoSoporte,
      sitioWeb: fila.sitioWeb,
      descripcion: (fila.configuracion.descripcion as string | null) ?? null,
      marca: fila.marca,
      creadoEn: fila.creadoEn,
    };
  }
}

/* Quita las claves sin valor para que no pisen con undefined lo ya guardado. */
function limpiar(objeto: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, valor]) => valor !== undefined),
  );
}
