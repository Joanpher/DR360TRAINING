import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { DeDonde, type Origen } from '../comun/auditoria';
import { Actual, type Sesion } from '../comun/sesion';
import { CertificadosServicio } from './certificados.servicio';

/*
  El certificado visto desde el portal. Va en un controlador aparte y no como
  dos metodos mas del de administracion por una razon concreta: aquel lleva
  @Roles('propietario', 'administrador') a nivel de clase, y anadir aqui rutas
  sin rol obligaria a acordarse de quitarselo metodo a metodo. Un dia alguien no
  se acuerda.

  Aqui no hay @Roles ninguno, y no es un descuido: cualquier miembro de la
  institucion puede pedir "mis certificados", y lo que le sale es solo lo suyo
  porque lo decide la politica certificados_lectura_propia, no este archivo. Un
  docente que nunca compro uno recibe una lista vacia, que es la respuesta
  correcta.
*/
@Controller('portal/certificados')
export class MisCertificadosControlador {
  constructor(private readonly certificados: CertificadosServicio) {}

  @Get() mios(@Actual() s: Sesion) {
    return this.certificados.mios(s);
  }

  @Get(':id') detalle(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.certificados.mio(s, id);
  }

  @HttpCode(200)
  @Post(':id/impresiones')
  imprimir(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.certificados.registrarImpresionPropia(s, id, o);
  }
}
