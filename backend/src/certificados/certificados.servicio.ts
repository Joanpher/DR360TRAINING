import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import { PosServicio } from '../pos/pos.servicio';
import type {
  BuscarCursosCertificadoDto,
  CobrarCertificadoDto,
  ListarCertificadosDto,
} from './dto/certificados.dto';

const DETALLE = `
  select cert.id, cert.numero::text as numero,
         cert.codigo_verificacion as "codigoVerificacion",
         cert.estado::text as estado, cert.emitido_en as "emitidoEn",
         cert.revocado_en as "revocadoEn", cert.motivo_revocacion as "motivoRevocacion",
         i.id as "inscripcionId", i.estado::text as "estadoInscripcion",
         to_char(i.completado_en, 'YYYY-MM-DD') as "completadoEn",
         i.calificacion::text as calificacion,
         m.codigo as matricula, u.nombre_completo as estudiante, u.correo::text as correo,
         c.codigo as "codigoCurso", c.nombre as curso,
         c.duracion_horas::text as "duracionHoras",
         c.inicia_en::text as "iniciaEn", c.termina_en::text as "terminaEn",
         inst.nombre as institucion, inst.siglas,
         inst.marca,
         v.id as "ventaId", v.numero::text as "numeroVenta", v.total::text as "totalVenta",
         count(e.id) filter (where e.canal = 'impresion')::int as impresiones,
         count(e.id) filter (where e.canal = 'correo')::int as "correosEnviados",
         max(e.realizado_en) as "ultimaEntregaEn"
    from certificados cert
    join inscripciones i on i.id = cert.inscripcion_id
    join membresias m on m.id = i.membresia_id
    join usuarios u on u.id = m.usuario_id
    join cursos c on c.id = i.curso_id
    join instituciones inst on inst.id = cert.institucion_id
    join venta_pos_lineas l on l.id = cert.venta_linea_id
    join ventas_pos v on v.id = l.venta_id
    left join certificado_entregas e on e.certificado_id = cert.id
`;

const AGRUPAR = `
  group by cert.id, i.id, m.codigo, u.nombre_completo, u.correo, c.id,
           inst.id, v.id
`;

type DetalleCertificado = {
  id: string;
  numero: string;
  codigoVerificacion: string;
  estado: string;
  emitidoEn: Date;
  revocadoEn: Date | null;
  motivoRevocacion: string | null;
  inscripcionId: string;
  estadoInscripcion: string;
  completadoEn: string | null;
  calificacion: string | null;
  matricula: string | null;
  estudiante: string;
  correo: string | null;
  codigoCurso: string;
  curso: string;
  duracionHoras: string | null;
  iniciaEn: string | null;
  terminaEn: string | null;
  institucion: string;
  siglas: string | null;
  marca: Record<string, unknown>;
  ventaId: string;
  numeroVenta: string;
  totalVenta: string;
  impresiones: number;
  correosEnviados: number;
  ultimaEntregaEn: Date | null;
};

/*
  Lo que ve el estudiante de su propio certificado. Es el mismo documento que
  imprime el mostrador menos la venta: ni el numero de ticket, ni el total, ni
  el saldo. No es que la consulta se los oculte -es que no los pide-, y por eso
  esta consulta no toca ninguna tabla del POS, que sigue cerrada al alumno por
  politica desde la 0014.

  La prueba de que pago no hace falta buscarla: si el certificado existe, la
  venta estaba saldada, porque emitir sin saldar es imposible.
*/
const DOCUMENTO = `
  select cert.id, cert.numero::text as numero,
         cert.codigo_verificacion as "codigoVerificacion",
         cert.estado::text as estado, cert.emitido_en as "emitidoEn",
         cert.revocado_en as "revocadoEn", cert.motivo_revocacion as "motivoRevocacion",
         i.id as "inscripcionId", i.estado::text as "estadoInscripcion",
         to_char(i.completado_en, 'YYYY-MM-DD') as "completadoEn",
         i.calificacion::text as calificacion,
         m.codigo as matricula, u.nombre_completo as estudiante, u.correo::text as correo,
         c.codigo as "codigoCurso", c.nombre as curso,
         c.duracion_horas::text as "duracionHoras",
         c.inicia_en::text as "iniciaEn", c.termina_en::text as "terminaEn",
         inst.nombre as institucion, inst.siglas, inst.marca
    from certificados cert
    join inscripciones i on i.id = cert.inscripcion_id
    join membresias m on m.id = i.membresia_id
    join usuarios u on u.id = m.usuario_id
    join cursos c on c.id = i.curso_id
    join instituciones inst on inst.id = cert.institucion_id
`;

