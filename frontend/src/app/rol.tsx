import { useMemo } from 'react'
import { useSesion } from './sesion'

export type Rol = 'estudiante' | 'docente' | 'admin'

export const nombreRol: Record<Rol, string> = {
  estudiante: 'Estudiante',
  docente: 'Docente',
  admin: 'Administrador',
}

/*
  La base distingue seis roles; la interfaz tiene tres paneles. Un coordinador
  trabaja en el panel docente con mas alcance, y un propietario en el mismo
  panel que un administrador. La traduccion se hace aqui y en un solo sitio.

  El rol no se elige: se deduce de la membresia que trae la sesion. Antes habia
  un selector de "ver como" en la barra superior, y era un error de fondo: hacia
  parecer que el panel era una preferencia de la persona cuando en realidad es
  una consecuencia de lo que es dentro de la institucion. Quien entra como
  administrador aterriza en el panel de administracion y no ve otra cosa.

  Quien manda de verdad sigue siendo la base de datos: esto decide a que panel
  se entra, no a que datos se llega.
*/
export function traducirRoles(rolesDeLaInstitucion: string[]): Rol {
  if (rolesDeLaInstitucion.some((r) => r === 'propietario' || r === 'administrador')) {
    return 'admin'
  }
  if (rolesDeLaInstitucion.some((r) => r === 'docente' || r === 'coordinador')) {
    return 'docente'
  }
  return 'estudiante'
}

/* Nombre exacto del rol institucional, para cuando el matiz importa. */
export const nombreRolInstitucional: Record<string, string> = {
  propietario: 'Propietario',
  administrador: 'Administrador',
  coordinador: 'Coordinador',
  docente: 'Docente',
  estudiante: 'Estudiante',
  invitado: 'Invitado',
}

export function useRol(): { rol: Rol; rolesReales: string[] } {
  const { roles } = useSesion()
  return useMemo(() => ({ rol: traducirRoles(roles), rolesReales: roles }), [roles])
}
