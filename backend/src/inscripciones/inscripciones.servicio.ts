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
import type { InscribirDto, RepresentanteDto } from './dto/inscripciones.dto';

export type Inscripcion = {
  id: string;
  membresiaId: string;
  matricula: string;
  nombre: string;
  estado: string;
  seccionId: string;
  seccion: string;
  grado: string;
  anoEscolarId: string;
  ano: string;
  inscritoEn: string;
  cursos: number;
  representante: string | null;
  telefono: string | null;
  deuda: string;
};

export type ResultadoInscripcion = {
  inscripcion: Inscripcion;
  /*
    La clave en claro. Es la unica vez que existe fuera del hash: se entrega a
    la secretaria para que la imprima o se la diga a la familia, y no se puede
    volver a consultar. Si se pierde, se genera otra.
  */
  clave: string;
  cursosAsignados: number;
  cargosGenerados: number;
};

/*
  Alfabeto sin caracteres que se confunden al leer una clave escrita a mano:
  fuera 0/O, 1/l/I, 5/S, 8/B. La clave se dicta por telefono a una madre; que
  sea legible importa mas que un bit extra de entropia.
*/
const ALFABETO = 'ACDEFGHJKMNPQRTUVWXY2346789';

function generarClave(largo = 10): string {
  let clave = '';
  for (let i = 0; i < largo; i++) clave += ALFABETO[randomInt(ALFABETO.length)];
  return clave;
}

