import { Module } from '@nestjs/common';
import { PosModule } from '../pos/pos.module';
import { CertificadosControlador } from './certificados.controlador';
import { CertificadosServicio } from './certificados.servicio';
import { MisCertificadosControlador } from './mis-certificados.controlador';

@Module({
  imports: [PosModule],
  controllers: [CertificadosControlador, MisCertificadosControlador],
  providers: [CertificadosServicio],
})
export class CertificadosModule {}