/*
  El estado de una inscripcion frente a su certificado, en una sola expresion.
  Vive aqui escrita una vez y se usa en las tres consultas que la necesitan
  -la lista general, la lista de clase y el portal- porque el dia que cambie la
  regla tiene que cambiar en las tres a la vez o el sistema dira tres cosas
  distintas sobre la misma fila.
*/
const DISPONIBILIDAD = `
  case
    when cert.estado = 'emitido' then 'emitido'
    when cert.estado = 'revocado' then 'revocado'
    when v.id is null then 'sin_vender'
    when v.estado <> 'pagada' then 'pendiente_pago'
    when i.estado <> 'completada' then 'pendiente_curso'
    else 'listo'
  end
`;

type DocumentoCertificado = {
  id: string;
  numero: string;
  codigoVerificacion: string;
  estado: string;
  emitidoEn: Date;
  revocadoEn: Date | null;
  motivoRevocacion: string | null;
  inscripcionId: string;
  estadoInscripcion: string;
  completadoEn: string | null;
  calificacion: string | null;
  matricula: string | null;
  estudiante: string;
  correo: string | null;
  codigoCurso: string;
  curso: string;
  duracionHoras: string | null;
  iniciaEn: string | null;
  terminaEn: string | null;
  institucion: string;
  siglas: string | null;
  marca: Record<string, unknown>;
};

@Injectable()
export class CertificadosServicio {
  constructor(
    private readonly bd: BaseDatos,
    private readonly config: ConfigService,
    private readonly pos: PosServicio,
  ) {}