const LISTA = `
  select i.id, i.membresia_id as "membresiaId", m.codigo as matricula,
         u.nombre_completo as nombre, i.estado::text as estado,
         i.seccion_id as "seccionId",
         (g.nombre || ' ' || s.nombre) as seccion, g.nombre as grado,
         i.ano_escolar_id as "anoEscolarId", a.codigo as ano,
         to_char(i.inscrito_en, 'YYYY-MM-DD') as "inscritoEn",
         (select count(*)::int from curso_estudiantes ce
           where ce.inscripcion_id = i.id and ce.retirado_en is null) as cursos,
         (select r.nombre_completo
            from estudiante_representantes er
            join representantes r on r.id = er.representante_id
           where er.membresia_id = i.membresia_id and er.es_principal
           limit 1) as representante,
         (select r.telefono
            from estudiante_representantes er
            join representantes r on r.id = er.representante_id
           where er.membresia_id = i.membresia_id and er.es_principal
           limit 1) as telefono,
         coalesce((
           select sum(c.monto) - coalesce(sum(
                    (select sum(p.monto) from pagos p
                      where p.cargo_id = c.id and p.anulado_en is null)), 0)
             from cargos c
            where c.inscripcion_id = i.id and c.estado = 'pendiente'
         ), 0)::text as deuda
    from inscripciones i
    join membresias m on m.id = i.membresia_id
    join usuarios u on u.id = m.usuario_id
    join secciones s on s.id = i.seccion_id
    join grados g on g.id = s.grado_id
    join anos_escolares a on a.id = i.ano_escolar_id
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

      persona -> membresia con matricula -> expediente -> representantes
      -> inscripcion en la seccion -> alta en todos sus cursos -> cargos

    Que vaya todo junto no es comodidad: una inscripcion a medias -un nino con
    matricula pero sin cursos, o con cursos pero sin cargo de inscripcion- es
    justo el estado que nadie descubre hasta que pasa algo raro dos meses
    despues.

    La clave es la excepcion y va aparte. El rol de negocio no tiene permiso de
    escritura sobre usuarios.hash_contrasena -solo el de identidad lo tiene- y
    eso es deliberado: mantiene la superficie de escritura de contrasenas en un
    solo modulo. El orden elegido hace que el fallo sea benigno: si la clave no
    llega a ponerse, el estudiante queda inscrito y sin poder entrar, que se
    arregla regenerandola, en vez de quedar un usuario huerfano sin membresia.
  */
  async inscribir(
    sesion: Sesion,
    datos: InscribirDto,
    origen: Origen,
  ): Promise<ResultadoInscripcion> {
    const institucionId = institucionDe(sesion);
    const clave = generarClave();

    const resultado = await this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const seccion = await this.leerSeccionParaInscribir(cliente, datos.seccionId);

      const { rows: siglas } = await cliente.query<{ siglas: string | null }>(
        `select siglas from instituciones where id = $1`,
        [institucionId],
      );

      const matricula = await this.siguienteMatricula(
        cliente,
        institucionId,
        siglas[0]?.siglas,
        seccion.anoCodigo,
      );

      // --- La persona --------------------------------------------------------
      const { rows: usuario } = await cliente.query<{ id: string }>(
        `insert into usuarios (correo, nombres, apellidos, estado)
         values ($1::citext, $2, $3, 'activo')
         returning id`,
        [datos.correo ?? null, datos.nombres, datos.apellidos],
      );
      const usuarioId = usuario[0].id;

      // --- Su membresia en este colegio --------------------------------------
      const { rows: membresia } = await cliente.query<{ id: string }>(
        `insert into membresias
           (institucion_id, usuario_id, codigo, estado, sede_id, ingreso_en)
         values ($1, $2, $3, 'activa', $4, current_date)
         returning id`,
        [institucionId, usuarioId, matricula, seccion.sedeId],
      );
      const membresiaId = membresia[0].id;

      await cliente.query(
        `insert into membresia_roles (membresia_id, institucion_id, rol, asignado_por)
         values ($1, $2, 'estudiante', $3)`,
        [membresiaId, institucionId, sesion.usuarioId],
      );

      // --- Su expediente -----------------------------------------------------
      await cliente.query(
        `insert into estudiantes
           (membresia_id, institucion_id, tipo_documento, documento, fecha_nacimiento,
            sexo, nacionalidad, lugar_nacimiento, direccion, telefono_casa,
            tipo_sangre, condiciones_medicas, alergias, colegio_procedencia,
            observaciones)
         values ($1, $2, $3::tipo_documento, $4, $5::date, $6::sexo_persona, $7, $8,
                 $9, $10, $11, $12, $13, $14, $15)`,
        [
          membresiaId,
          institucionId,
          datos.tipoDocumento ?? 'acta_nacimiento',
          datos.documento ?? null,
          datos.fechaNacimiento ?? null,
          datos.sexo ?? null,
          datos.nacionalidad ?? 'Dominicana',
          datos.lugarNacimiento ?? null,
          datos.direccion ?? null,
          datos.telefonoCasa ?? null,
          datos.tipoSangre ?? null,
          datos.condicionesMedicas ?? null,
          datos.alergias ?? null,
          datos.colegioProcedencia ?? null,
          datos.observaciones ?? null,
        ],
      );

      await this.enlazarRepresentantes(
        cliente,
        institucionId,
        membresiaId,
        datos.representantes,
      );

      // --- La inscripcion ----------------------------------------------------
      const { rows: inscripcion } = await cliente.query<{ id: string }>(
        `insert into inscripciones
           (institucion_id, ano_escolar_id, membresia_id, seccion_id, estado)
         values ($1, $2, $3, $4, 'inscrito')
         returning id`,
        [institucionId, seccion.anoEscolarId, membresiaId, datos.seccionId],
      );
      const inscripcionId = inscripcion[0].id;

      const cursosAsignados = await this.matricularEnCursos(
        cliente,
        institucionId,
        inscripcionId,
        datos.seccionId,
      );

      const cargosGenerados = datos.sinCobros
        ? 0
        : await this.generarCargos(
            cliente,
            institucionId,
            inscripcionId,
            seccion.anoEscolarId,
            seccion.anoInicio,
            datos.conceptos,
          );

      await anotar(
        cliente,
        {
          accion: 'estudiante.inscrito',
          entidad: 'inscripciones',
          entidadId: inscripcionId,
          datos: {
            matricula,
            nombre: `${datos.nombres} ${datos.apellidos}`,
            seccion: `${seccion.grado} ${seccion.nombre}`,
            ano: seccion.anoCodigo,
            cursosAsignados,
            cargosGenerados,
          },
        },
        origen,
      );

      const { rows } = await cliente.query<Inscripcion>(`${LISTA} where i.id = $1`, [
        inscripcionId,
      ]);

      return { inscripcion: rows[0], usuarioId, cursosAsignados, cargosGenerados };
    });

    // La clave, en su propia transaccion y con el rol de identidad.
    const hash = await hashearContrasena(clave);
    await this.bd.conIdentidad((cliente) =>
      cliente.query(`update usuarios set hash_contrasena = $2 where id = $1`, [
        resultado.usuarioId,
        hash,
      ]),
    );

    this.bitacora.log(
      `Matricula ${resultado.inscripcion.matricula} emitida por ${sesion.correo}`,
    );

    return {
      inscripcion: resultado.inscripcion,
      clave,
      cursosAsignados: resultado.cursosAsignados,
      cargosGenerados: resultado.cargosGenerados,
    };
  }

  /*
    Vuelve a emitir la clave de un estudiante. Se usa cuando la familia la
    pierde, que ocurre constantemente. La anterior deja de servir en el acto.
  */
  async regenerarClave(sesion: Sesion, inscripcionId: string, origen: Origen) {
    const clave = generarClave();

    const { usuarioId, matricula, nombre } = await this.bd.conContexto(
      contextoDe(sesion),
      async (cliente) => {
        const { rows } = await cliente.query<{
          usuarioId: string;
          matricula: string;
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
            accion: 'estudiante.clave_regenerada',
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
      anoEscolarId?: string;
      seccionId?: string;
      estado?: string;
      busqueda?: string;
      pagina?: number;
      porPagina?: number;
    },
  ) {
    const pagina = filtros.pagina ?? 1;
    const porPagina = filtros.porPagina ?? 25;

    const condiciones: string[] = [];
    const valores: unknown[] = [];

    if (filtros.anoEscolarId) {
      valores.push(filtros.anoEscolarId);
      condiciones.push(`i.ano_escolar_id = $${valores.length}`);
    }
    if (filtros.seccionId) {
      valores.push(filtros.seccionId);
      condiciones.push(`i.seccion_id = $${valores.length}`);
    }
    if (filtros.estado) {
      valores.push(filtros.estado);
      condiciones.push(`i.estado = $${valores.length}::estado_inscripcion`);
    }
    if (filtros.busqueda) {
      valores.push(`%${filtros.busqueda}%`);
      const n = valores.length;
      condiciones.push(`(u.nombre_completo ilike $${n} or m.codigo ilike $${n})`);
    }

    const donde = condiciones.length ? `where ${condiciones.join(' and ')}` : '';

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows: total } = await cliente.query<{ total: number }>(
        `select count(*)::int as total
           from inscripciones i
           join membresias m on m.id = i.membresia_id
           join usuarios u on u.id = m.usuario_id
         ${donde}`,
        valores,
      );

      const { rows: inscripciones } = await cliente.query<Inscripcion>(
        `${LISTA} ${donde} order by g.nivel, g.orden, s.nombre, u.nombre_completo
          limit $${valores.length + 1} offset $${valores.length + 2}`,
        [...valores, porPagina, (pagina - 1) * porPagina],
      );

      return { inscripciones, total: total[0].total, pagina, porPagina };
    });
  }

  /* El expediente completo: quien es, quien responde por el y que debe. */
  async detalle(sesion: Sesion, id: string) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Inscripcion>(`${LISTA} where i.id = $1`, [id]);
      if (!rows[0]) throw new NotFoundException('Esa inscripcion no existe.');

      const { rows: expediente } = await cliente.query(
        `select e.tipo_documento::text as "tipoDocumento", e.documento,
                to_char(e.fecha_nacimiento, 'YYYY-MM-DD') as "fechaNacimiento",
                e.sexo::text as sexo, e.nacionalidad, e.lugar_nacimiento as "lugarNacimiento",
                e.direccion, e.telefono_casa as "telefonoCasa", e.tipo_sangre as "tipoSangre",
                e.condiciones_medicas as "condicionesMedicas", e.alergias,
                e.colegio_procedencia as "colegioProcedencia", e.observaciones,
                u.correo::text as correo
           from estudiantes e
           join membresias m on m.id = e.membresia_id
           join usuarios u on u.id = m.usuario_id
          where e.membresia_id = $1`,
        [rows[0].membresiaId],
      );

      const { rows: representantes } = await cliente.query(
        `select r.id, r.nombres, r.apellidos, r.nombre_completo as "nombreCompleto",
                r.documento, r.telefono, r.telefono_trabajo as "telefonoTrabajo",
                r.correo::text as correo, r.direccion, r.ocupacion,
                r.lugar_trabajo as "lugarTrabajo",
                er.parentesco::text as parentesco, er.es_principal as "esPrincipal",
                er.puede_retirar as "puedeRetirar"
           from estudiante_representantes er
           join representantes r on r.id = er.representante_id
          where er.membresia_id = $1
          order by er.es_principal desc, r.nombre_completo`,
        [rows[0].membresiaId],
      );

      const { rows: cursos } = await cliente.query(
        `select c.id, a.codigo as "codigoAsignatura", a.nombre as asignatura,
                ud.nombre_completo as docente, c.estado::text as estado
           from curso_estudiantes ce
           join cursos c on c.id = ce.curso_id
           join asignaturas a on a.id = c.asignatura_id
           left join membresias md on md.id = c.docente_membresia_id
           left join usuarios ud on ud.id = md.usuario_id
          where ce.inscripcion_id = $1 and ce.retirado_en is null
          order by a.nombre`,
        [id],
      );

      const { rows: cargos } = await cliente.query(
        `select c.id, c.descripcion, c.monto::text as monto, c.cuota,
                to_char(c.vence_en, 'YYYY-MM-DD') as "venceEn",
                c.estado::text as estado,
                coalesce((select sum(p.monto) from pagos p
                           where p.cargo_id = c.id and p.anulado_en is null), 0)::text as pagado
           from cargos c
          where c.inscripcion_id = $1
          order by c.cuota nulls first, c.vence_en`,
        [id],
      );

      return {
        inscripcion: rows[0],
        expediente: expediente[0] ?? null,
        representantes,
        cursos,
        cargos,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Piezas internas
  // ---------------------------------------------------------------------------

  /*
    LGL-2026-0001. Las siglas van delante porque la plataforma vive en un solo
    dominio: al entrar hay que poder distinguir de que colegio es la matricula
    sin preguntarselo a quien la escribe.

    El numero sale de un contador atomico y no de un max()+1, que con dos
    secretarias inscribiendo a la vez daria la misma matricula a dos ninos.
  */
  private async siguienteMatricula(
    cliente: PoolClient,
    institucionId: string,
    siglas: string | null | undefined,
    anoCodigo: string,
  ): Promise<string> {
    const prefijo = (siglas ?? 'EDU').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'EDU';
    const ano = anoCodigo.slice(0, 4);

    const { rows } = await cliente.query<{ valor: number }>(
      `select app.siguiente_numero($1, $2) as valor`,
      [institucionId, `matricula:${ano}`],
    );

    return `${prefijo}-${ano}-${String(rows[0].valor).padStart(4, '0')}`;
  }

  private async leerSeccionParaInscribir(cliente: PoolClient, seccionId: string) {
    const { rows } = await cliente.query<{
      nombre: string;
      grado: string;
      sedeId: string | null;
      cupo: number | null;
      anoEscolarId: string;
      anoCodigo: string;
      anoInicio: string;
      anoEstado: string;
      inscritos: number;
    }>(
      `select s.nombre, g.nombre as grado, s.sede_id as "sedeId", s.cupo,
              s.ano_escolar_id as "anoEscolarId", a.codigo as "anoCodigo",
              to_char(a.inicio, 'YYYY-MM-DD') as "anoInicio",
              a.estado::text as "anoEstado",
              (select count(*)::int from inscripciones i
                where i.seccion_id = s.id and i.estado in ('preinscrito','inscrito'))
                as inscritos
         from secciones s
         join grados g on g.id = s.grado_id
         join anos_escolares a on a.id = s.ano_escolar_id
        where s.id = $1 and s.eliminado_en is null`,
      [seccionId],
    );

    const seccion = rows[0];
    if (!seccion) throw new NotFoundException('Esa seccion no existe.');

    if (seccion.anoEstado === 'cerrado') {
      throw new BadRequestException(
        `El ano ${seccion.anoCodigo} esta cerrado: no admite inscripciones.`,
      );
    }

    // El cupo es una decision del colegio, no un limite tecnico, pero pasarlo
    // sin darse cuenta es como aparecen secciones de 45 ninos en un aula de 30.
    if (seccion.cupo !== null && seccion.inscritos >= seccion.cupo) {
      throw new BadRequestException(
        `${seccion.grado} ${seccion.nombre} ya tiene ${seccion.inscritos} de ${seccion.cupo} cupos ocupados.`,
      );
    }

    return seccion;
  }

  private async enlazarRepresentantes(
    cliente: PoolClient,
    institucionId: string,
    membresiaId: string,
    representantes: RepresentanteDto[],
  ) {
    if (representantes.length === 0) {
      throw new BadRequestException(
        'Un estudiante necesita al menos un representante: es quien responde por el y a quien se cobra.',
      );
    }

    // Si nadie viene marcado como principal, lo es el primero: la factura y las
    // llamadas tienen que tener destinatario.
    const principal = representantes.findIndex((r) => r.esPrincipal);
    const indicePrincipal = principal === -1 ? 0 : principal;

    for (const [i, rep] of representantes.entries()) {
      let representanteId = rep.id;

      if (representanteId) {
        // Actualiza los datos de contacto: si la madre cambio de telefono, este
        // es el momento en que el colegio se entera.
        await cliente.query(
          `update representantes set
              nombres = $2, apellidos = $3, tipo_documento = $4::tipo_documento,
              documento = $5, telefono = $6, telefono_trabajo = $7, correo = $8::citext,
              direccion = $9, ocupacion = $10, lugar_trabajo = $11
            where id = $1`,
          [
            representanteId,
            rep.nombres,
            rep.apellidos,
            rep.tipoDocumento ?? 'cedula',
            rep.documento ?? null,
            rep.telefono ?? null,
            rep.telefonoTrabajo ?? null,
            rep.correo ?? null,
            rep.direccion ?? null,
            rep.ocupacion ?? null,
            rep.lugarTrabajo ?? null,
          ],
        );
      } else {
        const { rows } = await cliente.query<{ id: string }>(
          `insert into representantes
             (institucion_id, nombres, apellidos, tipo_documento, documento,
              telefono, telefono_trabajo, correo, direccion, ocupacion, lugar_trabajo)
           values ($1, $2, $3, $4::tipo_documento, $5, $6, $7, $8::citext, $9, $10, $11)
           returning id`,
          [
            institucionId,
            rep.nombres,
            rep.apellidos,
            rep.tipoDocumento ?? 'cedula',
            rep.documento ?? null,
            rep.telefono ?? null,
            rep.telefonoTrabajo ?? null,
            rep.correo ?? null,
            rep.direccion ?? null,
            rep.ocupacion ?? null,
            rep.lugarTrabajo ?? null,
          ],
        );
        representanteId = rows[0].id;
      }

      await cliente.query(
        `insert into estudiante_representantes
           (institucion_id, membresia_id, representante_id, parentesco,
            es_principal, puede_retirar)
         values ($1, $2, $3, $4::parentesco, $5, $6)`,
        [
          institucionId,
          membresiaId,
          representanteId,
          rep.parentesco,
          i === indicePrincipal,
          rep.puedeRetirar ?? true,
        ],
      );
    }
  }

  /*
    El estudiante entra en todos los cursos de su seccion de una vez. Es la
    razon de ser de todo el modelo: en un colegio nadie elige materias, asi que
    preguntar curso por curso seria inventar un trabajo que no existe.
  */
  private async matricularEnCursos(
    cliente: PoolClient,
    institucionId: string,
    inscripcionId: string,
    seccionId: string,
  ): Promise<number> {
    const { rowCount } = await cliente.query(
      `insert into curso_estudiantes (institucion_id, curso_id, inscripcion_id)
       select $1, c.id, $2
         from cursos c
        where c.seccion_id = $3 and c.eliminado_en is null
       on conflict (curso_id, inscripcion_id) do nothing`,
      [institucionId, inscripcionId, seccionId],
    );
    return rowCount ?? 0;
  }

  /*
    Genera los cargos del ano: la inscripcion de una vez y las mensualidades una
    por cuota, con su fecha de vencimiento contada desde el inicio del ano.

    El monto se copia al cargo en vez de referenciarse: si el colegio sube la
    mensualidad en marzo, lo ya facturado en enero no puede cambiar solo.
  */
  private async generarCargos(
    cliente: PoolClient,
    institucionId: string,
    inscripcionId: string,
    anoEscolarId: string,
    anoInicio: string,
    elegidos?: string[],
  ): Promise<number> {
    const condicion = elegidos?.length
      ? `and c.id = any ($2::uuid[])`
      : `and c.obligatorio`;

    const { rows: conceptos } = await cliente.query<{
      id: string;
      nombre: string;
      tipo: string;
      monto: string;
      cuotas: number | null;
      diaVencimiento: number | null;
    }>(
      `select c.id, c.nombre, c.tipo::text as tipo, c.monto::text as monto,
              c.cuotas, c.dia_vencimiento as "diaVencimiento"
         from conceptos_cobro c
        where c.activo
          and (c.ano_escolar_id = $1 or c.ano_escolar_id is null)
          ${condicion}
        order by c.tipo`,
      elegidos?.length ? [anoEscolarId, elegidos] : [anoEscolarId],
    );

    let generados = 0;

    for (const concepto of conceptos) {
      const cuotas = concepto.tipo === 'mensualidad' ? (concepto.cuotas ?? 10) : 1;

      for (let cuota = 1; cuota <= cuotas; cuota++) {
        const vence = this.vencimiento(
          anoInicio,
          concepto.tipo === 'mensualidad' ? cuota : null,
          concepto.diaVencimiento,
        );

        await cliente.query(
          `insert into cargos
             (institucion_id, inscripcion_id, concepto_id, descripcion, monto,
              cuota, vence_en)
           values ($1, $2, $3, $4, $5::numeric, $6, $7::date)`,
          [
            institucionId,
            inscripcionId,
            concepto.id,
            cuotas > 1 ? `${concepto.nombre} · cuota ${cuota} de ${cuotas}` : concepto.nombre,
            concepto.monto,
            cuotas > 1 ? cuota : null,
            vence,
          ],
        );
        generados++;
      }
    }

    return generados;
  }

  /*
    La inscripcion vence el dia que se genera; la cuota N, N-1 meses despues del
    inicio del ano. Se calcula en UTC y sobre el dia 1 antes de fijar el dia del
    mes, para que sumar un mes a un 31 de enero no se vaya a marzo.
  */
  private vencimiento(anoInicio: string, cuota: number | null, dia: number | null): string {
    const [ano, mes] = anoInicio.split('-').map(Number);
    if (cuota === null) return anoInicio;

    const fecha = new Date(Date.UTC(ano, mes - 1 + (cuota - 1), 1));
    fecha.setUTCDate(Math.min(dia ?? 5, 28));
    return fecha.toISOString().slice(0, 10);
  }
}
