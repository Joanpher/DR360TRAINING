/*
  Cliente de la API.

  El access token vive aqui, en una variable de modulo, y no en localStorage:
  cualquier script inyectado en la pagina puede leer localStorage, y un token
  robado vale hasta que expira. Al recargar se pierde, que es lo correcto, y se
  recupera con la cookie httpOnly del refresco, que el JavaScript no alcanza.
*/

let acceso: string | null = null

export function fijarAcceso(ficha: string | null) {
  acceso = ficha
}

export class ErrorApi extends Error {
  // Campo declarado y asignado a mano: el proyecto compila con
  // erasableSyntaxOnly, que no admite propiedades de parametro.
  estado: number

  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
  }
}

type Opciones = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  cuerpo?: unknown
}

/*
  El access token dura quince minutos. Cuando caduca a media sesion, en vez de
  echar a la calle a quien esta escribiendo una tarea, se pide uno nuevo con la
  cookie de refresco y se repite la peticion. Una sola vez: si el segundo
  intento tambien da 401, la sesion se acabo de verdad.
*/
let renovar: (() => Promise<boolean>) | null = null
let renovacionEnCurso: Promise<boolean> | null = null

export function fijarRenovador(fn: (() => Promise<boolean>) | null) {
  renovar = fn
}

async function renovarUnaVez(): Promise<boolean> {
  renovacionEnCurso ??= (renovar?.() ?? Promise.resolve(false)).finally(() => {
    renovacionEnCurso = null
  })
  return renovacionEnCurso
}

export async function pedir<T>(
  ruta: string,
  opciones: Opciones = {},
  reintento = false,
): Promise<T> {
  const { metodo = 'GET', cuerpo } = opciones
  const esFormulario = typeof FormData !== 'undefined' && cuerpo instanceof FormData

  let respuesta: Response
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: 'include',
      headers: {
        ...(cuerpo && !esFormulario ? { 'Content-Type': 'application/json' } : {}),
        ...(acceso ? { Authorization: `Bearer ${acceso}` } : {}),
      },
      body: cuerpo ? (esFormulario ? cuerpo : JSON.stringify(cuerpo)) : undefined,
    })
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor.')
  }

  const esRutaDeSesion = ruta.startsWith('/auth/refrescar') || ruta.startsWith('/auth/entrar')

  if (respuesta.status === 401 && !reintento && !esRutaDeSesion && renovar) {
    if (await renovarUnaVez()) return pedir<T>(ruta, opciones, true)
  }

  if (respuesta.status === 204) return undefined as T

  const datos = await respuesta.json().catch(() => null)

  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, mensajeDeError(datos, respuesta.status))
  }

  return datos as T
}

/* Descarga autenticada para materiales del aula. Un enlace normal no sirve:
   el token de acceso vive en memoria y debe viajar en la cabecera. */
export async function pedirArchivo(ruta: string, reintento = false): Promise<Blob> {
  let respuesta: Response
  try {
    respuesta = await fetch(`/api${ruta}`, {
      credentials: 'include',
      headers: acceso ? { Authorization: `Bearer ${acceso}` } : {},
    })
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor.')
  }

  if (respuesta.status === 401 && !reintento && renovar) {
    if (await renovarUnaVez()) return pedirArchivo(ruta, true)
  }

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => null)
    throw new ErrorApi(respuesta.status, mensajeDeError(datos, respuesta.status))
  }

  return respuesta.blob()
}

/*
  El backend devuelve un texto cuando el error es de negocio y una lista cuando
  falla la validacion de varios campos a la vez. Se muestran todos: decir solo
  el primero obliga a corregir de uno en uno.
*/
function mensajeDeError(datos: unknown, estado: number): string {
  const cuerpo = datos as { message?: string | string[] } | null
  const mensaje = cuerpo?.message

  if (Array.isArray(mensaje)) return mensaje.join(' ')
  if (typeof mensaje === 'string' && mensaje) return mensaje

  if (estado >= 500) return 'Algo fallo en el servidor. Intentalo de nuevo.'
  return 'No se pudo completar la operacion.'
}
