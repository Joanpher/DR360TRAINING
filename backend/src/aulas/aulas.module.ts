import { Module } from '@nestjs/common';
import { AulasControlador } from './aulas.controlador';
import { AulasServicio } from './aulas.servicio';

@Module({
  controllers: [AulasControlador],
  providers: [AulasServicio],
})
export class AulasModule {}
