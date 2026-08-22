import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { hashearContrasena } from '../auth/contrasenas';
import { anotar, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type {
  ActualizarInscripcionDto,
  InscribirDto,
} from './dto/inscripciones.dto';

export type Inscripcion = {
  id: string;
  cursoId: string;
  curso: string;
  codigoCurso: string;
  membresiaId: string;
  matricula: string | null;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  estado: string;
  inscritoEn: string;
  precio: string;
  descuento: string;
  total: string;
  facturado: string;
  pagado: string;
  deuda: string;
  calificacion: string | null;
  completadoEn: string | null;
};

/* Lo que el centro guarda de la persona, mas alla de su nombre y su correo. */
export type Ficha = {
  tipoDocumento: string;
  documento: string | null;
  fechaNacimiento: string | null;
  sexo: string | null;
  telefono: string | null;
  direccion: string | null;
  ocupacion: string | null;
  empresa: string | null;
  comoNosConocio: string | null;
  notas: string | null;
};

export type ResultadoInscripcion = {
  inscripcion: Inscripcion;
  /*
    La clave en claro, y solo cuando la persona es nueva. Es la unica vez que
    existe fuera del hash: se entrega a la secretaria para que la imprima o la
    dicte, y no se puede volver a consultar. Si se pierde, se genera otra.

    Null cuando se inscribe a alguien que ya era alumno del centro: esa persona
    ya tiene su clave y cambiarsela por apuntarse a otro curso seria hostil.
  */
  clave: string | null;
  matricula: string | null;
  esPersonaNueva: boolean;
  cargoGenerado: boolean;
};

/*
  Alfabeto sin caracteres que se confunden al leer una clave escrita a mano:
  fuera 0/O, 1/l/I, 5/S, 8/B. La clave se dicta por telefono; que sea legible
  importa mas que un bit extra de entropia.
*/
const ALFABETO = 'ACDEFGHJKMNPQRTUVWXY2346789';

function generarClave(largo = 10): string {
  let clave = '';
  for (let i = 0; i < largo; i++) clave += ALFABETO[randomInt(ALFABETO.length)];
  return clave;
}

/*
  Los montos viajan como texto, no como number.

  numeric(12,2) en Postgres tiene mas precision que el double de JavaScript, y
  convertirlo a number para volver a serializarlo es donde aparecen los 1499.99
  que deberian ser 1500.00. El navegador lo formatea para mostrarlo y lo manda
  de vuelta como numero solo cuando alguien escribe una cifra nueva.

  La cuenta de cada inscripcion se calcula en la base con un lateral y no en
  TypeScript sumando filas: sumar numeric en Postgres es exacto, sumar su
  equivalente en coma flotante no. Los cargos anulados y los condonados quedan
  fuera del facturado a proposito: siguen existiendo como historia, pero ya no
  se deben.
*/
const LISTA = `
  select i.id, i.curso_id as "cursoId", c.nombre as curso, c.codigo as "codigoCurso",
         i.membresia_id as "membresiaId", m.codigo as matricula,
         u.nombre_completo as nombre, u.correo::text as correo, p.telefono,
         i.estado::text as estado,
         to_char(i.inscrito_en, 'YYYY-MM-DD') as "inscritoEn",
         i.precio::text as precio, i.descuento::text as descuento,
         (i.precio - i.descuento)::text as total,
         cuenta.facturado::text as facturado,
         cuenta.pagado::text as pagado,
         (cuenta.facturado - cuenta.pagado)::text as deuda,
         i.calificacion::text as calificacion,
         to_char(i.completado_en, 'YYYY-MM-DD') as "completadoEn"
    from inscripciones i
    join cursos c on c.id = i.curso_id
    join membresias m on m.id = i.membresia_id
    join usuarios u on u.id = m.usuario_id
    left join participantes p on p.membresia_id = i.membresia_id
    left join lateral (
      select coalesce(sum(x.monto), 0) as facturado,
             coalesce(sum(x.pagado), 0) as pagado
        from (
          select g.monto,
                 coalesce((select sum(pg.monto) from pagos pg
                            where pg.cargo_id = g.id and pg.anulado_en is null), 0) as pagado
            from cargos g
           where g.inscripcion_id = i.id
             and g.estado in ('pendiente', 'pagado')
        ) x
    ) cuenta on true
`;

@Injectable()
export class InscripcionesServicio {
  private readonly bitacora = new Logger(InscripcionesServicio.name);

  constructor(private readonly bd: BaseDatos) {}

  // ---------------------------------------------------------------------------
  // Inscribir
  // ---------------------------------------------------------------------------
  /*
    El acto completo, en una sola transaccion salvo la clave:

      persona -> membresia con matricula -> ficha -> inscripcion -> cargo

    Que vaya todo junto no es comodidad: una inscripcion a medias -alguien con
    matricula pero sin curso, o en el curso pero sin cargo- es justo el estado
    que nadie descubre hasta que pasa algo raro dos meses despues.

    La clave es la excepcion y va aparte. El rol de negocio no tiene permiso de
    escritura sobre usuarios.hash_contrasena -solo el de identidad lo tiene- y
    eso es deliberado: mantiene la superficie de escritura de contrasenas en un
    solo modulo. El orden elegido hace que el fallo sea benigno: si la clave no
    llega a ponerse, la persona queda inscrita y sin poder entrar, que se
    arregla regenerandola, en vez de quedar un usuario huerfano sin membresia.
  */
  async inscribir(
    sesion: Sesion,
    datos: InscribirDto,
    origen: Origen,
  ): Promise<ResultadoInscripcion> {
    const esPersonaNueva = !datos.membresiaId;

    if (esPersonaNueva && (!datos.nombres || !datos.apellidos)) {
      throw new BadRequestException(
        'Elige a alguien que ya sea alumno del centro o escribe el nombre y los apellidos de quien entra.',
      );
    }

    const institucionId = institucionDe(sesion);
    const clave = esPersonaNueva ? generarClave() : null;

    const resultado = await this.bd.conContexto(
      contextoDe(sesion),
      async (cliente) => {
        const curso = await this.leerCursoParaInscribir(cliente, datos.cursoId);

        const descuento = datos.descuento ?? 0;
        if (descuento > Number(curso.precio)) {
          throw new BadRequestException(
            `El descuento no puede pasar del precio del curso (${curso.precio}).`,
          );
        }

        let membresiaId: string;
        let usuarioId: string | null = null;
        let matricula: string | null = null;

        if (datos.membresiaId) {
          const alumno = await this.leerAlumno(cliente, datos.membresiaId);
          membresiaId = datos.membresiaId;
          matricula = alumno.matricula;
        } else {
          const nuevo = await this.crearPersona(cliente, institucionId, datos);
          membresiaId = nuevo.membresiaId;
          usuarioId = nuevo.usuarioId;
          matricula = nuevo.matricula;
        }

        const { rows: inscripcion } = await cliente.query<{ id: string }>(
          `insert into inscripciones
           (institucion_id, curso_id, membresia_id, estado, precio, descuento, observaciones)
         values ($1, $2, $3, $4::estado_inscripcion, $5::numeric, $6::numeric, $7)
         returning id`,
          [
            institucionId,
            datos.cursoId,
            membresiaId,
            datos.estado ?? 'activa',
            curso.precio,
            descuento,
            datos.observaciones ?? null,
          ],
        );
        const inscripcionId = inscripcion[0].id;

        const total = Number(curso.precio) - descuento;
        const cargoGenerado = !datos.sinCobro && total > 0;

        if (cargoGenerado) {
          await cliente.query(
            `insert into cargos
             (institucion_id, inscripcion_id, descripcion, monto, vence_en)
           values ($1, $2, $3, $4::numeric, $5::date)`,
            [
              institucionId,
              inscripcionId,
              `${curso.codigo} · ${curso.nombre}`,
              total.toFixed(2),
              // Vence el dia que empieza el curso, o el mismo dia si ya empezo o
              // no tiene fecha. Cobrar despues de que la clase arranco es como se
              // acumulan las deudas que nadie reclama.
              curso.iniciaEn,
            ],
          );
        }

        await anotar(
          cliente,
          {
            accion: 'inscripcion.creada',
            entidad: 'inscripciones',
            entidadId: inscripcionId,
            datos: {
              curso: `${curso.codigo} ${curso.nombre}`,
              matricula,
              personaNueva: esPersonaNueva,
              precio: curso.precio,
              descuento: descuento.toFixed(2),
              cargoGenerado,
            },
          },
          origen,
        );

        const { rows } = await cliente.query<Inscripcion>(
          `${LISTA} where i.id = $1`,
          [inscripcionId],
        );

        return { inscripcion: rows[0], usuarioId, matricula, cargoGenerado };
      },
    );

    // La clave, en su propia transaccion y con el rol de identidad.
    if (clave && resultado.usuarioId) {
      const hash = await hashearContrasena(clave);
      await this.bd.conIdentidad((cliente) =>
        cliente.query(
          `update usuarios set hash_contrasena = $2 where id = $1`,
          [resultado.usuarioId, hash],
        ),
      );
      this.bitacora.log(
        `Matricula ${resultado.matricula} emitida por ${sesion.correo}`,
      );
    }

    return {
      inscripcion: resultado.inscripcion,
      clave,
      matricula: resultado.matricula,
      esPersonaNueva,
      cargoGenerado: resultado.cargoGenerado,
    };
  }

  /*
    Vuelve a emitir la clave de un alumno. Se usa cuando se pierde, que ocurre
    constantemente. La anterior deja de servir en el acto.
  */
  async regenerarClave(sesion: Sesion, inscripcionId: string, origen: Origen) {
    const clave = generarClave();

    const { usuarioId, matricula, nombre } = await this.bd.conContexto(
      contextoDe(sesion),
      async (cliente) => {
        const { rows } = await cliente.query<{
          usuarioId: string;
          matricula: string | null;
          nombre: string;
        }>(
          `select m.usuario_id as "usuarioId", m.codigo as matricula,
                  u.nombre_completo as nombre
             from inscripciones i
             join membresias m on m.id = i.membresia_id
             join usuarios u on u.id = m.usuario_id
            where i.id = $1`,
          [inscripcionId],
        );
        if (!rows[0]) throw new NotFoundException('Esa inscripcion no existe.');

        await anotar(
          cliente,
          {
            accion: 'alumno.clave_regenerada',
            entidad: 'inscripciones',
            entidadId: inscripcionId,
            datos: { matricula: rows[0].matricula, nombre: rows[0].nombre },
          },
          origen,
        );

        return rows[0];
      },
    );

    const hash = await hashearContrasena(clave);
    await this.bd.conIdentidad(async (cliente) => {
      await cliente.query(
        `update usuarios set hash_contrasena = $2, intentos_fallidos = 0,
                             bloqueado_hasta = null
          where id = $1`,
        [usuarioId, hash],
      );
      // Las sesiones abiertas con la clave vieja dejan de valer: si alguien
      // conocia la anterior, cambiarla tiene que echarlo fuera.
      await cliente.query(
        `update sesiones set revocada_en = now(), motivo_revocacion = 'clave regenerada'
          where usuario_id = $1 and revocada_en is null`,
        [usuarioId],
      );
    });

    return { matricula, nombre, clave };
  }

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  async listar(
    sesion: Sesion,
    filtros: {
      cursoId?: string;
      estado?: string;
      conDeuda?: boolean;
      busqueda?: string;
      pagina?: number;
      porPagina?: number;
    },
  ) {
    const pagina = filtros.pagina ?? 1;
    const porPagina = filtros.porPagina ?? 25;

    const condiciones: string[] = [];
    const valores: unknown[] = [];

    if (filtros.cursoId) {
      valores.push(filtros.cursoId);
      condiciones.push(`i.curso_id = $${valores.length}`);
    }
    if (filtros.estado) {
      valores.push(filtros.estado);
      condiciones.push(`i.estado = $${valores.length}::estado_inscripcion`);
    }
    if (filtros.busqueda) {
      valores.push(`%${filtros.busqueda}%`);
      const n = valores.length;
      condiciones.push(
        `(u.nombre_completo ilike $${n} or m.codigo ilike $${n} or c.nombre ilike $${n})`,
      );
    }
    if (filtros.conDeuda) {
      condiciones.push(`cuenta.facturado > cuenta.pagado`);
    }

    const donde = condiciones.length
      ? `where ${condiciones.join(' and ')}`
      : '';

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      /*
        El total se cuenta sobre la misma consulta y no sobre un from mas corto:
        el filtro de deuda vive en el lateral, asi que un count que no lo
        incluyera devolveria un numero distinto del que se esta paginando.
      */
      const { rows: total } = await cliente.query<{ total: number }>(
        `select count(*)::int as total from (${LISTA} ${donde}) t`,
        valores,
      );

      const { rows: inscripciones } = await cliente.query<Inscripcion>(
        `${LISTA} ${donde} order by i.inscrito_en desc, u.nombre_completo
          limit $${valores.length + 1} offset $${valores.length + 2}`,
        [...valores, porPagina, (pagina - 1) * porPagina],
      );

      return { inscripciones, total: total[0].total, pagina, porPagina };
    });
  }

  /* La ficha completa: quien es, que lleva y que debe. */
  async detalle(sesion: Sesion, id: string) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Inscripcion>(
        `${LISTA} where i.id = $1`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('Esa inscripcion no existe.');

      const { rows: ficha } = await cliente.query<Ficha>(
        `select p.tipo_documento::text as "tipoDocumento", p.documento,
                to_char(p.fecha_nacimiento, 'YYYY-MM-DD') as "fechaNacimiento",
                p.sexo::text as sexo, p.telefono, p.direccion, p.ocupacion,
                p.empresa, p.como_nos_conocio as "comoNosConocio", p.notas
           from participantes p
          where p.membresia_id = $1`,
        [rows[0].membresiaId],
      );

      /* Los otros cursos de la misma persona. Es lo primero que se pregunta
         cuando alguien llama: "que mas ha llevado aqui". */
      const { rows: otrosCursos } = await cliente.query(
        `select i.id, c.codigo, c.nombre, i.estado::text as estado,
                to_char(i.inscrito_en, 'YYYY-MM-DD') as "inscritoEn"
           from inscripciones i
           join cursos c on c.id = i.curso_id
          where i.membresia_id = $1 and i.id <> $2
          order by i.inscrito_en desc`,
        [rows[0].membresiaId, id],
      );

      const { rows: cargos } = await cliente.query(
        `select g.id, g.descripcion, g.monto::text as monto,
                to_char(g.vence_en, 'YYYY-MM-DD') as "venceEn",
                g.estado::text as estado, g.motivo,
                coalesce((select sum(p.monto) from pagos p
                           where p.cargo_id = g.id and p.anulado_en is null), 0)::text as pagado
           from cargos g
          where g.inscripcion_id = $1
          order by g.creado_en`,
        [id],
      );

      const { rows: pagos } = await cliente.query(
        `select p.id, p.cargo_id as "cargoId", p.monto::text as monto,
                p.metodo::text as metodo, p.referencia,
                to_char(p.recibido_en, 'YYYY-MM-DD') as "recibidoEn",
                p.nota, p.anulado_en is not null as anulado,
                u.nombre_completo as "registradoPor"
           from pagos p
           join cargos g on g.id = p.cargo_id
           left join usuarios u on u.id = p.registrado_por
          where g.inscripcion_id = $1
          order by p.recibido_en desc, p.creado_en desc`,
        [id],
      );

      return {
        inscripcion: rows[0],
        ficha: ficha[0] ?? null,
        otrosCursos,
        cargos,
        pagos,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Cambios de estado
  // ---------------------------------------------------------------------------
  /*
    Completar, retirar o cancelar. Las fechas no las escribe quien administra:
    las pone el sistema al cambiar el estado, porque "completado el 3 de marzo"
    y "estado completada" no pueden contradecirse.
  */
  async actualizar(
    sesion: Sesion,
    id: string,
    datos: ActualizarInscripcionDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows: antes } = await cliente.query<{
        estado: string;
        nombre: string;
        curso: string;
      }>(
        `select i.estado::text as estado, u.nombre_completo as nombre, c.nombre as curso
           from inscripciones i
           join cursos c on c.id = i.curso_id
           join membresias m on m.id = i.membresia_id
           join usuarios u on u.id = m.usuario_id
          where i.id = $1
          for update of i`,
        [id],
      );
      if (!antes[0]) throw new NotFoundException('Esa inscripcion no existe.');

      const estado = datos.estado ?? antes[0].estado;

      await cliente.query(
        `update inscripciones set
            estado = $2::estado_inscripcion,
            calificacion = coalesce($3::numeric, calificacion),
            completado_en = case when $2 = 'completada'
                                 then coalesce(completado_en, current_date) end,
            retirado_en   = case when $2 in ('retirada', 'cancelada')
                                 then coalesce(retirado_en, current_date) end,
            motivo_retiro = case when $2 in ('retirada', 'cancelada')
                                 then coalesce($4, motivo_retiro) end,
            observaciones = coalesce($5, observaciones)
          where id = $1`,
        [
          id,
          estado,
          datos.calificacion ?? null,
          datos.motivoRetiro ?? null,
          datos.observaciones ?? null,
        ],
      );

      await anotar(
        cliente,
        {
          accion: 'inscripcion.actualizada',
          entidad: 'inscripciones',
          entidadId: id,
          datos: {
            nombre: antes[0].nombre,
            curso: antes[0].curso,
            estadoAntes: antes[0].estado,
            estadoDespues: estado,
            calificacion: datos.calificacion ?? null,
          },
        },
        origen,
      );

      const { rows } = await cliente.query<Inscripcion>(
        `${LISTA} where i.id = $1`,
        [id],
      );
      return { inscripcion: rows[0] };
    });
  }

  // ---------------------------------------------------------------------------
  // Piezas internas
  // ---------------------------------------------------------------------------

  /*
    ITC-2026-0001. Las siglas van delante porque la plataforma vive en un solo
    dominio: al entrar hay que poder distinguir de que centro es la matricula
    sin preguntarselo a quien la escribe.

    El numero sale de un contador atomico y no de un max()+1, que con dos
    personas inscribiendo a la vez daria la misma matricula a dos alumnos.

    El ano es el natural: aqui no hay ano lectivo que sirva de espacio de
    numeracion, y una matricula sin ano no dice cuando entro nadie.
  */
  private async siguienteMatricula(
    cliente: PoolClient,
    institucionId: string,
    siglas: string | null | undefined,
  ): Promise<string> {
    const prefijo =
      (siglas ?? 'EDU').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'EDU';
    const ano = String(new Date().getFullYear());

    const { rows } = await cliente.query<{ valor: number }>(
      `select app.siguiente_numero($1, $2) as valor`,
      [institucionId, `matricula:${ano}`],
    );

    return `${prefijo}-${ano}-${String(rows[0].valor).padStart(4, '0')}`;
  }

  private async leerCursoParaInscribir(cliente: PoolClient, cursoId: string) {
    const { rows } = await cliente.query<{
      codigo: string;
      nombre: string;
      estado: string;
      precio: string;
      cupo: number | null;
      iniciaEn: string | null;
      inscritos: number;
    }>(
      `select c.codigo, c.nombre,
              app.estado_curso_por_fechas(c.inicia_en, c.termina_en)::text as estado,
              c.precio::text as precio,
              c.cupo,
              coalesce(to_char(greatest(c.inicia_en, current_date), 'YYYY-MM-DD'),
                       to_char(current_date, 'YYYY-MM-DD')) as "iniciaEn",
              (select count(*)::int from inscripciones i
                where i.curso_id = c.id
                  and i.estado in ('preinscrita', 'activa')) as inscritos
         from cursos c
        where c.id = $1 and c.eliminado_en is null
        for update of c`,
      [cursoId],
    );

    const curso = rows[0];
    if (!curso) throw new NotFoundException('Ese curso no existe.');

    if (curso.estado === 'graduado') {
      throw new BadRequestException(
        `${curso.codigo} ya termino: no admite nuevas inscripciones.`,
      );
    }

    /*
      El cupo es una decision del centro, no un limite tecnico, pero pasarlo sin
      darse cuenta es como aparecen aulas de treinta sillas con treinta y cinco
      personas dentro. El "for update" de arriba es lo que hace fiable esta
      cuenta: sin el, dos inscripciones simultaneas leerian el mismo total y
      ambas pasarian.
    */
    if (curso.cupo !== null && curso.inscritos >= curso.cupo) {
      throw new BadRequestException(
        `${curso.codigo} ya tiene ${curso.inscritos} de ${curso.cupo} cupos ocupados.`,
      );
    }

    return curso;
  }

  private async leerAlumno(cliente: PoolClient, membresiaId: string) {
    const { rows } = await cliente.query<{
      matricula: string | null;
      nombre: string;
    }>(
      `select m.codigo as matricula, u.nombre_completo as nombre
         from membresias m
         join usuarios u on u.id = m.usuario_id
        where m.id = $1 and m.estado = 'activa' and m.eliminado_en is null`,
      [membresiaId],
    );
    if (!rows[0]) {
      throw new NotFoundException(
        'Esa persona no existe o su membresia no esta activa.',
      );
    }
    return rows[0];
  }

  /*
    Alta completa de alguien que nunca habia pisado el centro: cuenta, membresia
    con matricula, rol de estudiante y ficha. La clave se pone despues, fuera de
    esta transaccion, por el reparto de permisos entre los dos roles de conexion.

    Las tres primeras las hace app.crear_alumno() y no un insert aqui, y no es un
    capricho de estilo: "insert into usuarios ... returning id" es imposible desde
    el rol de negocio. Con RLS, un insert que devuelve filas tiene que pasar
    tambien las politicas de select, y usuarios_lectura solo deja ver a quien
    comparte institucion contigo. La persona recien creada todavia no comparte
    ninguna -su membresia se inserta justo despues-, asi que la fila se escribe
    bien y al devolverla la politica la tapa.

    Es el mismo huevo y la misma gallina que resolvio app.crear_institucion(), y
    se resuelve con la misma herramienta: una funcion SECURITY DEFINER que hace
    el ciclo entero de una vez y comprueba el permiso por su cuenta.
  */
  private async crearPersona(
    cliente: PoolClient,
    institucionId: string,
    datos: InscribirDto,
  ) {
    const { rows: siglas } = await cliente.query<{ siglas: string | null }>(
      `select siglas from instituciones where id = $1`,
      [institucionId],
    );

    const matricula = await this.siguienteMatricula(
      cliente,
      institucionId,
      siglas[0]?.siglas,
    );

    const { rows: alta } = await cliente.query<{
      usuarioId: string;
      membresiaId: string;
    }>(
      `select usuario_id as "usuarioId", membresia_id as "membresiaId"
         from app.crear_alumno($1, $2, $3::citext, $4, $5)`,
      [
        datos.nombres,
        datos.apellidos,
        datos.correo ?? null,
        datos.telefono ?? null,
        matricula,
      ],
    );
    const { usuarioId, membresiaId } = alta[0];

    await cliente.query(
      `insert into participantes
         (membresia_id, institucion_id, tipo_documento, documento, fecha_nacimiento,
          sexo, telefono, direccion, ocupacion, empresa, como_nos_conocio, notas)
       values ($1, $2, $3::tipo_documento, $4, $5::date, $6::sexo_persona, $7, $8,
               $9, $10, $11, $12)`,
      [
        membresiaId,
        institucionId,
        datos.tipoDocumento ?? 'cedula',
        datos.documento ?? null,
        datos.fechaNacimiento ?? null,
        datos.sexo ?? null,
        datos.telefono ?? null,
        datos.direccion ?? null,
        datos.ocupacion ?? null,
        datos.empresa ?? null,
        datos.comoNosConocio ?? null,
        datos.notas ?? null,
      ],
    );

    return { usuarioId, membresiaId, matricula };
  }
}
