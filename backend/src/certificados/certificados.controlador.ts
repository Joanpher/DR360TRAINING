import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { DeDonde, type Origen } from '../comun/auditoria';
import { Actual, Roles, type Sesion } from '../comun/sesion';
import { CertificadosServicio } from './certificados.servicio';
import {
  EmitirCertificadoDto,
  EnviarCertificadoDto,
  ListarCertificadosDto,
  RevocarCertificadoDto,
} from './dto/certificados.dto';

@Roles('propietario', 'administrador')
@Controller('certificados')
export class CertificadosControlador {
  constructor(private readonly certificados: CertificadosServicio) {}

  @Get() listar(@Actual() s: Sesion, @Query() f: ListarCertificadosDto) {
    return this.certificados.listar(s, f);
  }
  @Get(':id') detalle(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.certificados.detalle(s, id);
  }
  @Post('emitir') emitir(
    @Actual() s: Sesion,
    @Body() d: EmitirCertificadoDto,
    @DeDonde() o: Origen,
  ) {
    return this.certificados.emitir(s, d.ventaId, o);
  }
  @HttpCode(200)
  @Post(':id/impresiones')
  imprimir(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.certificados.registrarImpresion(s, id, o);
  }
  @HttpCode(200)
  @Post(':id/correo')
  enviar(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: EnviarCertificadoDto,
    @DeDonde() o: Origen,
  ) {
    return this.certificados.enviarCorreo(s, id, d.correo, o);
  }
  @HttpCode(200)
  @Post(':id/revocar')
  revocar(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: RevocarCertificadoDto,
    @DeDonde() o: Origen,
  ) {
    return this.certificados.revocar(s, id, d.motivo, o);
  }
}
