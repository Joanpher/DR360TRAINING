import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useSesion } from './sesion'

export type Rol = 'estudiante' | 'docente' | 'admin'

export const nombreRol: Record<Rol, string> = {
  estudiante: 'Estudiante',
  docente: 'Instructor',
  admin: 'Administrador',
}

/*
  La base distingue seis roles; la interfaz tiene tres paneles. Un coordinador
  trabaja en el panel de instructor con mas alcance, y un propietario en el
  mismo panel que un administrador. La traduccion se hace aqui y en un solo
  sitio.

  El rol no se elige: se deduce de la membresia que trae la sesion. Quien entra
  como administrador aterriza en el panel de administracion.

  Encima de eso vive una excepcion deliberada -ProveedorVista, mas abajo- que
  conviene no confundir con lo anterior: un administrador puede PREVISUALIZAR
  los otros dos paneles. No es elegir rol. No cambia la membresia, ni el token,
  ni una sola politica de la base; solo decide que arbol de pantallas se dibuja.
  Quien no es administrador no tiene ese control y su vista no se mueve.

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
  docente: 'Instructor',
  estudiante: 'Estudiante',
  invitado: 'Invitado',
}

// ---------------------------------------------------------------------------

type ValorVista = {
  /* La vista que se esta mirando. Es lo que consulta toda la interfaz. */
  rol: Rol
  /* Lo que la persona es de verdad en esta institucion. */
  rolReal: Rol
  rolesReales: string[]
  puedeCambiarVista: boolean
  previsualizando: boolean
  cambiarVista: (vista: Rol) => void
}

const ContextoVista = createContext<ValorVista | null>(null)

const CLAVE = 'dr360:vista'

function vistaGuardada(): Rol | null {
  try {
    const v = sessionStorage.getItem(CLAVE)
    return v === 'estudiante' || v === 'docente' || v === 'admin' ? v : null
  } catch {
    // Modo privado o almacenamiento bloqueado: se mira el panel propio y ya.
    return null
  }
}

/*
  Que panel se esta mirando.

  Se guarda en sessionStorage y no en un useState a secas para que recargar la
  pagina no eche al administrador de la pantalla que estaba revisando. En
  sessionStorage y no en localStorage porque una previsualizacion pertenece a
  este rato: cerrar la pestana la termina.

  Lo guardado no se aplica sin preguntar quien lo lee. Si manana entra un
  estudiante en esta misma pestana, un "vista=admin" que quedara ahi se ignora:
  manda rolReal. Y aunque alguien forzara la clave a mano, lo unico que
  conseguiria es dibujarse un panel vacio -el token que viaja en cada peticion
  sigue siendo el suyo, y las politicas de la base no devuelven una fila mas
  por lo que diga el navegador-.
*/
export function ProveedorVista({ children }: { children: ReactNode }) {
  const { roles } = useSesion()
  const [elegida, setElegida] = useState<Rol | null>(vistaGuardada)

  const cambiarVista = useCallback((vista: Rol) => {
    setElegida(vista)
    try {
      sessionStorage.setItem(CLAVE, vista)
    } catch {
      // Sin almacenamiento la vista dura lo que dure la pagina. No es motivo
      // para dejar de cambiarla.
    }
  }, [])

  const valor = useMemo<ValorVista>(() => {
    const rolReal = traducirRoles(roles)
    const puedeCambiarVista = rolReal === 'admin'
    const rol = puedeCambiarVista ? (elegida ?? rolReal) : rolReal

    return {
      rol,
      rolReal,
      rolesReales: roles,
      puedeCambiarVista,
      previsualizando: rol !== rolReal,
      cambiarVista,
    }
  }, [roles, elegida, cambiarVista])

  return <ContextoVista.Provider value={valor}>{children}</ContextoVista.Provider>
}

export function useVista(): ValorVista {
  const valor = useContext(ContextoVista)
  if (!valor) throw new Error('useVista fuera de ProveedorVista')
  return valor
}

/*
  El hook que ya usaba media interfaz. Devuelve la vista efectiva, asi que las
  pantallas que se adaptan al rol -la navegacion, el inicio- siguen a la
  previsualizacion sin enterarse de que existe.
*/
export function useRol(): { rol: Rol; rolesReales: string[] } {
  const { rol, rolesReales } = useVista()
  return useMemo(() => ({ rol, rolesReales }), [rol, rolesReales])
}
