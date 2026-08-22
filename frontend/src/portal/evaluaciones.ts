export type TipoPregunta =
  | 'seleccion_unica'
  | 'seleccion_multiple'
  | 'verdadero_falso'
  | 'respuesta_libre'

export type IntentoResumen = {
  id: string
  numero: number
  estado: 'en_progreso' | 'enviado' | 'calificado'
  iniciadoEn: string
  expiraEn: string
  enviadoEn: string | null
  calificacion: string | null
}

export type EvaluacionResumen = {
  id: string
  cursoId: string
  titulo: string
  instrucciones: string | null
  abreEn: string
  cierraEn: string
  duracionMinutos: number
  intentosPermitidos: number
  puntosTotal: string
  barajarPreguntas: boolean
  mostrarResultados: boolean
  publicada: boolean
  cantidadPreguntas: number
  cantidadIntentos: number
  intento: IntentoResumen | null
}

export type RespuestaEvaluacionesCurso = {
  puedeEditar: boolean
  evaluaciones: EvaluacionResumen[]
}

export type OpcionEvaluacion = { id: string; texto: string }

export type PreguntaIntento = {
  id: string
  orden: number
  tipo: TipoPregunta
  enunciado: string
  puntos: string
  obligatoria: boolean
  opciones: OpcionEvaluacion[]
  respuestaId: string | null
  respuesta: RespuestaPregunta
  esCorrecta?: boolean | null
  puntosObtenidos?: string | null
  comentarioDocente?: string | null
  respuestaCorrecta?: RespuestaPregunta | null
  explicacion?: string | null
}

export type RespuestaPregunta = {
  opciones?: string[]
  valor?: boolean
  texto?: string
}

export type IntentoEvaluacion = IntentoResumen & {
  evaluacionId: string
  cursoId: string
  titulo: string
  instrucciones: string | null
  puntosTotal: string
  mostrarResultados: boolean
  barajarPreguntas: boolean
  preguntas: PreguntaIntento[]
}

export type RespuestaIntento = { intento: IntentoEvaluacion }

export type IntentoDocente = IntentoResumen & {
  estudiante: string
  matricula: string | null
}

export type RespuestaIntentosDocente = {
  evaluacion: { id: string; titulo: string; puntosTotal: string }
  intentos: IntentoDocente[]
}

export type EvaluacionCalendario = {
  id: string
  titulo: string
  instrucciones: string | null
  abreEn: string
  cierraEn: string
  duracionMinutos: number
  puntosTotal: string
  cursoId: string
  cursoCodigo: string
  cursoNombre: string
  intento: IntentoResumen | null
}

export type RespuestaCalendarioEvaluaciones = {
  evaluaciones: EvaluacionCalendario[]
}

export function fechaEvaluacion(iso: string): string {
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function estadoEvaluacion(evaluacion: EvaluacionResumen) {
  const ahora = Date.now()
  if (!evaluacion.publicada) return { texto: 'Borrador', tono: 'neutro' as const }
  if (ahora < new Date(evaluacion.abreEn).getTime()) return { texto: 'Programado', tono: 'neutro' as const }
  if (ahora >= new Date(evaluacion.cierraEn).getTime()) return { texto: 'Cerrado', tono: 'neutro' as const }
  return { texto: 'Abierto', tono: 'aprobado' as const }
}
