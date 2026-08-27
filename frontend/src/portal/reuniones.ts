import { avisar, pedir } from '../datos/api'

export type EstadoReunion = 'programada' | 'en_curso' | 'finalizada' | 'cancelada'

export type MiAsistencia = {
  minutos: number
  entradas: number
  primeraEntradaEn: string
  salidaEn: string | null
}

export type Reunion = {
  id: string
  cursoId: string
  cursoCodigo: string
  cursoNombre: string
  titulo: string
  descripcion: string | null
  estado: EstadoReunion
  programadaPara: string | null
  duracionMinutos: number
  abrirSinAnfitrion: boolean
  silenciarAlEntrar: boolean
  camaraApagadaAlEntrar: boolean
  permiteGrabacion: boolean
  iniciadaEn: string | null
  finalizadaEn: string | null
  canceladaEn: string | null
  motivoCancelacion: string | null
  anfitrion: string
  esAnfitrion: boolean
  puedeGestionar: boolean
  salaAbierta: boolean
  participantes: number
  presentes: number
  miAsistencia: MiAsistencia | null
}

export type Asistente = {
  id: string
  membresiaId: string
  nombre: string
  matricula: string | null
  esAnfitrion: boolean
  primeraEntradaEn: string
  salidaEn: string | null
  minutos: number
  entradas: number
  dentro: boolean
}

/*
  Lo que hace falta para levantar el cliente de Jitsi. El dominio llega del
  servidor y no de una variable de compilacion: quien cambia de un Jitsi publico
  a uno propio lo hace en el entorno del backend, y seria absurdo que el
  frontend hubiera que recompilarlo por eso.
*/
export type AccesoReunion = {
  reunion: Reunion
  dominio: string
  sala: string
  token: string | null
  esModerador: boolean
  nombre: string
  correo: string
  avatarUrl: string | null
}

export type RespuestaAgenda = { reuniones: Reunion[] }
export type RespuestaCurso = { reuniones: Reunion[]; puedeGestionar: boolean }
export type RespuestaAsistencia = { reunion: Reunion; asistentes: Asistente[] }

export type NuevaReunion = {
  titulo?: string
  descripcion?: string
  programadaPara?: string
  duracionMinutos?: number
  abrirSinAnfitrion?: boolean
  silenciarAlEntrar?: boolean
  camaraApagadaAlEntrar?: boolean
  permiteGrabacion?: boolean
  iniciarAhora?: boolean
}

export const crearReunion = (cursoId: string, cuerpo: NuevaReunion) =>
  pedir<{ reunion: Reunion }>(`/reuniones/curso/${cursoId}`, { metodo: 'POST', cuerpo })

export const iniciarReunion = (id: string) =>
  pedir<{ reunion: Reunion }>(`/reuniones/${id}/iniciar`, { metodo: 'POST' })

export const finalizarReunion = (id: string) =>
  pedir<{ reunion: Reunion }>(`/reuniones/${id}/finalizar`, { metodo: 'POST' })

export const cancelarReunion = (id: string, motivo?: string) =>
  pedir<{ reunion: Reunion }>(`/reuniones/${id}/cancelar`, {
    metodo: 'POST',
    cuerpo: { motivo },
  })

export const entrarAReunion = (id: string) =>
  pedir<AccesoReunion>(`/reuniones/${id}/entrar`, { metodo: 'POST' })

/*
  Salir de la sala. Se llama al cerrarla desde dentro y tambien al cerrar la
  pestana, asi que va por `avisar`, que sobrevive al cierre del documento.

  Que falle no rompe nada: al terminar la clase, el backend cierra de oficio las
  asistencias que quedaron abiertas.
*/
export function salirDeReunion(id: string): void {
  avisar(`/reuniones/${id}/salir`)
}

// ---------------------------------------------------------------------------

export const nombreEstadoReunion: Record<EstadoReunion, string> = {
  programada: 'Programada',
  en_curso: 'En vivo',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
}

export function horaReunion(iso: string | null): string {
  if (!iso) return 'Sin hora'
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function soloHora(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function duracionLegible(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

/*
  "Empieza en 20 minutos", "empezo hace un rato". Una hora exacta obliga a
  restar mentalmente; esto no.
*/
export function cuandoEmpieza(iso: string | null): string {
  if (!iso) return ''
  const minutos = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  if (minutos <= -60) return `hace ${duracionLegible(Math.abs(minutos))}`
  if (minutos < 0) return `hace ${Math.abs(minutos)} min`
  if (minutos === 0) return 'ahora mismo'
  if (minutos < 60) return `en ${minutos} min`
  const dias = Math.round(minutos / 1440)
  if (minutos < 1440) return `en ${duracionLegible(minutos)}`
  return dias === 1 ? 'mañana' : `en ${dias} días`
}

/* Un valor para <input type="datetime-local">, en hora local y sin segundos. */
export function paraCampoFecha(fecha: Date): string {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}
