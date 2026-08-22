export type MaterialAula = {
  id: string
  titulo: string
  descripcion: string | null
  archivoNombre: string
  archivoMime: string
  archivoTamano: number
  publicado: boolean
  creadoEn: string
}

export type TareaAula = {
  id: string
  titulo: string
  instrucciones: string | null
  venceEn: string | null
  puntos: string
  archivoNombre: string | null
  archivoMime: string | null
  archivoTamano: number | null
  publicada: boolean
  creadoEn: string
  cantidadEntregas: number
  entrega: EntregaAula | null
}

export type EntregaAula = {
  id: string
  comentario: string | null
  archivoNombre: string | null
  archivoMime: string | null
  archivoTamano: number | null
  entregadoEn: string
  calificacion: string | null
  retroalimentacion: string | null
  calificadoEn: string | null
}

export type EntregaDetalle = EntregaAula & {
  membresiaId: string
  estudiante: string
  matricula: string | null
}

export type RespuestaEntregas = {
  tarea: { id: string; titulo: string; puntos: string }
  entregas: EntregaDetalle[]
}

export type SemanaAula = {
  id: string
  numero: number
  titulo: string
  descripcion: string | null
  publicada: boolean
  materiales: MaterialAula[]
  tareas: TareaAula[]
}

export type Aula = {
  id: string
  cursoId: string
  titulo: string
  descripcion: string | null
  publicada: boolean
  puedeEditar: boolean
  semanas: SemanaAula[]
}

export type RespuestaAula = { aula: Aula | null }

export type TareaCalendario = {
  id: string
  titulo: string
  instrucciones: string | null
  venceEn: string
  puntos: string
  archivoNombre: string | null
  archivoMime: string | null
  archivoTamano: number | null
  semanaNumero: number
  semanaTitulo: string
  cursoId: string
  cursoCodigo: string
  cursoNombre: string
  entrega: EntregaAula | null
}

export type RespuestaCalendario = { tareas: TareaCalendario[] }

export function tamanoArchivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function fechaTarea(iso: string | null): string {
  if (!iso) return 'Sin fecha límite'
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
