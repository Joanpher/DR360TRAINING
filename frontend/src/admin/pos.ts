export type MetodoPagoPos = 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'otro'
export type EstadoVentaPos = 'pendiente' | 'pagada' | 'anulada'

export type ProductoPos = {
  id: string
  codigo: string
  nombre: string
  tipo: 'certificado'
  precio: string
  moneda: string
  activo: boolean
}

export type CandidatoPos = {
  inscripcionId: string
  membresiaId: string
  matricula: string | null
  estudiante: string
  correo: string | null
  cursoId: string
  codigoCurso: string
  curso: string
  estadoInscripcion: string
  certificado: boolean
  ventaId: string | null
  estadoVenta: EstadoVentaPos | null
  certificadoId: string | null
}

export type VentaPos = {
  id: string
  numero: string
  estado: EstadoVentaPos
  subtotal: string
  total: string
  moneda: string
  nota: string | null
  creadoEn: string
  pagadaEn: string | null
  matricula: string | null
  estudiante: string
  correo: string | null
  inscripcionId: string
  codigoCurso: string
  curso: string
  descripcion: string
  lineaId: string
  pagado: string
  saldo: string
  certificadoId: string | null
}

export type RespuestaVentasPos = {
  ventas: VentaPos[]
  resumen: { pagadas: number; pendientes: number; cobrado: string }
}

export const metodosPagoPos: Array<{ valor: MetodoPagoPos; texto: string }> = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'tarjeta', texto: 'Tarjeta' },
  { valor: 'transferencia', texto: 'Transferencia' },
  { valor: 'cheque', texto: 'Cheque' },
  { valor: 'otro', texto: 'Otro' },
]

