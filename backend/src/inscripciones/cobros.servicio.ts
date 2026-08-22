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
import type { CargoDto, RegistrarPagoDto } from './dto/inscripciones.dto';

/*
  El dinero se registra, no se procesa. El sistema emite los cargos y guarda los
  pagos que la administracion recibe; no cobra con tarjeta.

  El cargo del curso lo genera la inscripcion. Aqui viven los extras -material,
  repeticion de examen, certificado impreso- y todo el ciclo del pago: recibir,
  anular, condonar.

  Ya no hay conceptos_cobro. Existia para desplegar diez mensualidades desde una
  plantilla anual, y un curso no se paga en diez meses: se paga, o se abona
  hasta pagarse.
*/
@Injectable()
export class CobrosServicio {
  constructor(private readonly bd: BaseDatos) {}

  // ---------------------------------------------------------------------------
  // Cargos
  // ---------------------------------------------------------------------------

  async crearCargo(
    sesion: Sesion,
    inscripcionId: string,
    datos: CargoDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows: existe } = await cliente.query<{ nombre: string }>(
        `select u.nombre_completo as nombre
           from inscripciones i
           join membresias m on m.id = i.membresia_id
           join usuarios u on u.id = m.usuario_id
          where i.id = $1`,
        [inscripcionId],
      );
      if (!existe[0]) throw new NotFoundException('Esa inscripcion no existe.');

      const { rows } = await cliente.query<{ id: string }>(
        `insert into cargos (institucion_id, inscripcion_id, descripcion, monto, vence_en)
         values ($1, $2, $3, $4::numeric, $5::date)
         returning id`,
        [
          institucionDe(sesion),
          inscripcionId,
          datos.descripcion,
          datos.monto,
          datos.venceEn ?? null,
        ],
      );

      await anotar(
        cliente,
        {
          accion: 'cargo.creado',
          entidad: 'cargos',
          entidadId: rows[0].id,
          datos: {
            alumno: existe[0].nombre,
            descripcion: datos.descripcion,
            monto: datos.monto.toFixed(2),
          },
        },
        origen,
      );

      return { id: rows[0].id };
    });
  }

  /*
    Condonar es perdonar lo que se debe: una beca que se aprueba tarde, un
    acuerdo. El cargo se queda con el motivo escrito, porque un descuadre sin
    explicacion es lo que despues nadie sabe justificar.
  */
  async condonarCargo(
    sesion: Sesion,
    cargoId: string,
    motivo: string,
    origen: Origen,
  ) {
    if (!motivo.trim()) {
      throw new BadRequestException('Condonar un cargo exige decir por que.');
    }

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const cargo = await this.leerCargo(cliente, cargoId);

      if (cargo.estado === 'pagado') {
        throw new BadRequestException('Ese cargo ya esta pagado.');
      }
      if (cargo.estado === 'condonado') {
        throw new BadRequestException('Ese cargo ya estaba condonado.');
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

  /*
    Anular un cargo es distinto de condonarlo: condonar dice "se debia y lo
    perdonamos", anular dice "nunca debio emitirse". Un cargo con pagos encima
    no se anula, porque entonces el dinero recibido no tendria contra que ir.
  */
  async anularCargo(
    sesion: Sesion,
    cargoId: string,
    motivo: string,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const cargo = await this.leerCargo(cliente, cargoId);

      const { rows: pagos } = await cliente.query<{ total: number }>(
        `select count(*)::int as total from pagos
          where cargo_id = $1 and anulado_en is null`,
        [cargoId],
      );

      if (pagos[0].total > 0) {
        throw new BadRequestException(
          'Ese cargo tiene pagos registrados. Anula primero los pagos, o condonalo.',
        );
      }

      await cliente.query(
        `update cargos set estado = 'anulado'::estado_cargo, anulado_en = now(), motivo = $2
          where id = $1`,
        [cargoId, motivo || null],
      );

      await anotar(
        cliente,
        {
          accion: 'cargo.anulado',
          entidad: 'cargos',
          entidadId: cargoId,
          datos: { descripcion: cargo.descripcion, monto: cargo.monto, motivo },
        },
        origen,
      );

      return { anulado: true };
    });
  }

  // ---------------------------------------------------------------------------
  // Pagos
  // ---------------------------------------------------------------------------
  /*
    Un pago se registra contra un cargo. Cuando lo pagado alcanza el monto, el
    cargo pasa a pagado; hasta entonces sigue pendiente, lo que permite los
    abonos parciales que en un centro de cursos son la norma: la mitad al
    inscribirse y el resto a mitad del curso.

    La suma se hace en la base y no en TypeScript: sumar numeric en Postgres es
    exacto, y sumar el equivalente en coma flotante no.
  */
  async registrarPago(
    sesion: Sesion,
    cargoId: string,
    datos: RegistrarPagoDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const cargo = await this.leerCargo(cliente, cargoId);

      if (cargo.estado === 'anulado' || cargo.estado === 'condonado') {
        throw new BadRequestException(
          `Ese cargo esta ${cargo.estado}: no admite pagos.`,
        );
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

      const { rows: saldo } = await cliente.query<{
        pagado: string;
        saldado: boolean;
      }>(
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
            monto: datos.monto.toFixed(2),
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
  async anularPago(
    sesion: Sesion,
    pagoId: string,
    motivo: string,
    origen: Origen,
  ) {
    if (!motivo.trim()) {
      throw new BadRequestException('Anular un pago exige decir por que.');
    }

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ cargoId: string; monto: string }>(
        `update pagos set anulado_en = now(), motivo_anulacion = $2
          where id = $1 and anulado_en is null
        returning cargo_id as "cargoId", monto::text as monto`,
        [pagoId, motivo],
      );
      if (!rows[0])
        throw new NotFoundException('Ese pago no existe o ya estaba anulado.');

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
