import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PoolClient } from 'pg';

/*
  La bitacora.

  Dos decisiones de fondo, y las dos son la razon de que esto sea una funcion
  suelta y no un servicio inyectable:

  1. El evento se escribe con el mismo cliente y dentro de la misma transaccion
     que el cambio que describe. Si el update falla, el rollback se lleva el
     evento; si el evento falla, el rollback se lleva el update. No existe el
     estado intermedio "cambio hecho pero sin registrar", que es justo el que
     inutilizaria una auditoria.

  2. institucion_id y actor_id no se pasan como parametros: se leen de las
     funciones de contexto. La politica de auditoria.eventos exige que
     coincidan con el contexto de la transaccion, asi que aunque alguien
     quisiera anotar un evento en nombre de otro, la base lo rechazaria. Poner
     ahi una variable de TypeScript seria fingir un control que no existe.
*/

export type Origen = {
  ip: string | null;
  agente: string | null;
};

export type Evento = {
  /* Verbo en pasado con espacio de nombres: institucion.datos_actualizados. */
  accion: string;
  entidad?: string;
  entidadId?: string | null;
  /* Lo que cambio. Nunca contrasenas, tokens ni hashes. */
  datos?: Record<string, unknown>;
};

export async function anotar(
  cliente: PoolClient,
  evento: Evento,
  origen?: Origen,
): Promise<void> {
  await cliente.query(
    `insert into auditoria.eventos
       (institucion_id, actor_id, accion, entidad, entidad_id, datos, ip, agente)
     values (app.institucion_actual(), app.usuario_actual(),
             $1, $2, $3::uuid, $4::jsonb, $5::inet, $6)`,
    [
      evento.accion,
      evento.entidad ?? null,
      evento.entidadId ?? null,
      JSON.stringify(evento.datos ?? {}),
      origen?.ip || null,
      origen?.agente?.slice(0, 400) || null,
    ],
  );
}

/*
  Compara lo que habia con lo que se pide y devuelve solo lo que de verdad
  cambia. Sirve para dos cosas a la vez: decidir si hay algo que guardar y
  dejar en la bitacora un "antes y despues" en vez de un "alguien toco esto".
*/
export function diferencias<T extends Record<string, unknown>>(
  antes: T,
  despues: Partial<T>,
): Record<string, { antes: unknown; despues: unknown }> {
  const cambios: Record<string, { antes: unknown; despues: unknown }> = {};

  for (const [clave, valor] of Object.entries(despues)) {
    if (valor === undefined) continue;
    const previo = antes[clave];
    // Comparacion por valor: marca y configuracion son objetos.
    if (JSON.stringify(previo ?? null) === JSON.stringify(valor ?? null))
      continue;
    cambios[clave] = { antes: previo ?? null, despues: valor ?? null };
  }

  return cambios;
}

/* Inyecta ip y agente de la peticion, que la bitacora guarda con cada evento. */
export const DeDonde = createParamDecorator(
  (_: unknown, contexto: ExecutionContext): Origen => {
    const peticion = contexto.switchToHttp().getRequest<Request>();
    return {
      ip: peticion.ip ?? null,
      agente: peticion.headers['user-agent'] ?? null,
    };
  },
);
