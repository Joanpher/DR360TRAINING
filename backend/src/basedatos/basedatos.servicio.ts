import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient } from 'pg';

export type Contexto = {
  usuarioId?: string | null;
  institucionId?: string | null;
};

/*
  Dos pools, uno por rol de conexion, tal como los creo la migracion 0001:

    negocio   (educa_app)   todo lo demas, siempre con contexto fijado
    identidad (educa_auth)  login, registro, refresco, invitaciones

  El aislamiento entre instituciones no lo hace este servicio ni ningun
  repositorio: lo hace Postgres con las politicas de RLS. Aqui solo se fija el
  contexto de la transaccion y se confia en la base. Por eso ninguna consulta de
  la aplicacion lleva "where institucion_id = ...": si lo llevara, el dia que a
  alguien se le olvide no habria ningun error, solo datos de otra universidad.
*/
@Injectable()
export class BaseDatos implements OnModuleDestroy {
  private readonly bitacora = new Logger(BaseDatos.name);
  private readonly negocio: Pool;
  private readonly identidad: Pool;

  constructor(config: ConfigService) {
    const crear = (url: string | undefined, nombre: string) => {
      if (!url) throw new Error(`falta ${nombre} en el entorno`);
      return new Pool({
        connectionString: url,
        // RDS presenta un certificado de su propia CA. En produccion conviene
        // cargar el bundle de AWS y pasar a rejectUnauthorized: true.
        ssl:
          url.includes('localhost') || url.includes('127.0.0.1')
            ? false
            : { rejectUnauthorized: false },
        /*
          En Vercel cada instancia de la funcion abre su propio pool y varias
          instancias conviven bajo carga. Con dos pools por instancia, diez
          conexiones cada uno se comen el cupo de RDS —que ademas comparte con
          otros proyectos— en cuanto llegan unos pocos usuarios. Cinco deja
          margen, y PG_POOL_MAX lo ajusta sin tocar codigo.
        */
        max: Number(config.get('PG_POOL_MAX') ?? 5),
        idleTimeoutMillis: 30_000,
        // Sin esto, una peticion se queda colgada esperando a RDS hasta que
        // la funcion agota su tiempo y el error no dice de que murio.
        connectionTimeoutMillis: 10_000,
      });
    };

    this.negocio = crear(config.get('DATABASE_URL_APP'), 'DATABASE_URL_APP');
    this.identidad = crear(
      config.get('DATABASE_URL_AUTH'),
      'DATABASE_URL_AUTH',
    );
  }

  /*
    Abre una transaccion en el pool de negocio, fija el contexto y ejecuta.

    El tercer parametro de set_config en true hace las variables locales a la
    transaccion: al terminar mueren con ella. Si fueran de sesion, la siguiente
    peticion que reutilizara esa conexion del pool heredaria el usuario de la
    anterior, que es exactamente la clase de fuga que este diseno evita.
  */
  async conContexto<T>(
    contexto: Contexto,
    trabajo: (cliente: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.enTransaccion(this.negocio, contexto, trabajo);
  }

  /*
    El pool de identidad. Sin contexto de institucion porque el login ocurre
    antes de que exista: el usuario todavia no ha dicho a donde quiere entrar,
    y en el registro ni siquiera existe.
  */
  async conIdentidad<T>(
    trabajo: (cliente: PoolClient) => Promise<T>,
    contexto: Contexto = {},
  ): Promise<T> {
    return this.enTransaccion(this.identidad, contexto, trabajo);
  }

  private async enTransaccion<T>(
    pool: Pool,
    contexto: Contexto,
    trabajo: (cliente: PoolClient) => Promise<T>,
  ): Promise<T> {
    const cliente = await pool.connect();
    try {
      await cliente.query('begin');
      await cliente.query('select set_config($1, $2, true)', [
        'app.usuario_id',
        contexto.usuarioId ?? '',
      ]);
      await cliente.query('select set_config($1, $2, true)', [
        'app.institucion_id',
        contexto.institucionId ?? '',
      ]);

      const resultado = await trabajo(cliente);
      await cliente.query('commit');
      return resultado;
    } catch (error) {
      await cliente.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      cliente.release();
    }
  }

  async onModuleDestroy() {
    await Promise.all([this.negocio.end(), this.identidad.end()]);
    this.bitacora.log('Pools cerrados');
  }
}
