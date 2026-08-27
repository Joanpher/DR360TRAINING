import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import type { Sesion } from '../comun/sesion';
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
  return { servicio: new CertificadosServicio(bd, config), query };
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
