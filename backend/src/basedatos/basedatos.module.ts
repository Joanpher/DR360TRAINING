import { Global, Module } from '@nestjs/common';
import { BaseDatos } from './basedatos.servicio';

@Global()
@Module({
  providers: [BaseDatos],
  exports: [BaseDatos],
})
export class BaseDatosModule {}
