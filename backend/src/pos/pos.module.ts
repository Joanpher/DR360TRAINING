import { Module } from '@nestjs/common';
import { PosControlador } from './pos.controlador';
import { PosServicio } from './pos.servicio';

/*
  El servicio se exporta porque certificados cobra y emite en una sola
  transaccion, y la venta de esa transaccion tiene que ser exactamente la misma
  que crea la caja. Ver PosServicio.crearVentaEn.
*/
@Module({
  controllers: [PosControlador],
  providers: [PosServicio],
  exports: [PosServicio],
})
export class PosModule {}
