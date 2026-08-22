/*
  Los tipos que devuelve /api/catalogo y las etiquetas legibles de sus enums.

  Viven en un archivo aparte y no dentro de cada pantalla porque unas se citan a
  otras: crear un curso necesita las categorias, las sedes y los instructores, y
  la pantalla de inscripciones necesita el curso entero para saber que cobrar.
  Tener el tipo en un solo sitio evita que dos pantallas describan la misma fila
  de dos formas.
*/

export type Sede = {
  id: string
  codigo: string
  nombre: string
  ciudad: string | null
  direccion: string | null
  esPrincipal: boolean
  activa: boolean
  personas: number
}

/* Como agrupa el centro su catalogo: Idiomas, Informatica, Oficios. */
export type Categoria = {
  id: string
  nombre: string
  descripcion: string | null
  color: string | null
  orden: number
  activa: boolean
  /* Cuantos cursos vivos la usan. Dice si se puede retirar. */
  cursos: number
}

/* Un bloque semanal: "lunes de 18:00 a 20:00". */
export type Horario = {
  diaSemana: number
  horaInicio: string
  horaFin: string
}

export type Modalidad = 'presencial' | 'virtual' | 'hibrido'
export type Nivel = 'basico' | 'intermedio' | 'avanzado'
export type EstadoCurso = 'promocion' | 'activo' | 'graduado'

/*
  La unidad que se anuncia, se cotiza y se cobra.

  Los montos llegan como texto y no como number: numeric(12,2) en Postgres tiene
  mas precision que el double de JavaScript, y es en esa conversion donde 1500.00
  se convierte en 1499.99. Se formatean para mostrarlos y solo se vuelven numero
  cuando alguien escribe una cifra nueva en el formulario.
*/
export type Curso = {
  id: string
  codigo: string
  nombre: string
  resumen: string | null
  descripcion: string | null
  categoriaId: string | null
  categoria: string | null
  categoriaColor: string | null
  instructorMembresiaId: string | null
  instructor: string | null
  modalidad: Modalidad
  nivel: Nivel | null
  sedeId: string | null
  sede: string | null
  aula: string | null
  imagenUrl: string | null
  precio: string
  moneda: string
  duracionHoras: string | null
  duracionSemanas: number | null
  iniciaEn: string | null
  terminaEn: string | null
  cupo: number | null
  certificado: boolean
  estado: EstadoCurso
  inscritos: number
  horarios: Horario[]
}

/* Quien puede figurar al frente de un curso: membresia con rol docente. */
export type Instructor = {
  membresiaId: string
  nombre: string
  correo: string | null
  cursos: number
}

export const nombreModalidad: Record<Modalidad, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrido: 'Híbrido',
}

export const nombreNivel: Record<Nivel, string> = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

export const nombreEstadoCurso: Record<EstadoCurso, string> = {
  promocion: 'En promoción',
  activo: 'Activo',
  graduado: 'Graduado',
}

/*
  ISO-8601: la semana empieza el lunes, que es 1. Coincide con extract(isodow)
  de Postgres, que es lo que guarda la columna, así que el índice del arreglo es
  directamente el valor de la base y no hay que traducir en ningún sitio.
*/
export const DIAS_SEMANA = [
  { valor: 1, corto: 'Lun', largo: 'Lunes' },
  { valor: 2, corto: 'Mar', largo: 'Martes' },
  { valor: 3, corto: 'Mié', largo: 'Miércoles' },
  { valor: 4, corto: 'Jue', largo: 'Jueves' },
  { valor: 5, corto: 'Vie', largo: 'Viernes' },
  { valor: 6, corto: 'Sáb', largo: 'Sábado' },
  { valor: 7, corto: 'Dom', largo: 'Domingo' },
]

/*
  "Lun y Mié · 18:00–20:00" cuando todos los bloques comparten hora, que es el
  caso normal; si no, se listan uno a uno. Resumirlo importa: en una tabla de
  treinta cursos, tres líneas por horario la vuelven ilegible.
*/
export function horarioLegible(horarios: Horario[]): string {
  if (horarios.length === 0) return 'Sin horario'

  const dias = horarios.map((h) => DIAS_SEMANA[h.diaSemana - 1]?.corto ?? '—')
  const mismaHora = horarios.every(
    (h) => h.horaInicio === horarios[0].horaInicio && h.horaFin === horarios[0].horaFin,
  )

  if (mismaHora) {
    return `${unirDias(dias)} · ${horarios[0].horaInicio}–${horarios[0].horaFin}`
  }

  return horarios
    .map((h) => `${DIAS_SEMANA[h.diaSemana - 1]?.corto} ${h.horaInicio}–${h.horaFin}`)
    .join(' · ')
}

function unirDias(dias: string[]): string {
  if (dias.length === 1) return dias[0]
  return `${dias.slice(0, -1).join(', ')} y ${dias[dias.length - 1]}`
}

/*
  Los montos se formatean con Intl y el código de moneda que trae el curso. Un
  centro puede cotizar en pesos y en dólares a la vez -los cursos corporativos
  suelen ir en dólares- y dar por hecho RD$ sería equivocarse en la mitad.
*/
export function dinero(monto: string | number, moneda = 'DOP'): string {
  const valor = typeof monto === 'string' ? Number(monto) : monto
  if (!Number.isFinite(valor)) return '—'
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(valor)
}

export function duracionLegible(horas: string | null, semanas: number | null): string {
  const partes: string[] = []
  if (horas) {
    const n = Number(horas)
    if (Number.isFinite(n)) partes.push(`${n % 1 === 0 ? n : n.toFixed(1)} h`)
  }
  if (semanas) partes.push(`${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`)
  return partes.length ? partes.join(' · ') : '—'
}

/*
  Las fechas llegan como '2026-05-04' y se muestran como '04 may 2026'.

  Se formatea a mano en vez de con Date: `new Date('2026-05-04')` se interpreta
  como medianoche UTC, y al pintarlo en una zona al oeste sale el día anterior.
  El inicio de un curso es un día del calendario, no un instante.
*/
const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

export function fechaLegible(iso: string | null): string {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-')
  const nombreMes = MESES[Number(mes) - 1]
  if (!nombreMes) return iso
  return `${dia} ${nombreMes} ${ano}`
}

export function rangoLegible(desde: string | null, hasta: string | null): string {
  if (!desde && !hasta) return 'Sin fechas'
  return `${fechaLegible(desde)} – ${fechaLegible(hasta)}`
}
