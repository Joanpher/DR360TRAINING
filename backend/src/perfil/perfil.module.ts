import { Module } from '@nestjs/common';
import { PerfilControlador } from './perfil.controlador';
import { PerfilServicio } from './perfil.servicio';

@Module({
  controllers: [PerfilControlador],
  providers: [PerfilServicio],
})
export class PerfilModule {}
