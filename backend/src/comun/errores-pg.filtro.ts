import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseError } from 'pg';

/*
  Buena parte de las reglas de este sistema viven en la base: unicidad por
  institucion, claves foraneas compuestas que no cruzan tenants, politicas de
  RLS, triggers. Cuando una de ellas se dispara, el error de Postgres es la
  regla hablando, no un fallo del servidor. Traducirlo a un 500 seria esconder
  justo la informacion util.

  Lo que no se traduce a un mensaje concreto sale como 403 o 400 generico: un
  detalle interno de la base no deberia llegar nunca al navegador.
*/

const MENSAJES_UNICIDAD: Record<string, string> = {
  usuarios_correo_uk: 'Ya existe una cuenta con ese correo.',
  instituciones_slug_uk:
    'Ese identificador ya esta tomado por otra institucion.',
  membresias_usuario_uk: 'Esa persona ya pertenece a la institucion.',
  membresias_codigo_uk: 'Ya hay alguien con ese codigo o matricula.',
  sedes_codigo_uk: 'Ya existe una sede con ese codigo.',
  sedes_principal_uk: 'La institucion ya tiene una sede principal.',
  membresias_codigo_global_uk: 'Esa matricula ya esta en uso en la plataforma.',
  invitaciones_pendiente_uk: 'Esa persona ya tiene una invitacion pendiente.',
  dominios_institucion_uk: 'Ese dominio ya pertenece a otra institucion.',
  categorias_nombre_uk: 'Ya existe una categoria con ese nombre.',
  cursos_codigo_uk: 'Ya existe un curso con ese codigo.',
  curso_horarios_bloque_uk:
    'Ese curso ya tiene un bloque que empieza a esa hora ese dia.',
  participantes_documento_uk: 'Ya hay alguien registrado con ese documento.',
  inscripciones_curso_persona_uk: 'Esa persona ya esta inscrita en ese curso.',
};

const NOMBRES_HTTP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

@Catch(DatabaseError)
export class FiltroErroresPg implements ExceptionFilter {
  private readonly bitacora = new Logger('Postgres');

  catch(error: DatabaseError, host: ArgumentsHost) {
    const respuesta = host.switchToHttp().getResponse<Response>();
    const { estado, mensaje } = this.traducir(error);

    if (estado >= 500) this.bitacora.error(`${error.code} ${error.message}`);
    else this.bitacora.warn(`${error.code} ${error.message}`);

    // Mismo formato que las excepciones de Nest, para que el cliente no tenga
    // que distinguir de donde salio el error.
    respuesta.status(estado).json({
      message: mensaje,
      error: NOMBRES_HTTP[estado] ?? 'Error',
      statusCode: estado,
    });
  }

  private traducir(error: DatabaseError): { estado: number; mensaje: string } {
    switch (error.code) {
      case '23505':
        return {
          estado: HttpStatus.CONFLICT,
          mensaje:
            MENSAJES_UNICIDAD[error.constraint ?? ''] ??
            'Ese registro ya existe.',
        };

      // Incluye "new row violates row-level security policy": la fila que se
      // intenta escribir cae fuera de lo que el rol puede tocar.
      case '42501':
        return {
          estado: HttpStatus.FORBIDDEN,
          mensaje: 'No tienes permiso para hacer eso en esta institucion.',
        };

      case '23503':
        return {
          estado: HttpStatus.BAD_REQUEST,
          mensaje: 'Referencia a algo que no existe en esta institucion.',
        };

      case '23514':
        return {
          estado: HttpStatus.BAD_REQUEST,
          mensaje: 'Los datos no cumplen una regla de la institucion.',
        };

      case '23502':
        return {
          estado: HttpStatus.BAD_REQUEST,
          mensaje: 'Falta un dato obligatorio.',
        };

      case '23001':
        return {
          estado: HttpStatus.CONFLICT,
          mensaje: error.message,
        };

      // P0001: los raise exception que escribimos nosotros en plpgsql. El
      // mensaje esta redactado para leerse, asi que pasa tal cual.
      case 'P0001':
        return { estado: HttpStatus.CONFLICT, mensaje: error.message };

      default:
        return {
          estado: HttpStatus.INTERNAL_SERVER_ERROR,
          mensaje: 'Error al hablar con la base de datos.',
        };
    }
  }
}

export function esErrorPg(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

export function noEsHttp(error: unknown): boolean {
  return !(error instanceof HttpException);
}
