/*
  En que punto esta una inscripcion respecto de su certificado. Lo calcula la
  base -ver DISPONIBILIDAD en certificados.servicio.ts- y no el navegador, para
  que las tres pantallas que lo pintan digan lo mismo.

  'sin_vender' solo aparece en la lista de clase: la lista general parte de las
  ventas, asi que alli no existe una fila sin venta.
*/
export type DisponibilidadCertificado =
  | 'sin_vender'
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


/* --- Buscar por curso ---------------------------------------------------- */

export type CursoCertificado = {
  id: string
  codigo: string
  nombre: string
  estado: string
  certificado: boolean
  modalidad: string
  iniciaEn: string | null
  terminaEn: string | null
  duracionHoras: string | null
  sede: string | null
  instructor: string | null
  inscritos: number
  completados: number
  vendidos: number
  pendientesPago: number
  emitidos: number
}

export type EstudianteDeCurso = {
  inscripcionId: string
  estadoInscripcion: string
  calificacion: string | null
  completadoEn: string | null
  matricula: string | null
  estudiante: string
  correo: string | null
  telefono: string | null
  ventaId: string | null
  numeroVenta: string | null
  estadoVenta: 'pendiente' | 'pagada' | 'anulada' | null
  totalVenta: string | null
  moneda: string | null
  pagadoVenta: string
  saldoVenta: string
  certificadoId: string | null
  numeroCertificado: string | null
  estadoCertificado: 'emitido' | 'revocado' | null
  emitidoEn: string | null
  disponibilidad: DisponibilidadCertificado
}

export type ListaDeClase = {
  curso: {
    id: string
    codigo: string
    nombre: string
    estado: string
    certificado: boolean
    modalidad: string
    iniciaEn: string | null
    terminaEn: string | null
    duracionHoras: string | null
    sede: string | null
    instructor: string | null
  }
  estudiantes: EstudianteDeCurso[]
}
