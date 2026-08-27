/*
  El certificado tal y como lo ve su dueño. Es un subconjunto estricto de lo que
  ve el mostrador: falta todo lo del POS -ticket, total, saldo- porque el
  endpoint del portal no lo pide y las políticas de la base no lo dejarían
  salir aunque lo pidiera.

  Que exista este tipo aparte y no se reutilice el del panel es a propósito: si
  compartieran uno solo, añadir un campo de caja al panel lo haría aparecer aquí
  como "disponible" sin que nadie lo decidiera.
*/
export type MiCertificado = {
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
}
