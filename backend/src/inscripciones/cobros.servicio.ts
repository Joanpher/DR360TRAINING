import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type { ConceptoDto, RegistrarPagoDto } from './dto/inscripciones.dto';

export type Concepto = {
  id: string;
  anoEscolarId: string | null;
  ano: string | null;
  nombre: string;
  tipo: string;
  monto: string;
  cuotas: number | null;
  diaVencimiento: number | null;
  obligatorio: boolean;
  activo: boolean;
  cargos: number;
};

/*
  Los montos viajan como texto, no como number.

  numeric(12,2) en Postgres tiene mas precision que el double de JavaScript, y
  convertirlo a number para volver a serializarlo es donde aparecen los 1499.99
  que deberian ser 1500.00. El navegador lo formatea para mostrarlo y lo manda
  de vuelta como numero solo cuando el usuario escribe una cifra nueva.
*/
const LISTA_CONCEPTOS = `
  select c.id, c.ano_escolar_id as "anoEscolarId", a.codigo as ano,
         c.nombre, c.tipo::text as tipo, c.monto::text as monto,
         c.cuotas, c.dia_vencimiento as "diaVencimiento",
         c.obligatorio, c.activo,
         (select count(*)::int from cargos g where g.concepto_id = c.id) as cargos
    from conceptos_cobro c
    left join anos_escolares a on a.id = c.ano_escolar_id
   order by c.tipo, c.nombre
`;

@Injectable()
export class CobrosServicio {
  constructor(private readonly bd: BaseDatos) {}

