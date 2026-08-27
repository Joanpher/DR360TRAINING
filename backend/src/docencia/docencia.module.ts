import { Module } from '@nestjs/common';
import { DocenciaControlador } from './docencia.controlador';
import { DocenciaServicio } from './docencia.servicio';

@Module({
  controllers: [DocenciaControlador],
  providers: [DocenciaServicio],
})
export class DocenciaModule {}
