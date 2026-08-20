/*
  Los tipos que devuelve /api/academico y las etiquetas legibles de sus enums.

  Viven en un archivo aparte y no dentro de cada pantalla porque unas se citan a
  otras: crear una sección necesita el año y el grado, el plan de un grado
  necesita las materias, y una unidad necesita las sedes. Tener el tipo en un
  solo sitio evita que dos pantallas describan la misma fila de dos formas.
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

export type Unidad = {
  id: string
  codigo: string
  nombre: string
  tipo: 'facultad' | 'escuela' | 'departamento' | 'area'
  padreId: string | null
  sedeId: string | null
  sede: string | null
  activa: boolean
  grados: number
  responsables: string[]
}

export type PeriodoCalificacion = {
  id: string
  orden: number
  nombre: string
  inicio: string
  fin: string
  cerrado: boolean
}

/*
  El año lectivo, de agosto a junio. Dentro lleva los cortes de nota: cuatro en
  el sistema del MINERD, aunque un colegio privado puede usar otro número.
*/
export type AnoEscolar = {
  id: string
  codigo: string
  nombre: string
  inicio: string
  fin: string
  inicioInscripcion: string | null
  finInscripcion: string | null
  estado: 'planificado' | 'activo' | 'cerrado'
  esActual: boolean
  secciones: number
  periodos: PeriodoCalificacion[]
}

export type Nivel = 'inicial' | 'primario' | 'secundario'

/* Una materia del catálogo del colegio: Matemática, Lengua Española. */
export type Asignatura = {
  id: string
  codigo: string
  nombre: string
  area: string | null
  activa: boolean
  /* En cuántos planes de grado aparece. Dice si se puede retirar. */
  grados: number
}

export type MateriaDelPlan = {
  asignaturaId: string
  codigo: string
  nombre: string
  horasSemanales: number | null
}

/*
  El escalón académico: 3ro de Primaria. Existe una vez por colegio, no una por
  año; lo que cambia cada año son las secciones y quién las cursa.

  Su plan de estudio es lo que hace que crear una sección genere sus cursos.
*/
export type Grado = {
  id: string
  nivel: Nivel
  orden: number
  nombre: string
  unidadAcademicaId: string | null
  unidad: string | null
  activo: boolean
  secciones: number
  plan: MateriaDelPlan[]
}

/* Un grupo concreto de un grado en un año: 3ro A de 2026-2027. */
export type Seccion = {
  id: string
  anoEscolarId: string
  ano: string
  gradoId: string
  grado: string
  nivel: Nivel
  nombre: string
  cupo: number | null
  aula: string | null
  sedeId: string | null
  sede: string | null
  tutorMembresiaId: string | null
  tutor: string | null
  activa: boolean
  cursos: number
  cursosSinDocente: number
}

/* Una materia impartida a una sección: "Matemática de 3ro A". */
export type Curso = {
  id: string
  anoEscolarId: string
  seccionId: string
  seccion: string
  grado: string
  asignaturaId: string
  asignatura: string
  codigoAsignatura: string
  docenteMembresiaId: string | null
  docente: string | null
  estado: 'borrador' | 'publicado' | 'cerrado'
}

export const nombreNivel: Record<Nivel, string> = {
  inicial: 'Inicial',
  primario: 'Primaria',
  secundario: 'Secundaria',
}

export const nombreEstadoCurso: Record<Curso['estado'], string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  cerrado: 'Cerrado',
}

/*
  Los niveles se muestran siempre en este orden, que es el del recorrido de un
  estudiante por el colegio. Ordenar alfabéticamente pondría Primaria antes que
  Inicial, que es exactamente al revés de como se cursa.
*/
export const ORDEN_NIVELES: Nivel[] = ['inicial', 'primario', 'secundario']

export const nombreTipoUnidad: Record<Unidad['tipo'], string> = {
  facultad: 'Facultad',
  escuela: 'Escuela',
  departamento: 'Departamento',
  area: 'Área',
}

export const nombreEstadoAno: Record<AnoEscolar['estado'], string> = {
  planificado: 'Planificado',
  activo: 'En curso',
  cerrado: 'Cerrado',
}

/*
  Las fechas llegan como '2026-05-04' y se muestran como '04 may 2026'.

  Se formatea a mano en vez de con Date: `new Date('2026-05-04')` se
  interpreta como medianoche UTC, y al pintarlo en una zona al oeste sale el
  día anterior. Un periodo académico es un día del calendario, no un instante.
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
  if (!desde && !hasta) return 'Sin definir'
  return `${fechaLegible(desde)} – ${fechaLegible(hasta)}`
}
