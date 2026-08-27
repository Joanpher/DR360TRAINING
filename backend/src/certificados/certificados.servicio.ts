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
import type { ListarCertificadosDto } from './dto/certificados.dto';

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

@Injectable()
export class CertificadosServicio {
  constructor(
    private readonly bd: BaseDatos,
    private readonly config: ConfigService,
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
                case
                  when cert.estado = 'emitido' then 'emitido'
                  when cert.estado = 'revocado' then 'revocado'
                  when v.estado <> 'pagada' then 'pendiente_pago'
                  when i.estado <> 'completada' then 'pendiente_curso'
                  else 'listo'
                end as disponibilidad
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
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
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
    });
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
