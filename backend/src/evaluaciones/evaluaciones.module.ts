import { Module } from '@nestjs/common';
import { EvaluacionesControlador } from './evaluaciones.controlador';
import { EvaluacionesServicio } from './evaluaciones.servicio';

@Module({
  controllers: [EvaluacionesControlador],
  providers: [EvaluacionesServicio],
})
export class EvaluacionesModule {}
