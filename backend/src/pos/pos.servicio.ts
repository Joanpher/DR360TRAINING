import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type {
  ActualizarProductoPosDto,
  AgregarPagoPosDto,
  BuscarCandidatosDto,
  CrearVentaDto,
  ListarVentasDto,
} from './dto/pos.dto';

const VENTA = `
  select v.id, v.numero::text as numero, v.estado::text as estado,
         v.subtotal::text as subtotal, v.total::text as total, v.moneda,
         v.nota, v.creado_en as "creadoEn", v.pagada_en as "pagadaEn",
         m.codigo as matricula, u.nombre_completo as estudiante,
         u.correo::text as correo, i.id as "inscripcionId",
         c.codigo as "codigoCurso", c.nombre as curso,
         l.descripcion, l.id as "lineaId",
         coalesce(sum(p.monto) filter (where p.anulado_en is null), 0)::text as pagado,
         (v.total - coalesce(sum(p.monto) filter (where p.anulado_en is null), 0))::text as saldo,
         cert.id as "certificadoId"
    from ventas_pos v
    join membresias m on m.id = v.membresia_id
    join usuarios u on u.id = m.usuario_id
    join venta_pos_lineas l on l.venta_id = v.id
    join inscripciones i on i.id = l.inscripcion_id
    join cursos c on c.id = i.curso_id
    left join pagos_pos p on p.venta_id = v.id
    left join certificados cert on cert.venta_linea_id = l.id
`;

const AGRUPAR_VENTA = `
  group by v.id, m.codigo, u.nombre_completo, u.correo, i.id,
           c.codigo, c.nombre, l.descripcion, l.id, cert.id
`;

type VentaPos = {
  id: string;
  numero: string;
  estado: string;
  subtotal: string;
  total: string;
  moneda: string;
  nota: string | null;
  creadoEn: Date;
  pagadaEn: Date | null;
  matricula: string | null;
  estudiante: string;
  correo: string | null;
  inscripcionId: string;
  codigoCurso: string;
  curso: string;
  descripcion: string;
  lineaId: string;
  pagado: string;
  saldo: string;
  certificadoId: string | null;
};

type CandidatoPos = {
  inscripcionId: string;
  membresiaId: string;
  matricula: string | null;
  estudiante: string;
  correo: string | null;
  cursoId: string;
  codigoCurso: string;
  curso: string;
  estadoInscripcion: string;
  certificado: boolean;
  ventaId: string | null;
  estadoVenta: string | null;
  certificadoId: string | null;
};

@Injectable()
export class PosServicio {
  constructor(private readonly bd: BaseDatos) {}

