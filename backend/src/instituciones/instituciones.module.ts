import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitucionesControlador } from './instituciones.controlador';
import { InstitucionesServicio } from './instituciones.servicio';

@Module({
  imports: [AuthModule],
  controllers: [InstitucionesControlador],
  providers: [InstitucionesServicio],
})
export class InstitucionesModule {}
