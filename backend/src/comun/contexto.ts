import { ForbiddenException } from '@nestjs/common';
import type { Contexto } from '../basedatos/basedatos.servicio';
import type { Sesion } from './sesion';

/*
  Las dos lineas que abren toda consulta de negocio. Estaban repetidas en cada
  servicio y no es duplicacion inocente: si un servicio se olvidara de pasar la
  institucion, sus consultas correrian sin contexto y las politicas no
  devolverian nada. Es un fallo que se manifiesta como "no hay datos", el
  sintoma mas facil de confundir con una tabla vacia.

  Que sea una funcion y no un metodo heredado es a proposito: no hay una clase
  base de la que colgar servicios, y no hace falta inventarla para compartir
  cuatro lineas.
*/

export function institucionDe(sesion: Sesion): string {
  if (!sesion.institucionId) {
    throw new ForbiddenException('Primero elige una institucion.');
  }
  return sesion.institucionId;
}

export function contextoDe(sesion: Sesion): Contexto {
  return {
    usuarioId: sesion.usuarioId,
    institucionId: institucionDe(sesion),
  };
}