  async listarConceptos(sesion: Sesion): Promise<{ conceptos: Concepto[] }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Concepto>(LISTA_CONCEPTOS);
      return { conceptos: rows };
    });
  }

  async crearConcepto(sesion: Sesion, datos: ConceptoDto, origen: Origen) {
    if (datos.tipo === 'mensualidad' && !datos.cuotas) {
      throw new BadRequestException(
        'Una mensualidad necesita saber cuantas cuotas se generan.',
      );
    }

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into conceptos_cobro
           (institucion_id, ano_escolar_id, nombre, tipo, monto, cuotas,
            dia_vencimiento, obligatorio, activo)
         values ($1, $2, $3, $4::tipo_concepto, $5::numeric, $6, $7, $8, $9)
         returning id`,
        [
          institucionDe(sesion),
          datos.anoEscolarId ?? null,
          datos.nombre,
          datos.tipo,
          datos.monto,
          datos.tipo === 'mensualidad' ? (datos.cuotas ?? 10) : null,
          datos.diaVencimiento ?? null,
          datos.obligatorio ?? true,
          datos.activo ?? true,
        ],
      );

      await anotar(
        cliente,
        {
          accion: 'concepto_cobro.creado',
          entidad: 'conceptos_cobro',
          entidadId: rows[0].id,
          datos: { nombre: datos.nombre, tipo: datos.tipo, monto: datos.monto },
        },
        origen,
      );

      const { rows: conceptos } = await cliente.query<Concepto>(LISTA_CONCEPTOS);
      return { conceptos };
    });
  }

  /*
    Cambiar el precio de un concepto NO reescribe los cargos ya emitidos. Es la
    razon de que cargos.monto sea una copia: lo facturado en enero no puede
    cambiar porque en marzo suba la mensualidad.
  */
  async actualizarConcepto(sesion: Sesion, id: string, datos: ConceptoDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows: antes } = await cliente.query<{ nombre: string; monto: string }>(
        `select nombre, monto::text as monto from conceptos_cobro where id = $1 for update`,
        [id],
      );
      if (!antes[0]) throw new NotFoundException('Ese concepto no existe.');

      await cliente.query(
        `update conceptos_cobro set
            nombre = $2, tipo = $3::tipo_concepto, monto = $4::numeric,
            cuotas = $5, dia_vencimiento = $6, obligatorio = $7, activo = $8
          where id = $1`,
        [
          id,
          datos.nombre,
          datos.tipo,
          datos.monto,
          datos.tipo === 'mensualidad' ? (datos.cuotas ?? 10) : null,
          datos.diaVencimiento ?? null,
          datos.obligatorio ?? true,
          datos.activo ?? true,
        ],
      );

      await anotar(
        cliente,
        {
          accion: 'concepto_cobro.actualizado',
          entidad: 'conceptos_cobro',
          entidadId: id,
          datos: {
            nombre: datos.nombre,
            montoAntes: antes[0].monto,
            montoDespues: String(datos.monto),
          },
        },
        origen,
      );

      const { rows: conceptos } = await cliente.query<Concepto>(LISTA_CONCEPTOS);
      return { conceptos };
    });
  }

  async eliminarConcepto(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ nombre: string; cargos: number }>(
        `select c.nombre,
                (select count(*)::int from cargos g where g.concepto_id = c.id) as cargos
           from conceptos_cobro c where c.id = $1`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('Ese concepto no existe.');

      if (rows[0].cargos > 0) {
        throw new BadRequestException(
          `Ya se emitieron ${rows[0].cargos} cargos con ese concepto. Desactivalo en vez de eliminarlo.`,
        );
      }

      await cliente.query('delete from conceptos_cobro where id = $1', [id]);

      await anotar(
        cliente,
        {
          accion: 'concepto_cobro.eliminado',
          entidad: 'conceptos_cobro',
          entidadId: id,
          datos: { nombre: rows[0].nombre },
        },
        origen,
      );

      const { rows: conceptos } = await cliente.query<Concepto>(LISTA_CONCEPTOS);
      return { conceptos };
    });
  }

  // ---------------------------------------------------------------------------
  // Pagos
  // ---------------------------------------------------------------------------
  /*
    Un pago se registra contra un cargo. Cuando lo pagado alcanza el monto, el
    cargo pasa a pagado; hasta entonces sigue pendiente, lo que permite los
    abonos parciales que en un colegio son la norma.

    La suma se hace en la base y no en TypeScript: sumar numeric en Postgres es
    exacto, y sumar el equivalente en coma flotante no.
  */
  async registrarPago(sesion: Sesion, cargoId: string, datos: RegistrarPagoDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const cargo = await this.leerCargo(cliente, cargoId);

      if (cargo.estado === 'anulado' || cargo.estado === 'condonado') {
        throw new BadRequestException(`Ese cargo esta ${cargo.estado}: no admite pagos.`);
      }

      await cliente.query(
        `insert into pagos
           (institucion_id, cargo_id, monto, metodo, referencia, recibido_en,
            registrado_por, nota)
         values ($1, $2, $3::numeric, $4::metodo_pago, $5, coalesce($6::date, current_date),
                 $7, $8)`,
        [
          institucionDe(sesion),
          cargoId,
          datos.monto,
          datos.metodo,
          datos.referencia ?? null,
          datos.recibidoEn ?? null,
          sesion.usuarioId,
          datos.nota ?? null,
        ],
      );

      const { rows: saldo } = await cliente.query<{ pagado: string; saldado: boolean }>(
        `select coalesce(sum(p.monto), 0)::text as pagado,
                coalesce(sum(p.monto), 0) >= c.monto as saldado
           from cargos c
           left join pagos p on p.cargo_id = c.id and p.anulado_en is null
          where c.id = $1
          group by c.monto`,
        [cargoId],
      );

      if (saldo[0]?.saldado) {
        await cliente.query(
          `update cargos set estado = 'pagado'::estado_cargo where id = $1`,
          [cargoId],
        );
      }

      await anotar(
        cliente,
        {
          accion: 'pago.registrado',
          entidad: 'cargos',
          entidadId: cargoId,
          datos: {
            descripcion: cargo.descripcion,
            monto: String(datos.monto),
            metodo: datos.metodo,
            referencia: datos.referencia ?? null,
            saldado: saldo[0]?.saldado ?? false,
          },
        },
        origen,
      );

      return {
        pagado: saldo[0]?.pagado ?? '0',
        estado: saldo[0]?.saldado ? 'pagado' : 'pendiente',
      };
    });
  }

  /*
    Anular es lo contrario de borrar: la fila se queda con la marca y el motivo.
    El rol de la aplicacion ni siquiera tiene permiso de delete sobre pagos, asi
    que un error de programacion tampoco puede hacer desaparecer un recibo.
  */
  async anularPago(sesion: Sesion, pagoId: string, motivo: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ cargoId: string; monto: string }>(
        `update pagos set anulado_en = now(), motivo_anulacion = $2
          where id = $1 and anulado_en is null
        returning cargo_id as "cargoId", monto::text as monto`,
        [pagoId, motivo],
      );
      if (!rows[0]) throw new NotFoundException('Ese pago no existe o ya estaba anulado.');

      // Al quitar un pago el cargo puede dejar de estar saldado.
      await cliente.query(
        `update cargos c set estado = 'pendiente'::estado_cargo
          where c.id = $1 and c.estado = 'pagado'
            and coalesce((select sum(p.monto) from pagos p
                           where p.cargo_id = c.id and p.anulado_en is null), 0) < c.monto`,
        [rows[0].cargoId],
      );

      await anotar(
        cliente,
        {
          accion: 'pago.anulado',
          entidad: 'cargos',
          entidadId: rows[0].cargoId,
          datos: { pagoId, monto: rows[0].monto, motivo },
        },
        origen,
      );

      return { anulado: true };
    });
  }

  async condonarCargo(sesion: Sesion, cargoId: string, motivo: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const cargo = await this.leerCargo(cliente, cargoId);

      if (cargo.estado === 'pagado') {
        throw new BadRequestException('Ese cargo ya esta pagado.');
      }

      await cliente.query(
        `update cargos set estado = 'condonado'::estado_cargo, motivo = $2 where id = $1`,
        [cargoId, motivo],
      );

      await anotar(
        cliente,
        {
          accion: 'cargo.condonado',
          entidad: 'cargos',
          entidadId: cargoId,
          datos: { descripcion: cargo.descripcion, monto: cargo.monto, motivo },
        },
        origen,
      );

      return { condonado: true };
    });
  }

  private async leerCargo(cliente: PoolClient, id: string) {
    const { rows } = await cliente.query<{
      descripcion: string;
      monto: string;
      estado: string;
    }>(
      `select descripcion, monto::text as monto, estado::text as estado
         from cargos where id = $1 for update`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Ese cargo no existe.');
    return rows[0];
  }
}
