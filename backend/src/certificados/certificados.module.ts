import { Module } from '@nestjs/common';
import { CertificadosControlador } from './certificados.controlador';
import { CertificadosServicio } from './certificados.servicio';

@Module({
  controllers: [CertificadosControlador],
  providers: [CertificadosServicio],
})
export class CertificadosModule {}
