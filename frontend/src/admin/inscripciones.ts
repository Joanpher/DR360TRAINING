/*
  Los tipos que devuelve /api/inscripciones.

  Aparte de catalogo.ts porque son dos cosas distintas: aquello es lo que el
  centro ofrece, esto es quien esta dentro y cuanto debe. Lo primero se puede
  enseñar; lo segundo no sale del panel de administración.
*/

export type EstadoInscripcion =
  | 'preinscrita'
  | 'activa'
  | 'completada'
  | 'retirada'
  | 'cancelada'

/*
  Una persona en un curso, con su cuenta al día.

  Todos los montos llegan como texto por la misma razón que en el catálogo: el
  double de JavaScript no representa exactamente los decimales de numeric(12,2),
  y una inscripción es justo donde eso se nota.

    precio     lo que costaba el curso el día que se inscribió, congelado
    descuento  beca, promoción o acuerdo
    total      precio − descuento
    facturado  lo que se llegó a emitir en cargos vivos
    pagado     lo cobrado contra esos cargos, sin contar pagos anulados
    deuda      facturado − pagado
*/
export type Inscripcion = {
  id: string
  cursoId: string
  curso: string
  codigoCurso: string
  membresiaId: string
  matricula: string | null
  nombre: string
  correo: string | null
  telefono: string | null
  estado: EstadoInscripcion
  inscritoEn: string
  precio: string
  descuento: string
  total: string
  facturado: string
  pagado: string
  deuda: string
  calificacion: string | null
  completadoEn: string | null
}

export type EstadoCargo = 'pendiente' | 'pagado' | 'anulado' | 'condonado'

export type Cargo = {
  id: string
  descripcion: string
  monto: string
  venceEn: string | null
  estado: EstadoCargo
  motivo: string | null
  pagado: string
}

export type MetodoPago = 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'otro'

export type Pago = {
  id: string
  cargoId: string
  monto: string
  metodo: MetodoPago
  referencia: string | null
  recibidoEn: string
  nota: string | null
  anulado: boolean
  registradoPor: string | null
}

/* Lo que el centro guarda de la persona más allá de su nombre y su correo. */
export type Ficha = {
  tipoDocumento: string
  documento: string | null
  fechaNacimiento: string | null
  sexo: string | null
  telefono: string | null
  direccion: string | null
  ocupacion: string | null
  empresa: string | null
  comoNosConocio: string | null
  notas: string | null
}

export type OtroCurso = {
  id: string
  codigo: string
  nombre: string
  estado: EstadoInscripcion
  inscritoEn: string
}

export type DetalleInscripcion = {
  inscripcion: Inscripcion
  ficha: Ficha | null
  otrosCursos: OtroCurso[]
  cargos: Cargo[]
  pagos: Pago[]
}

/*
  Lo que devuelve inscribir. La clave viene en claro y solo cuando la persona es
  nueva: es la única vez que existe fuera del hash, así que la pantalla tiene que
  enseñarla en ese momento o se pierde.
*/
export type ResultadoInscripcion = {
  inscripcion: Inscripcion
  clave: string | null
  matricula: string | null
  esPersonaNueva: boolean
  cargoGenerado: boolean
}

export const nombreEstadoInscripcion: Record<EstadoInscripcion, string> = {
  preinscrita: 'Preinscrita',
  activa: 'Activa',
  completada: 'Completada',
  retirada: 'Retirada',
  cancelada: 'Cancelada',
}

export const nombreEstadoCargo: Record<EstadoCargo, string> = {
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  anulado: 'Anulado',
  condonado: 'Condonado',
}

export const nombreMetodoPago: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
}

export const METODOS_PAGO = Object.entries(nombreMetodoPago).map(([valor, texto]) => ({
  valor,
  texto,
}))