  async productos(sesion: Sesion) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      await this.asegurarProducto(cliente, institucionDe(sesion));
      const { rows } = await cliente.query<{
        id: string;
        codigo: string;
        nombre: string;
        tipo: string;
        precio: string;
        moneda: string;
        activo: boolean;
      }>(
        `select id, codigo, nombre, tipo::text as tipo, precio::text as precio,
                moneda, activo
           from productos_pos order by nombre`,
      );
      return { productos: rows };
    });
  }

  async actualizarProducto(
    sesion: Sesion,
    id: string,
    datos: ActualizarProductoPosDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{
        nombre: string;
        precio: string;
        moneda: string;
        activo: boolean;
      }>(
        `update productos_pos set
            nombre = coalesce($2, nombre), precio = coalesce($3::numeric, precio),
            moneda = coalesce(upper($4), moneda), activo = coalesce($5, activo),
            actualizado_en = now()
          where id = $1
        returning nombre, precio::text as precio, moneda, activo`,
        [
          id,
          datos.nombre?.trim() || null,
          datos.precio ?? null,
          datos.moneda ?? null,
          datos.activo ?? null,
        ],
      );
      if (!rows[0]) throw new NotFoundException('Ese producto no existe.');
      await anotar(
        cliente,
        {
          accion: 'pos.producto_actualizado',
          entidad: 'productos_pos',
          entidadId: id,
          datos: rows[0],
        },
        origen,
      );
      return { producto: { id, ...rows[0] } };
    });
  }

  async candidatos(sesion: Sesion, filtro: BuscarCandidatosDto) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const termino = filtro.busqueda?.trim() || null;
      const { rows } = await cliente.query<CandidatoPos>(
        `select i.id as "inscripcionId", m.id as "membresiaId", m.codigo as matricula,
                u.nombre_completo as estudiante, u.correo::text as correo,
                c.id as "cursoId", c.codigo as "codigoCurso", c.nombre as curso,
                i.estado::text as "estadoInscripcion", c.certificado,
                v.id as "ventaId", v.estado::text as "estadoVenta",
                cert.id as "certificadoId"
           from inscripciones i
           join membresias m on m.id = i.membresia_id
           join usuarios u on u.id = m.usuario_id
           join cursos c on c.id = i.curso_id
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
          where i.estado not in ('retirada', 'cancelada') and c.certificado
            and ($1::text is null or u.nombre_completo ilike '%' || $1 || '%'
                 or coalesce(m.codigo, '') ilike '%' || $1 || '%'
                 or c.nombre ilike '%' || $1 || '%'
                 or c.codigo ilike '%' || $1 || '%')
          order by u.nombre_completo, c.nombre
          limit 80`,
        [termino],
      );
      return { candidatos: rows };
    });
  }

  async listar(sesion: Sesion, filtro: ListarVentasDto) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const condiciones: string[] = [];
      const valores: unknown[] = [];
      if (filtro.estado) {
        valores.push(filtro.estado);
        condiciones.push(`v.estado = $${valores.length}::estado_venta_pos`);
      }
      if (filtro.busqueda?.trim()) {
        valores.push(`%${filtro.busqueda.trim()}%`);
        const n = valores.length;
        condiciones.push(`(u.nombre_completo ilike $${n} or coalesce(m.codigo, '') ilike $${n}
          or c.nombre ilike $${n} or c.codigo ilike $${n} or v.numero::text ilike $${n})`);
      }
      const donde = condiciones.length
        ? `where ${condiciones.join(' and ')}`
        : '';
      const { rows } = await cliente.query<VentaPos>(
        `${VENTA} ${donde} ${AGRUPAR_VENTA} order by v.creado_en desc limit 200`,
        valores,
      );
      const { rows: resumen } = await cliente.query<{
        pagadas: number;
        pendientes: number;
        cobrado: string;
      }>(
        `select count(*) filter (where estado = 'pagada')::int as pagadas,
                count(*) filter (where estado = 'pendiente')::int as pendientes,
                coalesce(sum(total) filter (where estado = 'pagada'), 0)::text as cobrado
           from ventas_pos`,
      );
      return { ventas: rows, resumen: resumen[0] };
    });
  }

  async crearVenta(sesion: Sesion, datos: CrearVentaDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const institucionId = institucionDe(sesion);
      const { rows: inscripciones } = await cliente.query<{
        membresiaId: string;
        estudiante: string;
        codigoCurso: string;
        curso: string;
        estado: string;
        certificado: boolean;
      }>(
        `select i.membresia_id as "membresiaId", u.nombre_completo as estudiante,
                c.codigo as "codigoCurso", c.nombre as curso, i.estado::text as estado,
                c.certificado
           from inscripciones i
           join membresias m on m.id = i.membresia_id
           join usuarios u on u.id = m.usuario_id
           join cursos c on c.id = i.curso_id
          where i.id = $1 for update of i`,
        [datos.inscripcionId],
      );
      const inscripcion = inscripciones[0];
      if (!inscripcion)
        throw new NotFoundException('Esa inscripción no existe.');
      if (!inscripcion.certificado)
        throw new BadRequestException('Ese curso no entrega certificado.');
      if (['retirada', 'cancelada'].includes(inscripcion.estado)) {
        throw new BadRequestException(
          'La inscripción está retirada o cancelada.',
        );
      }

      const { rows: productos } = await cliente.query<{
        id: string;
        nombre: string;
        tipo: string;
        precio: string;
        moneda: string;
        activo: boolean;
      }>(
        `select id, nombre, tipo::text as tipo, precio::text as precio, moneda, activo
           from productos_pos where id = $1 for update`,
        [datos.productoId],
      );
      const producto = productos[0];
      if (!producto || producto.tipo !== 'certificado' || !producto.activo) {
        throw new BadRequestException(
          'El producto de certificado no está disponible.',
        );
      }

      const { rows: previa } = await cliente.query(
        `(select v.id from venta_pos_lineas l
          join ventas_pos v on v.id = l.venta_id
          join productos_pos p on p.id = l.producto_id
         where l.inscripcion_id = $1 and p.tipo = 'certificado' and v.estado <> 'anulada'
         limit 1)
         union all
         (select cert.id from certificados cert where cert.inscripcion_id = $1 limit 1)
         limit 1`,
        [datos.inscripcionId],
      );
      if (previa[0])
        throw new BadRequestException(
          'Ese certificado ya fue vendido o emitido.',
        );

      const precio = Number(producto.precio);
      if (datos.montoRecibido > precio) {
        throw new BadRequestException(
          'El monto recibido supera el total de la venta.',
        );
      }
      const { rows: consecutivo } = await cliente.query<{ valor: number }>(
        `select app.siguiente_numero($1, 'venta_pos') as valor`,
        [institucionId],
      );
      const pagada = precio === 0 || datos.montoRecibido === precio;
      const { rows: ventas } = await cliente.query<{ id: string }>(
        `insert into ventas_pos
           (institucion_id, numero, membresia_id, estado, subtotal, total, moneda,
            nota, creada_por, pagada_en)
         values ($1, $2, $3, $4::estado_venta_pos, $5, $5, $6, $7, $8,
                 case when $4 = 'pagada' then now() end)
         returning id`,
        [
          institucionId,
          consecutivo[0].valor,
          inscripcion.membresiaId,
          pagada ? 'pagada' : 'pendiente',
          producto.precio,
          producto.moneda,
          datos.nota ?? null,
          sesion.usuarioId,
        ],
      );
      const ventaId = ventas[0].id;
      await cliente.query(
        `insert into venta_pos_lineas
           (institucion_id, venta_id, producto_id, inscripcion_id, descripcion,
            precio_unitario, total)
         values ($1, $2, $3, $4, $5, $6, $6)`,
        [
          institucionId,
          ventaId,
          producto.id,
          datos.inscripcionId,
          `${producto.nombre} · ${inscripcion.codigoCurso} ${inscripcion.curso}`,
          producto.precio,
        ],
      );
      if (datos.montoRecibido > 0) {
        await this.insertarPago(cliente, sesion, ventaId, {
          monto: datos.montoRecibido,
          metodo: datos.metodo,
          referencia: datos.referencia,
          nota: datos.nota,
        });
      }
      await anotar(
        cliente,
        {
          accion: pagada ? 'pos.venta_cobrada' : 'pos.venta_creada',
          entidad: 'ventas_pos',
          entidadId: ventaId,
          datos: {
            numero: consecutivo[0].valor,
            estudiante: inscripcion.estudiante,
            curso: inscripcion.curso,
            total: producto.precio,
            pagado: datos.montoRecibido,
          },
        },
        origen,
      );
      return { venta: await this.leerVenta(cliente, ventaId) };
    });
  }

  async agregarPago(
    sesion: Sesion,
    id: string,
    datos: AgregarPagoPosDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const venta = await this.leerVentaBloqueada(cliente, id);
      if (venta.estado !== 'pendiente')
        throw new BadRequestException('La venta no admite pagos.');
      const saldo = Number(venta.total) - Number(venta.pagado);
      if (datos.monto > saldo)
        throw new BadRequestException('El pago supera el saldo pendiente.');
      await this.insertarPago(cliente, sesion, id, datos);
      const saldada = datos.monto === saldo;
      if (saldada) {
        await cliente.query(
          `update ventas_pos set estado = 'pagada', pagada_en = now(), actualizado_en = now() where id = $1`,
          [id],
        );
      }
      await anotar(
        cliente,
        {
          accion: 'pos.pago_registrado',
          entidad: 'ventas_pos',
          entidadId: id,
          datos: { monto: datos.monto, metodo: datos.metodo, saldada },
        },
        origen,
      );
      return { venta: await this.leerVenta(cliente, id) };
    });
  }

  async anular(sesion: Sesion, id: string, motivo: string, origen: Origen) {
    if (!motivo.trim())
      throw new BadRequestException('Indica el motivo de anulación.');
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const venta = await this.leerVentaBloqueada(cliente, id);
      if (venta.estado === 'anulada')
        throw new BadRequestException('La venta ya está anulada.');
      const { rows: certificado } = await cliente.query(
        `select c.id from certificados c join venta_pos_lineas l on l.id = c.venta_linea_id
          where l.venta_id = $1 and c.estado = 'emitido'`,
        [id],
      );
      if (certificado[0])
        throw new BadRequestException('Revoca primero el certificado emitido.');
      await cliente.query(
        `update pagos_pos set anulado_en = now(), motivo_anulacion = $2 where venta_id = $1 and anulado_en is null`,
        [id, motivo],
      );
      await cliente.query(
        `update venta_pos_lineas set activa = false where venta_id = $1`,
        [id],
      );
      await cliente.query(
        `update ventas_pos set estado = 'anulada', anulada_en = now(), motivo_anulacion = $2, actualizado_en = now() where id = $1`,
        [id, motivo],
      );
      await anotar(
        cliente,
        {
          accion: 'pos.venta_anulada',
          entidad: 'ventas_pos',
          entidadId: id,
          datos: { numero: venta.numero, motivo },
        },
        origen,
      );
      return { anulada: true };
    });
  }

  private async asegurarProducto(cliente: PoolClient, institucionId: string) {
    await cliente.query(
      `insert into productos_pos (institucion_id, codigo, nombre, tipo, precio)
       values ($1, 'CERTIFICADO', 'Certificado de finalización', 'certificado', 1500.00)
       on conflict (institucion_id, tipo) do nothing`,
      [institucionId],
    );
  }

  private async insertarPago(
    cliente: PoolClient,
    sesion: Sesion,
    ventaId: string,
    datos: {
      monto: number;
      metodo: string;
      referencia?: string | null;
      nota?: string | null;
    },
  ) {
    await cliente.query(
      `insert into pagos_pos
         (institucion_id, venta_id, monto, metodo, referencia, registrado_por, nota)
       values ($1, $2, $3, $4::metodo_pago, $5, $6, $7)`,
      [
        institucionDe(sesion),
        ventaId,
        datos.monto,
        datos.metodo,
        datos.referencia ?? null,
        sesion.usuarioId,
        datos.nota ?? null,
      ],
    );
  }

  private async leerVentaBloqueada(cliente: PoolClient, id: string) {
    const { rows } = await cliente.query<{
      numero: string;
      estado: string;
      total: string;
      pagado: string;
    }>(
      `select v.numero::text as numero, v.estado::text as estado, v.total::text as total,
              coalesce((select sum(p.monto) from pagos_pos p
                         where p.venta_id = v.id and p.anulado_en is null), 0)::text as pagado
         from ventas_pos v where v.id = $1 for update of v`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Esa venta no existe.');
    return rows[0];
  }

  private async leerVenta(cliente: PoolClient, id: string): Promise<VentaPos> {
    const { rows } = await cliente.query<VentaPos>(
      `${VENTA} where v.id = $1 ${AGRUPAR_VENTA}`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Esa venta no existe.');
    return rows[0];
  }
}
