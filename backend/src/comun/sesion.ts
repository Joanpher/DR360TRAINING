import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

/*
  Lo que viaja dentro del access token. Es deliberadamente corto: identifica al
  usuario, la sesion y la institucion elegida, y nada mas. Los roles van solo
  para que la interfaz sepa que dibujar; quien de verdad decide que se puede
  hacer es la base de datos, con las mismas politicas para todos.
*/
export type Sesion = {
  usuarioId: string;
  sesionId: string;
  correo: string;
  institucionId: string | null;
  roles: string[];
};

export type PeticionConSesion = Request & { sesion?: Sesion };

export const PUBLICO = 'publico';
export const Publico = () => SetMetadata(PUBLICO, true);

export const ROLES = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES, roles);

/* Inyecta la sesion ya verificada en el metodo del controlador. */
export const Actual = createParamDecorator(
  (_: unknown, contexto: ExecutionContext): Sesion => {
    const peticion = contexto.switchToHttp().getRequest<PeticionConSesion>();
    if (!peticion.sesion) throw new UnauthorizedException('Sesion no iniciada.');
    return peticion.sesion;
  },
);

@Injectable()
export class GuardiaAcceso implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublico) return true;

    const peticion = contexto.switchToHttp().getRequest<PeticionConSesion>();
    const cabecera = peticion.headers.authorization ?? '';
    const [esquema, ficha] = cabecera.split(' ');

    if (esquema !== 'Bearer' || !ficha) {
      throw new UnauthorizedException('Falta el token de acceso.');
    }

    let carga: {
      sub: string;
      sid: string;
      correo: string;
      ins: string | null;
      roles: string[];
    };
    try {
      carga = await this.jwt.verifyAsync(ficha);
    } catch {
      throw new UnauthorizedException('El token de acceso no es valido o expiro.');
    }

    peticion.sesion = {
      usuarioId: carga.sub,
      sesionId: carga.sid,
      correo: carga.correo,
      institucionId: carga.ins ?? null,
      roles: carga.roles ?? [],
    };

    return this.comprobarRoles(contexto, peticion.sesion);
  }

  /*
    Este chequeo es comodidad, no seguridad: devuelve un 403 legible en vez de
    dejar que la consulta llegue a la base y vuelva con cero filas. Quitarlo no
    abriria ningun dato, porque las politicas siguen ahi.
  */
  private comprobarRoles(contexto: ExecutionContext, sesion: Sesion): boolean {
    const exigidos = this.reflector.getAllAndOverride<string[]>(ROLES, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!exigidos?.length) return true;

    if (!sesion.institucionId) {
      throw new ForbiddenException('Primero elige una institucion.');
    }
    if (!exigidos.some((rol) => sesion.roles.includes(rol))) {
      throw new ForbiddenException('Tu rol no alcanza para esta operacion.');
    }
    return true;
  }
}
