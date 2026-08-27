/*
  Lo que devuelve /api/docencia: los reportes de quien imparte y su agenda.

  Los promedios llegan como texto por la misma razon que los precios del
  catalogo: son numeric en Postgres, y convertirlos a number en el servidor es
  donde un 87.5 se vuelve 87.49999. Se muestran tal cual y solo se pasan a
  numero para pintar una barra, donde un decimal perdido no cambia nada.
*/

export type ResumenCurso = {
  cursoId: string
  codigo: string
  nombre: string
  estado: string
  modalidad: string
  estudiantes: number
  tareasPublicadas: number
  entregas: number
  porCalificar: number
  promedioTareas: string | null
  evaluacionesPublicadas: number
  intentos: number
  promedioEvaluaciones: string | null
  clasesCelebradas: number
  asistenciaMedia: string | null
}

export type FilaEstudiante = {
  membresiaId: string
  nombre: string
  matricula: string | null
  estado: string
  entregas: number
  promedioTareas: string | null
  intentos: number
  promedioEvaluaciones: string | null
  clasesAsistidas: number
  minutos: number
  ultimaActividadEn: string | null
}

export type CabeceraCurso = {
  cursoId: string
  codigo: string
  nombre: string
  estado: string
  instructor: string | null
  tareasPublicadas: number
  evaluacionesPublicadas: number
  clasesCelebradas: number
}

export type RespuestaReportes = { cursos: ResumenCurso[] }
export type RespuestaReporteCurso = {
  curso: CabeceraCurso
  estudiantes: FilaEstudiante[]
}

// --- Agenda -----------------------------------------------------------------

export type TareaAgenda = {
  id: string
  titulo: string
  venceEn: string
  publicada: boolean
  puntos: string
  cursoId: string
  cursoCodigo: string
  cursoNombre: string
  estudiantes: number
  entregas: number
  porCalificar: number
}

export type EvaluacionAgenda = {
  id: string
  titulo: string
  abreEn: string
  cierraEn: string
  publicada: boolean
  cursoId: string
  cursoCodigo: string
  cursoNombre: string
  estudiantes: number
  intentos: number
  porCalificar: number
}

export type ReunionAgenda = {
  id: string
  titulo: string
  programadaPara: string
  duracionMinutos: number
  estado: string
  cursoId: string
  cursoCodigo: string
  cursoNombre: string
  asistentes: number
}

export type RespuestaAgendaDocente = {
  tareas: TareaAgenda[]
  evaluaciones: EvaluacionAgenda[]
  reuniones: ReunionAgenda[]
}

// --- Presentacion -----------------------------------------------------------

/* Un porcentaje que puede no existir: sin entregas calificadas no hay promedio,
   y un 0% ahi seria mentira -nadie ha sacado cero, es que nadie ha entregado-. */
export function porcentaje(valor: string | null): string {
  return valor === null ? '—' : `${valor}%`
}

export function comoNumero(valor: string | null): number {
  return valor === null ? 0 : Number(valor)
}

/*
  Tres tramos y no un degradado: el color aqui no mide, avisa. Lo que tiene que
  saltar a la vista de una tabla de treinta filas es quien va mal, no si alguien
  saco 84 u 86.
*/
export function tonoRendimiento(valor: string | null) {
  if (valor === null) return 'neutro' as const
  const numero = Number(valor)
  if (numero >= 70) return 'aprobado' as const
  if (numero >= 50) return 'aviso' as const
  return 'correccion' as const
}

export const nombreEstadoInscripcion: Record<string, string> = {
  preinscrita: 'Preinscrita',
  activa: 'Activa',
  completada: 'Completada',
  retirada: 'Retirada',
  cancelada: 'Cancelada',
}

export function fechaCorta(iso: string | null): string {
  if (!iso) return 'Sin actividad'
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function minutosLegibles(minutos: number): string {
  if (minutos <= 0) return '—'
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}
