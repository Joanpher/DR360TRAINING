import { Module } from '@nestjs/common';
import { ForoControlador } from './foro.controlador';
import { ForoServicio } from './foro.servicio';

@Module({
  controllers: [ForoControlador],
  providers: [ForoServicio],
})
export class ForoModule {}
