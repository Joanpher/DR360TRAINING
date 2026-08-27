import { pedir } from '../datos/api'

/*
  El foro de un curso. Los tipos son los que devuelve /api/foro tal cual: un
  tema trae siempre su conteo de respuestas y su ultima actividad aunque no sean
  columnas de la tabla, porque se calculan al leer (ver la migracion 0016).
*/

export type TemaForo = {
  id: string
  cursoId: string
  titulo: string
  cuerpo: string
  fijado: boolean
  cerrado: boolean
  autor: string
  autorMembresiaId: string
  esMio: boolean
  creadoEn: string
  editadoEn: string | null
  respuestas: number
  ultimaActividadEn: string
  ultimoAutor: string | null
}

export type MensajeForo = {
  id: string
  temaId: string
  cuerpo: string
  autor: string
  autorMembresiaId: string
  esMio: boolean
  esDocente: boolean
  creadoEn: string
  editadoEn: string | null
}

export type RespuestaForo = { temas: TemaForo[]; puedeModerar: boolean }

export type RespuestaTema = {
  tema: TemaForo
  mensajes: MensajeForo[]
  puedeModerar: boolean
}

export const crearTema = (cursoId: string, cuerpo: { titulo: string; cuerpo: string }) =>
  pedir<{ tema: TemaForo }>(`/foro/curso/${cursoId}/temas`, { metodo: 'POST', cuerpo })

export const responderTema = (temaId: string, cuerpo: string) =>
  pedir<{ mensaje: MensajeForo }>(`/foro/temas/${temaId}/mensajes`, {
    metodo: 'POST',
    cuerpo: { cuerpo },
  })

export const moderarTema = (
  temaId: string,
  cuerpo: { fijado?: boolean; cerrado?: boolean; titulo?: string; cuerpo?: string },
) => pedir<{ tema: TemaForo }>(`/foro/temas/${temaId}`, { metodo: 'PATCH', cuerpo })

export const editarMensaje = (mensajeId: string, cuerpo: string) =>
  pedir<{ mensaje: MensajeForo }>(`/foro/mensajes/${mensajeId}`, {
    metodo: 'PATCH',
    cuerpo: { cuerpo },
  })

export const borrarTema = (temaId: string) =>
  pedir<void>(`/foro/temas/${temaId}`, { metodo: 'DELETE' })

export const borrarMensaje = (mensajeId: string) =>
  pedir<void>(`/foro/mensajes/${mensajeId}`, { metodo: 'DELETE' })

/*
  "hace 5 min", "ayer", "12 mar". En una conversacion importa mas cuanto hace
  que se escribio algo que la hora exacta a la que se escribio; la fecha entera
  vuelve cuando ya no cabe en la cabeza de nadie.
*/
export function haceCuanto(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return 'ahora mismo'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short' }).format(
    new Date(iso),
  )
}

export function fechaMensaje(iso: string): string {
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
