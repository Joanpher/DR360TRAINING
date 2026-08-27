import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import type { Sesion } from '../comun/sesion';
import type { PosServicio } from '../pos/pos.servicio';
import { CertificadosServicio } from './certificados.servicio';

const sesion: Sesion = {
  usuarioId: '10000000-0000-4000-8000-000000000001',
  sesionId: '10000000-0000-4000-8000-000000000002',
  institucionId: '10000000-0000-4000-8000-000000000003',
  correo: 'admin@ejemplo.test',
  roles: ['administrador'],
};

function preparar(estadoVenta: string, estadoInscripcion: string) {
  const query = jest.fn().mockResolvedValueOnce({
    rows: [
      {
        lineaId: '10000000-0000-4000-8000-000000000004',
        inscripcionId: '10000000-0000-4000-8000-000000000005',
        estadoVenta,
        estadoInscripcion,
        estudiante: 'Ana Pérez',
        curso: 'Curso de prueba',
        codigoCurso: 'CUR-1',
      },
    ],
  });
  const cliente = { query } as unknown as PoolClient;
  const bd = {
    conContexto: <T>(
      _contexto: unknown,
      trabajo: (c: PoolClient) => Promise<T>,
    ) => trabajo(cliente),
  } as unknown as BaseDatos;
  const config = { get: jest.fn() } as unknown as ConfigService;
  /*
    El POS entra en el constructor desde que cobrar y emitir caben en una
    transaccion, pero ninguna de estas dos pruebas llega a usarlo: si alguna vez
    lo llamara, este doble sin metodos falla en alto en vez de fingir una venta.
  */
  const pos = {} as unknown as PosServicio;
  return { servicio: new CertificadosServicio(bd, config, pos), query };
}

describe('CertificadosServicio', () => {
  it('bloquea la emisión cuando la venta del POS no está saldada', async () => {
    const { servicio, query } = preparar('pendiente', 'completada');
    await expect(
      servicio.emitir(sesion, '10000000-0000-4000-8000-000000000006', {
        ip: null,
        agente: null,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('bloquea la emisión mientras el curso no esté completado', async () => {
    const { servicio, query } = preparar('pagada', 'activa');
    await expect(
      servicio.emitir(sesion, '10000000-0000-4000-8000-000000000006', {
        ip: null,
        agente: null,
      }),
    ).rejects.toThrow('todavía no ha completado');
    expect(query).toHaveBeenCalledTimes(1);
  });
});

/*
  Cobrar y emitir de una pulsacion tiene una regla que no se ve en el tipo de
  retorno y por eso hay que fijarla aqui: cobrar a medias es legitimo, emitir a
  medias no. Estas dos pruebas cubren las dos ramas que deciden eso, porque son
  las que un refactor futuro puede invertir sin que nada mas se queje.
*/
function prepararCobro(estadoVenta: string, estadoInscripcion: string) {
  const producto = {
    id: '10000000-0000-4000-8000-000000000010',
    nombre: 'Certificado de finalización',
    precio: '1500.00',
    moneda: 'DOP',
    activo: true,
  };
  const query = jest
    .fn()
    // El insert idempotente del producto, que no devuelve filas utiles.
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [producto] })
    // El estado de la inscripcion, que solo se consulta si la venta quedo saldada.
    .mockResolvedValueOnce({ rows: [{ estado: estadoInscripcion }] });

  const cliente = { query } as unknown as PoolClient;
  const bd = {
    conContexto: <T>(
      _contexto: unknown,
      trabajo: (c: PoolClient) => Promise<T>,
    ) => trabajo(cliente),
  } as unknown as BaseDatos;
  const config = { get: jest.fn() } as unknown as ConfigService;
  const crearVentaEn = jest.fn().mockResolvedValue({
    venta: { id: '10000000-0000-4000-8000-000000000011', estado: estadoVenta },
  });
  const pos = { crearVentaEn } as unknown as PosServicio;

  return {
    servicio: new CertificadosServicio(bd, config, pos),
    query,
    crearVentaEn,
  };
}

describe('CertificadosServicio · cobrar', () => {
  it('cobra sin emitir cuando el abono no salda la venta', async () => {
    const { servicio, crearVentaEn } = prepararCobro('pendiente', 'completada');

    const resultado = await servicio.cobrar(
      sesion,
      {
        inscripcionId: '10000000-0000-4000-8000-000000000005',
        montoRecibido: 500,
        metodo: 'efectivo',
      },
      { ip: null, agente: null },
    );

    expect(crearVentaEn).toHaveBeenCalledTimes(1);
    expect(resultado.emitido).toBe(false);
    expect(resultado.certificado).toBeNull();
  });

  it('cobra sin emitir mientras el curso no este completado', async () => {
    const { servicio } = prepararCobro('pagada', 'activa');

    const resultado = await servicio.cobrar(
      sesion,
      {
        inscripcionId: '10000000-0000-4000-8000-000000000005',
        metodo: 'efectivo',
      },
      { ip: null, agente: null },
    );

    expect(resultado.emitido).toBe(false);
    expect(resultado.certificado).toBeNull();
  });
});
