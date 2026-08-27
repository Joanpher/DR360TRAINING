import { BadRequestException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import type { Sesion } from '../comun/sesion';
import { PosServicio } from './pos.servicio';

const sesion: Sesion = {
  usuarioId: '10000000-0000-4000-8000-000000000001',
  sesionId: '10000000-0000-4000-8000-000000000002',
  institucionId: '10000000-0000-4000-8000-000000000003',
  correo: 'admin@ejemplo.test',
  roles: ['administrador'],
};

function preparar() {
  const query = jest.fn();
  const cliente = { query } as unknown as PoolClient;
  const bd = {
    conContexto: <T>(
      _contexto: unknown,
      trabajo: (c: PoolClient) => Promise<T>,
    ) => trabajo(cliente),
  } as unknown as BaseDatos;
  return { servicio: new PosServicio(bd), query };
}

describe('PosServicio', () => {
  it('rechaza vender un certificado en un curso que no lo ofrece', async () => {
    const { servicio, query } = preparar();
    query.mockResolvedValueOnce({
      rows: [
        {
          membresiaId: '10000000-0000-4000-8000-000000000004',
          estudiante: 'Ana Pérez',
          codigoCurso: 'CUR-1',
          curso: 'Curso sin certificado',
          estado: 'completada',
          certificado: false,
        },
      ],
    });

    await expect(
      servicio.crearVenta(
        sesion,
        {
          inscripcionId: '10000000-0000-4000-8000-000000000005',
          productoId: '10000000-0000-4000-8000-000000000006',
          montoRecibido: 100,
          metodo: 'efectivo',
        },
        { ip: null, agente: null },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rechaza un pago mayor que el precio congelado del producto', async () => {
    const { servicio, query } = preparar();
    query
      .mockResolvedValueOnce({
        rows: [
          {
            membresiaId: '10000000-0000-4000-8000-000000000004',
            estudiante: 'Ana Pérez',
            codigoCurso: 'CUR-1',
            curso: 'Curso con certificado',
            estado: 'completada',
            certificado: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '10000000-0000-4000-8000-000000000006',
            nombre: 'Certificado',
            tipo: 'certificado',
            precio: '1500.00',
            moneda: 'DOP',
            activo: true,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      servicio.crearVenta(
        sesion,
        {
          inscripcionId: '10000000-0000-4000-8000-000000000005',
          productoId: '10000000-0000-4000-8000-000000000006',
          montoRecibido: 1500.01,
          metodo: 'efectivo',
        },
        { ip: null, agente: null },
      ),
    ).rejects.toThrow('supera el total');
    expect(query).toHaveBeenCalledTimes(3);
  });
});
