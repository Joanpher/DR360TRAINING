import { Module } from '@nestjs/common';
import { AcademicoControlador } from './academico.controlador';
import { AnosServicio } from './anos.servicio';
import { AsignaturasServicio } from './asignaturas.servicio';
import { GradosServicio } from './grados.servicio';
import { SeccionesServicio } from './secciones.servicio';
import { SedesServicio } from './sedes.servicio';
import { UnidadesServicio } from './unidades.servicio';

@Module({
  controllers: [AcademicoControlador],
  providers: [
    AnosServicio,
    GradosServicio,
    AsignaturasServicio,
    SeccionesServicio,
    SedesServicio,
    UnidadesServicio,
  ],
})
export class AcademicoModule {}
