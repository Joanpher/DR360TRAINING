import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Actual, Publico, type Sesion } from '../comun/sesion';
import { AuthServicio, type SesionAbierta } from './auth.servicio';
import { ElegirInstitucionDto, EntrarDto, RegistroDto } from './dto/auth.dto';

const COOKIE_REFRESCO = 'educa_refresco';

@Controller('auth')
export class AuthControlador {
  constructor(
    private readonly auth: AuthServicio,
    private readonly config: ConfigService,
  ) {}

  @Publico()
  @Post('registro')
  async registro(
    @Body() datos: RegistroDto,
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const sesion = await this.auth.registrar(
      datos,
      this.ip(peticion),
      this.agente(peticion),
    );
    return this.responder(sesion, respuesta);
  }

  @Publico()
  @HttpCode(HttpStatus.OK)
  @Post('entrar')
  async entrar(
    @Body() datos: EntrarDto,
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const sesion = await this.auth.entrar(
      datos,
      this.ip(peticion),
      this.agente(peticion),
    );
    return this.responder(sesion, respuesta);
  }

  /*
    Lo llama la aplicacion web al arrancar. El access token vive solo en memoria
    del navegador, asi que al recargar la pagina se pierde; el refresco viaja en
    una cookie httpOnly que el JavaScript no puede leer, y con ella se recupera
    la sesion. Es lo que evita tener el token en localStorage, donde cualquier
    script inyectado lo alcanza.
  */
  @Publico()
  @HttpCode(HttpStatus.OK)
  @Post('refrescar')
  async refrescar(
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const ficha = this.leerCookie(peticion);
    const sesion = await this.auth.refrescar(
      ficha ?? '',
      this.ip(peticion),
      this.agente(peticion),
    );
    return this.responder(sesion, respuesta);
  }

  @Publico()
  @HttpCode(HttpStatus.OK)
  @Post('salir')
  async salir(
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    await this.auth.salir(this.leerCookie(peticion));
    respuesta.clearCookie(COOKIE_REFRESCO, this.opcionesCookie(0));
    return { salio: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('institucion')
  async elegirInstitucion(
    @Actual() sesion: Sesion,
    @Body() datos: ElegirInstitucionDto,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const abierta = await this.auth.elegirInstitucion(
      sesion,
      datos.institucionId,
    );
    return this.responder(abierta, respuesta);
  }

  @Get('yo')
  async yo(@Actual() sesion: Sesion) {
    return this.auth.yo(sesion);
  }

  // ---------------------------------------------------------------------------

  private responder(sesion: SesionAbierta, respuesta: Response) {
    // Al elegir institucion no se emite refresco nuevo: la sesion es la misma,
    // solo cambia el contexto que lleva el access token.
    if (sesion.refresco) {
      const dias = Number(this.config.get('REFRESCO_DIAS') ?? 30);
      respuesta.cookie(
        COOKIE_REFRESCO,
        sesion.refresco,
        this.opcionesCookie(dias * 24 * 60 * 60 * 1000),
      );
    }

    return {
      acceso: sesion.acceso,
      usuario: sesion.usuario,
      instituciones: sesion.instituciones,
      institucionActual: sesion.institucionActual,
    };
  }

  private opcionesCookie(maxEdad: number) {
    const enProduccion = this.config.get('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      sameSite: enProduccion ? ('strict' as const) : ('lax' as const),
      secure: enProduccion,
      path: '/api/auth',
      maxAge: maxEdad,
    };
  }

  private leerCookie(peticion: Request): string | undefined {
    return (peticion.cookies as Record<string, string> | undefined)?.[
      COOKIE_REFRESCO
    ];
  }

  private ip(peticion: Request): string {
    return peticion.ip ?? '';
  }

  private agente(peticion: Request): string {
    return peticion.headers['user-agent'] ?? '';
  }
}
