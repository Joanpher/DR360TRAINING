import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JitsiServicio } from './jitsi.servicio';
import { ReunionesControlador } from './reuniones.controlador';
import { ReunionesServicio } from './reuniones.servicio';

/*
  AuthModule se importa por el JwtModule que reexporta, no por AuthServicio.
  JitsiServicio necesita firmar, y lo hace con un secreto distinto -el del
  servidor de videollamadas, no el de las sesiones-, que pasa en cada llamada.

  Registrar aqui un segundo JwtModule daria dos proveedores del mismo token de
  inyeccion, y cual gana dependeria del orden de los imports: la clase de fallo
  que solo aparece al reordenar una lista.
*/
@Module({
  imports: [AuthModule],
  controllers: [ReunionesControlador],
  providers: [ReunionesServicio, JitsiServicio],
  exports: [ReunionesServicio],
})
export class ReunionesModule {}
