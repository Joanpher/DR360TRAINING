export type DisponibilidadCertificado =
  | 'listo'
  | 'emitido'
  | 'revocado'
  | 'pendiente_pago'
  | 'pendiente_curso'

export type FilaCertificado = {
  ventaId: string
  numeroVenta: string
  estadoVenta: string
  total: string
  saldo: string
  inscripcionId: string
  estadoInscripcion: string
  matricula: string | null
  estudiante: string
  correo: string | null
  codigoCurso: string
  curso: string
  certificadoId: string | null
  numeroCertificado: string | null
  estadoCertificado: 'emitido' | 'revocado' | null
  emitidoEn: string | null
  disponibilidad: DisponibilidadCertificado
}

export type DetalleCertificado = {
  id: string
  numero: string
  codigoVerificacion: string
  estado: 'emitido' | 'revocado'
  emitidoEn: string
  revocadoEn: string | null
  motivoRevocacion: string | null
  inscripcionId: string
  estadoInscripcion: string
  completadoEn: string | null
  calificacion: string | null
  matricula: string | null
  estudiante: string
  correo: string | null
  codigoCurso: string
  curso: string
  duracionHoras: string | null
  iniciaEn: string | null
  terminaEn: string | null
  institucion: string
  siglas: string | null
  marca: Record<string, unknown>
  ventaId: string
  numeroVenta: string
  totalVenta: string
  impresiones: number
  correosEnviados: number
  ultimaEntregaEn: string | null
}