  async listar(sesion: Sesion, filtro: ListarCertificadosDto) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const termino = filtro.busqueda?.trim() || null;
      const { rows } = await cliente.query(
        `select v.id as "ventaId", v.numero::text as "numeroVenta",
                v.estado::text as "estadoVenta", v.total::text as total,
                (v.total - coalesce(sum(pp.monto) filter (where pp.anulado_en is null), 0))::text as saldo,
                i.id as "inscripcionId", i.estado::text as "estadoInscripcion",
                m.codigo as matricula, u.nombre_completo as estudiante, u.correo::text as correo,
                c.codigo as "codigoCurso", c.nombre as curso,
                cert.id as "certificadoId", cert.numero::text as "numeroCertificado",
                cert.estado::text as "estadoCertificado", cert.emitido_en as "emitidoEn",
                ${DISPONIBILIDAD} as disponibilidad
           from ventas_pos v
           join venta_pos_lineas l on l.venta_id = v.id
           join productos_pos pr on pr.id = l.producto_id and pr.tipo = 'certificado'
           join inscripciones i on i.id = l.inscripcion_id
           join membresias m on m.id = i.membresia_id
           join usuarios u on u.id = m.usuario_id
           join cursos c on c.id = i.curso_id
           left join pagos_pos pp on pp.venta_id = v.id
           left join certificados cert on cert.venta_linea_id = l.id
          where (v.estado <> 'anulada' or cert.id is not null)
            and ($1::text is null or u.nombre_completo ilike '%' || $1 || '%'
                 or coalesce(m.codigo, '') ilike '%' || $1 || '%'
                 or c.nombre ilike '%' || $1 || '%' or c.codigo ilike '%' || $1 || '%'
                 or cert.codigo_verificacion ilike '%' || $1 || '%')
          group by v.id, i.id, m.codigo, u.nombre_completo, u.correo, c.id, cert.id
          order by coalesce(cert.emitido_en, v.creado_en) desc limit 200`,
        [termino],
      );
      const resumen = {
        listos: rows.filter(
          (r: { disponibilidad: string }) => r.disponibilidad === 'listo',
        ).length,
        emitidos: rows.filter(
          (r: { disponibilidad: string }) => r.disponibilidad === 'emitido',
        ).length,
        pendientesPago: rows.filter(
          (r: { disponibilidad: string }) =>
            r.disponibilidad === 'pendiente_pago',
        ).length,
        pendientesCurso: rows.filter(
          (r: { disponibilidad: string }) =>
            r.disponibilidad === 'pendiente_curso',
        ).length,
      };
      return { certificados: rows, resumen };
    });
  }

  async emitir(sesion: Sesion, ventaId: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), (cliente) =>
      this.emitirEn(cliente, sesion, ventaId, origen),
    );
  }

  /*
    Emitir sobre un cliente ya abierto, por la misma razon que
    PosServicio.crearVentaEn: cobrar y emitir de una pulsacion tiene que ser una
    sola transaccion. Si se partiera en dos, un fallo entre medias dejaria una
    venta saldada sin documento; recuperable, pero el mostrador ya cobro.
  */
  async emitirEn(
    cliente: PoolClient,
    sesion: Sesion,
    ventaId: string,
    origen: Origen,
  ) {
    const { rows } = await cliente.query<{
      lineaId: string;
      inscripcionId: string;
      estadoVenta: string;
      estadoInscripcion: string;
      estudiante: string;
      curso: string;
      codigoCurso: string;
    }>(
      `select l.id as "lineaId", i.id as "inscripcionId",
              v.estado::text as "estadoVenta", i.estado::text as "estadoInscripcion",
              u.nombre_completo as estudiante, c.nombre as curso, c.codigo as "codigoCurso"
         from ventas_pos v
         join venta_pos_lineas l on l.venta_id = v.id
         join productos_pos pr on pr.id = l.producto_id and pr.tipo = 'certificado'
         join inscripciones i on i.id = l.inscripcion_id
         join membresias m on m.id = i.membresia_id
         join usuarios u on u.id = m.usuario_id
         join cursos c on c.id = i.curso_id
        where v.id = $1 for update of v, i`,
      [ventaId],
    );
    const base = rows[0];
    if (!base)
      throw new NotFoundException('Esa venta de certificado no existe.');
    if (base.estadoVenta !== 'pagada') {
      throw new BadRequestException(
        'El certificado no se puede emitir hasta saldar la venta en el POS.',
      );
    }
    if (base.estadoInscripcion !== 'completada') {
      throw new BadRequestException(
        'El estudiante todavía no ha completado el curso.',
      );
    }
    const { rows: yaExiste } = await cliente.query<{ id: string }>(
      `select id from certificados where inscripcion_id = $1`,
      [base.inscripcionId],
    );
    if (yaExiste[0])
      throw new BadRequestException('Ese certificado ya fue emitido.');

    const institucionId = institucionDe(sesion);
    const { rows: consecutivo } = await cliente.query<{ valor: number }>(
      `select app.siguiente_numero($1, 'certificado') as valor`,
      [institucionId],
    );
    const codigo = randomBytes(8).toString('hex').toUpperCase();
    const { rows: creado } = await cliente.query<{ id: string }>(
      `insert into certificados
         (institucion_id, inscripcion_id, venta_linea_id, numero,
          codigo_verificacion, emitido_por)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [
        institucionId,
        base.inscripcionId,
        base.lineaId,
        consecutivo[0].valor,
        codigo,
        sesion.usuarioId,
      ],
    );
    await cliente.query(
      `update inscripciones set certificado_emitido_en = current_date where id = $1`,
      [base.inscripcionId],
    );
    await anotar(
      cliente,
      {
        accion: 'certificado.emitido',
        entidad: 'certificados',
        entidadId: creado[0].id,
        datos: {
          numero: consecutivo[0].valor,
          codigo,
          estudiante: base.estudiante,
          curso: base.curso,
          ventaId,
        },
      },
      origen,
    );
    return { certificado: await this.leer(cliente, creado[0].id) };
  }

  async detalle(sesion: Sesion, id: string) {
    return this.bd.conContexto(contextoDe(sesion), (cliente) =>
      this.leer(cliente, id),
    );
  }

  async registrarImpresion(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const certificado = await this.leer(cliente, id);
      if (certificado.estado !== 'emitido')
        throw new BadRequestException('El certificado está revocado.');
      await cliente.query(
        `insert into certificado_entregas
           (institucion_id, certificado_id, canal, realizado_por)
         values ($1, $2, 'impresion', $3)`,
        [institucionDe(sesion), id, sesion.usuarioId],
      );
      await anotar(
        cliente,
        {
          accion: 'certificado.impreso',
          entidad: 'certificados',
          entidadId: id,
          datos: {
            estudiante: certificado.estudiante,
            curso: certificado.curso,
          },
        },
        origen,
      );
      return { registrado: true };
    });
  }

  async enviarCorreo(
    sesion: Sesion,
    id: string,
    correo: string,
    origen: Origen,
  ) {
    const certificado = await this.bd.conContexto(
      contextoDe(sesion),
      (cliente) => this.leer(cliente, id),
    );
    if (certificado.estado !== 'emitido')
      throw new BadRequestException('El certificado está revocado.');
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const remitente = this.config.get<string>('CORREO_REMITENTE');
    if (!apiKey || !remitente) {
      throw new BadRequestException(
        'El envío por correo requiere configurar RESEND_API_KEY y CORREO_REMITENTE.',
      );
    }
    let respuesta: Response;
    try {
      respuesta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: remitente,
          to: [correo],
          subject: `Certificado · ${certificado.curso}`,
          html: this.htmlCorreo(certificado),
        }),
      });
    } catch {
      throw new BadRequestException(
        'No se pudo conectar con el servicio de correo.',
      );
    }
    if (!respuesta.ok)
      throw new BadRequestException('El servicio de correo rechazó el envío.');

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      await cliente.query(
        `insert into certificado_entregas
           (institucion_id, certificado_id, canal, destinatario, realizado_por)
         values ($1, $2, 'correo', $3, $4)`,
        [institucionDe(sesion), id, correo, sesion.usuarioId],
      );
      await anotar(
        cliente,
        {
          accion: 'certificado.enviado_por_correo',
          entidad: 'certificados',
          entidadId: id,
          datos: {
            destinatario: correo,
            estudiante: certificado.estudiante,
            curso: certificado.curso,
          },
        },
        origen,
      );
      return { enviado: true };
    });
  }

  async revocar(sesion: Sesion, id: string, motivo: string, origen: Origen) {
    if (!motivo.trim())
      throw new BadRequestException('Indica el motivo de revocación.');
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const certificado = await this.leer(cliente, id);
      if (certificado.estado === 'revocado')
        throw new BadRequestException('El certificado ya está revocado.');
      await cliente.query(
        `update certificados set estado = 'revocado', revocado_por = $2,
                revocado_en = now(), motivo_revocacion = $3 where id = $1`,
        [id, sesion.usuarioId, motivo],
      );
      await anotar(
        cliente,
        {
          accion: 'certificado.revocado',
          entidad: 'certificados',
          entidadId: id,
          datos: {
            motivo,
            estudiante: certificado.estudiante,
            curso: certificado.curso,
          },
        },
        origen,
      );
      return { revocado: true };
    });
  }

  /* --- Buscar un curso y trabajar su lista de clase -------------------- */

  /*
    El buscador de cursos. Es la puerta por la que se entra de verdad al
    trabajo diario: nadie llega pensando "el certificado numero 41", llega
    pensando "los de HVAC de los lunes". Devuelve los conteos ya hechos porque
    lo primero que se mira de un curso es cuantos faltan por cobrar, y pedir eso
    curso a curso serian veinte consultas para pintar una lista.
  */
  async cursos(sesion: Sesion, filtro: BuscarCursosCertificadoDto) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const termino = filtro.busqueda?.trim() || null;
      const { rows } = await cliente.query(
        `select c.id, c.codigo, c.nombre, c.estado::text as estado,
                c.certificado, c.modalidad::text as modalidad,
                c.inicia_en::text as "iniciaEn", c.termina_en::text as "terminaEn",
                c.duracion_horas::text as "duracionHoras",
                s.nombre as sede, iu.nombre_completo as instructor,
                count(i.id)::int as inscritos,
                count(i.id) filter (where i.estado = 'completada')::int as completados,
                count(v.id)::int as vendidos,
                count(v.id) filter (where v.estado = 'pendiente')::int as "pendientesPago",
                count(cert.id) filter (where cert.estado = 'emitido')::int as emitidos
           from cursos c
           left join sedes s on s.id = c.sede_id
           left join membresias im on im.id = c.instructor_membresia_id
           left join usuarios iu on iu.id = im.usuario_id
           left join inscripciones i
             on i.curso_id = c.id and i.estado not in ('retirada', 'cancelada')
           left join lateral (
             select v2.id, v2.estado
               from venta_pos_lineas l2
               join ventas_pos v2 on v2.id = l2.venta_id
               join productos_pos pr2 on pr2.id = l2.producto_id
              where l2.inscripcion_id = i.id and pr2.tipo = 'certificado'
                and v2.estado <> 'anulada'
              order by v2.creado_en desc limit 1
           ) v on true
           left join certificados cert on cert.inscripcion_id = i.id
          where c.eliminado_en is null
            and ($1::text is null or c.nombre ilike '%' || $1 || '%'
                 or c.codigo ilike '%' || $1 || '%'
                 or coalesce(iu.nombre_completo, '') ilike '%' || $1 || '%'
                 or coalesce(s.nombre, '') ilike '%' || $1 || '%')
          group by c.id, s.nombre, iu.nombre_completo
          order by c.inicia_en desc nulls last, c.nombre
          limit 60`,
        [termino],
      );
      return { cursos: rows };
    });
  }

  /*
    La lista de clase de un curso con la situacion de cada quien. Sale entera y
    sin paginar: un curso son doce o veinte personas, y el uso es recorrerla de
    arriba abajo cobrando, no buscar dentro de ella.
  */
  async listaDeClase(sesion: Sesion, cursoId: string) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows: cursos } = await cliente.query(
        `select c.id, c.codigo, c.nombre, c.estado::text as estado, c.certificado,
                c.modalidad::text as modalidad,
                c.inicia_en::text as "iniciaEn", c.termina_en::text as "terminaEn",
                c.duracion_horas::text as "duracionHoras",
                s.nombre as sede, iu.nombre_completo as instructor
           from cursos c
           left join sedes s on s.id = c.sede_id
           left join membresias im on im.id = c.instructor_membresia_id
           left join usuarios iu on iu.id = im.usuario_id
          where c.id = $1 and c.eliminado_en is null`,
        [cursoId],
      );
      if (!cursos[0]) throw new NotFoundException('Ese curso no existe.');

      const { rows: estudiantes } = await cliente.query(
        `select i.id as "inscripcionId", i.estado::text as "estadoInscripcion",
                i.calificacion::text as calificacion,
                to_char(i.completado_en, 'YYYY-MM-DD') as "completadoEn",
                m.codigo as matricula, u.nombre_completo as estudiante,
                u.correo::text as correo, u.telefono,
                v.id as "ventaId", v.numero::text as "numeroVenta",
                v.estado::text as "estadoVenta", v.total::text as "totalVenta",
                v.moneda,
                coalesce(v.pagado, 0)::text as "pagadoVenta",
                (coalesce(v.total, 0) - coalesce(v.pagado, 0))::text as "saldoVenta",
                cert.id as "certificadoId", cert.numero::text as "numeroCertificado",
                cert.estado::text as "estadoCertificado",
                cert.emitido_en as "emitidoEn",
                ${DISPONIBILIDAD} as disponibilidad
           from inscripciones i
           join membresias m on m.id = i.membresia_id
           join usuarios u on u.id = m.usuario_id
           left join lateral (
             select v2.id, v2.numero, v2.estado, v2.total, v2.moneda,
                    coalesce(sum(pp.monto) filter (where pp.anulado_en is null), 0) as pagado
               from venta_pos_lineas l2
               join ventas_pos v2 on v2.id = l2.venta_id
               join productos_pos pr2 on pr2.id = l2.producto_id
               left join pagos_pos pp on pp.venta_id = v2.id
              where l2.inscripcion_id = i.id and pr2.tipo = 'certificado'
                and v2.estado <> 'anulada'
              group by v2.id
              order by v2.creado_en desc limit 1
           ) v on true
           left join certificados cert on cert.inscripcion_id = i.id
          where i.curso_id = $1 and i.estado not in ('retirada', 'cancelada')
          order by u.nombre_completo`,
        [cursoId],
      );
      return { curso: cursos[0], estudiantes };
    });
  }

  /*
    Cobrar el certificado y emitirlo, si procede, en una sola pulsacion. Es la
    operacion que de verdad ocurre en el mostrador: la persona paga y se lleva
    el papel. Partirla en "vender" y luego "emitir" era exacto pero obligaba a
    dos viajes por la misma fila.

    Emitir se intenta solo cuando la venta queda saldada y el curso completado.
    Si no, la venta queda igual de valida y el boton de emitir aparece cuando se
    cumpla lo que falte: cobrar a medias es legitimo, emitir a medias no.
  */
  async cobrar(sesion: Sesion, datos: CobrarCertificadoDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const producto = await this.productoCertificado(cliente, sesion);
      const precio = Number(producto.precio);
      const recibido = datos.montoRecibido ?? precio;

      const { venta } = await this.pos.crearVentaEn(
        cliente,
        sesion,
        {
          inscripcionId: datos.inscripcionId,
          productoId: producto.id,
          montoRecibido: recibido,
          metodo: datos.metodo,
          referencia: datos.referencia ?? null,
          nota: datos.nota ?? null,
        },
        origen,
      );

      if (venta.estado !== 'pagada') {
        return { venta, certificado: null, emitido: false };
      }

      const { rows: inscripcion } = await cliente.query<{ estado: string }>(
        `select estado::text as estado from inscripciones where id = $1`,
        [datos.inscripcionId],
      );
      if (inscripcion[0]?.estado !== 'completada') {
        return { venta, certificado: null, emitido: false };
      }

      const { certificado } = await this.emitirEn(
        cliente,
        sesion,
        venta.id,
        origen,
      );
      return { venta, certificado, emitido: true };
    });
  }

  /* --- El portal del estudiante --------------------------------------- */

  /*
    Los certificados de quien pregunta, y nada mas. Aqui no hay filtro escrito
    por institucion ni por persona: lo pone la politica
    certificados_lectura_propia de la 0017, y por eso este metodo se puede leer
    sin miedo aunque no diga "where es mio".

    El revocado tambien sale. Un documento que se anulo y desaparece de la
    pantalla sin explicacion es peor que uno que se ve tachado.
  */
  async mios(sesion: Sesion) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<DocumentoCertificado>(
        `${DOCUMENTO} order by cert.emitido_en desc`,
      );
      return { certificados: rows };
    });
  }

  async mio(sesion: Sesion, id: string) {
    return this.bd.conContexto(contextoDe(sesion), (cliente) =>
      this.leerDocumento(cliente, id),
    );
  }

  /*
    Que el alumno imprima queda anotado igual que si lo imprimiera el mostrador,
    con su canal y su fecha. No es control: es que la pregunta "se lo llevo o
    no" se conteste sola cuando alguien vuelva a preguntarla en la ventanilla.
  */
  async registrarImpresionPropia(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const documento = await this.leerDocumento(cliente, id);
      if (documento.estado !== 'emitido') {
        throw new BadRequestException('El certificado está revocado.');
      }
      await cliente.query(
        `insert into certificado_entregas
           (institucion_id, certificado_id, canal, realizado_por)
         values ($1, $2, 'impresion', $3)`,
        [institucionDe(sesion), id, sesion.usuarioId],
      );
      await anotar(
        cliente,
        {
          accion: 'certificado.impreso_por_el_estudiante',
          entidad: 'certificados',
          entidadId: id,
          datos: { curso: documento.curso },
        },
        origen,
      );
      return { registrado: true };
    });
  }

  private async leerDocumento(
    cliente: PoolClient,
    id: string,
  ): Promise<DocumentoCertificado> {
    const { rows } = await cliente.query<DocumentoCertificado>(
      `${DOCUMENTO} where cert.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Ese certificado no existe.');
    return rows[0];
  }

  /*
    El producto de certificado de la institucion. Se crea al vuelo si falta:
    una institucion dada de alta antes de la 0014 no lo tiene, y el mostrador no
    deberia toparse con "no hay producto" cuando lo unico que quiere es cobrar.
  */
  private async productoCertificado(cliente: PoolClient, sesion: Sesion) {
    await cliente.query(
      `insert into productos_pos (institucion_id, codigo, nombre, tipo, precio)
       values ($1, 'CERTIFICADO', 'Certificado de finalización', 'certificado', 1500.00)
       on conflict (institucion_id, tipo) do nothing`,
      [institucionDe(sesion)],
    );
    const { rows } = await cliente.query<{
      id: string;
      nombre: string;
      precio: string;
      moneda: string;
      activo: boolean;
    }>(
      `select id, nombre, precio::text as precio, moneda, activo
         from productos_pos where tipo = 'certificado' limit 1`,
    );
    if (!rows[0] || !rows[0].activo) {
      throw new BadRequestException(
        'El producto de certificado no está disponible.',
      );
    }
    return rows[0];
  }

  private async leer(
    cliente: PoolClient,
    id: string,
  ): Promise<DetalleCertificado> {
    const { rows } = await cliente.query<DetalleCertificado>(
      `${DETALLE} where cert.id = $1 ${AGRUPAR}`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Ese certificado no existe.');
    return rows[0];
  }

  private htmlCorreo(c: DetalleCertificado) {
    const e = (valor: string | number | null) =>
      String(valor ?? '').replace(
        /[&<>'"]/g,
        (x) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;',
          })[x] as string,
      );
    return `<!doctype html><html><body style="margin:0;background:#f4f7fc;font-family:Arial,sans-serif;color:#0b1833">
      <div style="max-width:760px;margin:30px auto;padding:55px;border:10px solid #012565;background:white;text-align:center">
        <p style="letter-spacing:3px;color:#0055fc;font-weight:bold">${e(c.institucion)}</p>
        <h1 style="font-size:38px;margin:28px 0 8px">Certificado de finalización</h1>
        <p>Se hace constar que</p>
        <h2 style="font-size:30px;border-bottom:1px solid #b5c5dc;padding-bottom:14px">${e(c.estudiante)}</h2>
        <p>completó satisfactoriamente el curso</p>
        <h3 style="font-size:24px">${e(c.curso)}</h3>
        <p>${e(c.codigoCurso)}${c.duracionHoras ? ` · ${e(c.duracionHoras)} horas` : ''}</p>
        <p style="margin-top:42px;font-size:12px;color:#506079">Certificado N.º ${e(c.numero)} · Verificación ${e(c.codigoVerificacion)}</p>
      </div></body></html>`;
  }
}
