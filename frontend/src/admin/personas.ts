/*
  Tipos y etiquetas de /api/personas.

  "Persona" aquí es en realidad una membresía: la misma cuenta puede existir en
  dos instituciones con matrícula, roles y estado distintos en cada una. El id
  que se manda al servidor es siempre el de la membresía, nunca el del usuario.
*/

export type RolInstitucional =
  | 'propietario'
  | 'administrador'
  | 'coordinador'
  | 'docente'
  | 'estudiante'
  | 'invitado'

export type EstadoMembresia =
  | 'invitada'
  | 'activa'
  | 'suspendida'
  | 'retirada'
  | 'egresada'

export type Persona = {
  id: string
  usuarioId: string
  nombre: string
  correo: string
  codigo: string | null
  estado: EstadoMembresia
  roles: RolInstitucional[]
  programaId: string | null
  programa: string | null
  unidadAcademicaId: string | null
  unidad: string | null
  sedeId: string | null
  sede: string | null
  ingresoEn: string | null
  ultimoAcceso: string | null
  nuncaEntro: boolean
}

export type ListaPersonas = {
  personas: Persona[]
  total: number
  pagina: number
  porPagina: number
  resumen: Partial<Record<EstadoMembresia, number>>
}

export const nombreRolInstitucional: Record<RolInstitucional, string> = {
  propietario: 'Propietario',
  administrador: 'Administrador',
  coordinador: 'Coordinador',
  docente: 'Docente',
  estudiante: 'Estudiante',
  invitado: 'Invitado',
}

/* Lo que cada rol permite, para que elegirlo no sea adivinar. */
export const queHaceCadaRol: Record<RolInstitucional, string> = {
  propietario: 'Todo, y no se le puede quitar el rol si es el único que queda.',
  administrador: 'Configura la institución, crea cursos e invita personas.',
  coordinador: 'Gestiona los programas y cursos de su unidad académica.',
  docente: 'Imparte cursos, publica material y califica entregas.',
  estudiante: 'Se inscribe en cursos, entrega tareas y ve sus notas.',
  invitado: 'Solo lectura acotada: auditor externo, aspirante o acudiente.',
}

export const nombreEstadoMembresia: Record<EstadoMembresia, string> = {
  invitada: 'Invitada',
  activa: 'Activa',
  suspendida: 'Suspendida',
  retirada: 'Retirada',
  egresada: 'Egresada',
}

/*
  Cuándo entró por última vez, en palabras. Se calcula en el navegador y no en
  el servidor porque "hace 5 minutos" depende de la hora de quien mira, no de
  la del servidor.
*/
export function haceCuanto(iso: string | null): string {
  if (!iso) return 'Nunca'

  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return 'Ahora mismo'
  if (minutos < 60) return `Hace ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `Hace ${horas} h`

  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `Hace ${dias} días`

  const meses = Math.floor(dias / 30)
  if (meses < 12) return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`

  const anos = Math.floor(meses / 12)
  return `Hace ${anos} ${anos === 1 ? 'año' : 'años'}`
}
