import { Controller, Get } from '@nestjs/common';
import { Publico } from './comun/sesion';
import { BaseDatos } from './basedatos/basedatos.servicio';

@Controller()
export class AppControlador {
  constructor(private readonly bd: BaseDatos) {}

  /*
    Comprueba que la API responde y que la base contesta. Sin contexto, que es
    justo lo que debe poder hacerse sin estar autenticado.
  */
  @Publico()
  @Get('salud')
  async salud() {
    const base = await this.bd
      .conIdentidad(async (cliente) => {
        await cliente.query('select 1');
        return 'ok';
      })
      .catch(() => 'sin conexion');

    return { api: 'ok', base, momento: new Date().toISOString() };
  }
}
