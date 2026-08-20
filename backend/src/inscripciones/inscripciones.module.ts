import { Module } from '@nestjs/common';
import { CobrosServicio } from './cobros.servicio';
import { InscripcionesControlador } from './inscripciones.controlador';
import { InscripcionesServicio } from './inscripciones.servicio';

@Module({
  controllers: [InscripcionesControlador],
  providers: [InscripcionesServicio, CobrosServicio],
})
export class InscripcionesModule {}
