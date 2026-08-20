/*
  Datos de maqueta del panel de administracion. Se reemplazan por el API.
  Estan aqui y no en datos/demo.ts porque son de otra naturaleza: aquello es
  lo que consume un estudiante, esto es el inventario de una institucion.

  Los casos limite estan puestos a proposito: cursos sin docente, membresias
  suspendidas, invitaciones vencidas, un periodo todavia en planificacion. Una
  maqueta que solo enseña filas perfectas no sirve para diseñar.
*/

export type RolInstitucional =
  | 'propietario'
  | 'administrador'
  | 'coordinador'
  | 'docente'
  | 'estudiante'
  | 'invitado'

export type EstadoMembresia = 'invitada' | 'activa' | 'suspendida' | 'retirada' | 'egresada'

export type Persona = {
  id: string
  nombre: string
  correo: string
  codigo: string | null
  roles: RolInstitucional[]
  estado: EstadoMembresia
  programa: string | null
  ingreso: string
  ultimoAcceso: string | null
}

export const personas: Persona[] = [
  {
    id: 'p-1',
    nombre: 'Joanpher Jiménez',
    correo: 'jjimenez@uce.edu.do',
    codigo: 'EMP-0001',
    roles: ['propietario', 'administrador'],
    estado: 'activa',
    programa: null,
    ingreso: '02 ene 2026',
    ultimoAcceso: 'Hace 4 min',
  },
  {
    id: 'p-2',
    nombre: 'Germán Chirino López',
    correo: 'gchirino@uce.edu.do',
    codigo: 'EMP-0114',
    roles: ['docente'],
    estado: 'activa',
    programa: 'Ingeniería de Software',
    ingreso: '14 ene 2026',
    ultimoAcceso: 'Hoy · 09:12',
  },
  {
    id: 'p-3',
    nombre: 'Loammi Francisco Martínez',
    correo: 'lfrancisco@uce.edu.do',
    codigo: 'EMP-0132',
    roles: ['docente', 'coordinador'],
    estado: 'activa',
    programa: 'Ingeniería de Software',
    ingreso: '14 ene 2026',
    ultimoAcceso: 'Ayer · 17:40',
  },
  {
    id: 'p-4',
    nombre: 'Rosanna Peña Guerrero',
    correo: 'rpena@uce.edu.do',
    codigo: 'EMP-0140',
    roles: ['docente'],
    estado: 'activa',
    programa: 'Ingeniería en Sistemas',
    ingreso: '20 ene 2026',
    ultimoAcceso: 'Hace 2 días',
  },
  {
    id: 'p-5',
    nombre: 'Ángel Luis Florentino',
    correo: 'aflorentino@uce.edu.do',
    codigo: 'EMP-0151',
    roles: ['docente'],
    estado: 'suspendida',
    programa: 'Ingeniería de Software',
    ingreso: '20 ene 2026',
    ultimoAcceso: 'Hace 3 semanas',
  },
  {
    id: 'p-6',
    nombre: 'María Altagracia Reyes',
    correo: 'mreyes@uce.edu.do',
    codigo: '2023-3970',
    roles: ['estudiante'],
    estado: 'activa',
    programa: 'Ingeniería de Software',
    ingreso: '05 feb 2026',
    ultimoAcceso: 'Hoy · 11:02',
  },
  {
    id: 'p-7',
    nombre: 'Carlos Manuel Peralta',
    correo: 'cperalta@uce.edu.do',
    codigo: '2023-4012',
    roles: ['estudiante'],
    estado: 'activa',
    programa: 'Ingeniería en Sistemas',
    ingreso: '05 feb 2026',
    ultimoAcceso: 'Hoy · 08:45',
  },
  {
    id: 'p-8',
    nombre: 'Yamilet Santos Cruz',
    correo: 'ysantos@uce.edu.do',
    codigo: '2024-1188',
    roles: ['estudiante'],
    estado: 'invitada',
    programa: 'Administración de Empresas',
    ingreso: '—',
    ultimoAcceso: null,
  },
  {
    id: 'p-9',
    nombre: 'Wender Robinson Batista',
    correo: 'wbatista@uce.edu.do',
    codigo: 'EMP-0163',
    roles: ['docente'],
    estado: 'activa',
    programa: 'Ingeniería en Sistemas',
    ingreso: '11 feb 2026',
    ultimoAcceso: 'Hace 5 h',
  },
  {
    id: 'p-10',
    nombre: 'Bernardino Javier Estévez',
    correo: 'bestevez@uce.edu.do',
    codigo: 'EMP-0170',
    roles: ['docente'],
    estado: 'activa',
    programa: 'Ingeniería de Software',
    ingreso: '11 feb 2026',
    ultimoAcceso: 'Hace 1 día',
  },
  {
    id: 'p-11',
    nombre: 'Elvin Rafael Mota',
    correo: 'emota@uce.edu.do',
    codigo: '2022-2044',
    roles: ['estudiante'],
    estado: 'retirada',
    programa: 'Ingeniería de Software',
    ingreso: '18 ago 2025',
    ultimoAcceso: 'Hace 4 meses',
  },
  {
    id: 'p-12',
    nombre: 'Auditoría MESCyT',
    correo: 'auditoria@mescyt.gob.do',
    codigo: null,
    roles: ['invitado'],
    estado: 'activa',
    programa: null,
    ingreso: '01 jul 2026',
    ultimoAcceso: 'Hace 1 mes',
  },
]

export type EstadoInvitacion = 'pendiente' | 'aceptada' | 'revocada' | 'expirada'

export type Invitacion = {
  id: string
  correo: string
  roles: RolInstitucional[]
  programa: string | null
  estado: EstadoInvitacion
  enviada: string
  expira: string
  invitadaPor: string
}

export const invitaciones: Invitacion[] = [
  {
    id: 'i-1',
    correo: 'ysantos@uce.edu.do',
    roles: ['estudiante'],
    programa: 'Administración de Empresas',
    estado: 'pendiente',
    enviada: '17 ago 2026',
    expira: 'En 5 días',
    invitadaPor: 'Joanpher Jiménez',
  },
  {
    id: 'i-2',
    correo: 'jmatos@uce.edu.do',
    roles: ['docente'],
    programa: 'Ingeniería en Sistemas',
    estado: 'pendiente',
    enviada: '16 ago 2026',
    expira: 'En 4 días',
    invitadaPor: 'Loammi Francisco Martínez',
  },
  {
    id: 'i-3',
    correo: 'pgomez@uce.edu.do',
    roles: ['coordinador', 'docente'],
    programa: 'Ingeniería de Software',
    estado: 'pendiente',
    enviada: '15 ago 2026',
    expira: 'Mañana',
    invitadaPor: 'Joanpher Jiménez',
  },
  {
    id: 'i-4',
    correo: 'rdiaz@uce.edu.do',
    roles: ['estudiante'],
    programa: 'Ingeniería de Software',
    estado: 'expirada',
    enviada: '02 ago 2026',
    expira: 'Venció el 09 ago',
    invitadaPor: 'Joanpher Jiménez',
  },
  {
    id: 'i-5',
    correo: 'ktorres@uce.edu.do',
    roles: ['administrador'],
    programa: null,
    estado: 'revocada',
    enviada: '28 jul 2026',
    expira: '—',
    invitadaPor: 'Joanpher Jiménez',
  },
]

export type EstadoCurso = 'borrador' | 'publicado' | 'cerrado'

export type CursoAdmin = {
  id: string
  codigo: string
  asignatura: string
  seccion: string
  creditos: number
  docente: string | null
  programa: string
  periodo: string
  inscritos: number
  cupo: number
  modalidad: 'presencial' | 'virtual' | 'híbrida'
  estado: EstadoCurso
}

export const cursosAdmin: CursoAdmin[] = [
  {
    id: 'c-1',
    codigo: 'ISW-126',
    asignatura: 'Desarrollo de Aplicaciones Web',
    seccion: '01',
    creditos: 4,
    docente: 'Ángel Luis Florentino',
    programa: 'Ingeniería de Software',
    periodo: '2026-2',
    inscritos: 34,
    cupo: 35,
    modalidad: 'presencial',
    estado: 'publicado',
  },
  {
    id: 'c-2',
    codigo: 'ISW-115',
    asignatura: 'Gestión de Configuración de Software',
    seccion: '01',
    creditos: 3,
    docente: 'Loammi Francisco Martínez',
    programa: 'Ingeniería de Software',
    periodo: '2026-2',
    inscritos: 28,
    cupo: 30,
    modalidad: 'híbrida',
    estado: 'publicado',
  },
  {
    id: 'c-3',
    codigo: 'ISW-132',
    asignatura: 'Análisis y Optimización de Sistemas',
    seccion: '02',
    creditos: 4,
    docente: 'Germán Chirino López',
    programa: 'Ingeniería de Software',
    periodo: '2026-2',
    inscritos: 31,
    cupo: 35,
    modalidad: 'presencial',
    estado: 'publicado',
  },
  {
    id: 'c-4',
    codigo: 'ISW-312',
    asignatura: 'Tecnologías de Integración',
    seccion: '01',
    creditos: 3,
    docente: null,
    programa: 'Ingeniería en Sistemas',
    periodo: '2026-2',
    inscritos: 0,
    cupo: 30,
    modalidad: 'virtual',
    estado: 'borrador',
  },
  {
    id: 'c-5',
    codigo: 'ISW-412',
    asignatura: 'Computación Gráfica',
    seccion: '01',
    creditos: 4,
    docente: 'Bernardino Javier Estévez',
    programa: 'Ingeniería de Software',
    periodo: '2026-2',
    inscritos: 19,
    cupo: 25,
    modalidad: 'presencial',
    estado: 'publicado',
  },
  {
    id: 'c-6',
    codigo: 'ISW-220',
    asignatura: 'Bases de Datos Avanzadas',
    seccion: '01',
    creditos: 4,
    docente: 'Rosanna Peña Guerrero',
    programa: 'Ingeniería en Sistemas',
    periodo: '2026-2',
    inscritos: 35,
    cupo: 35,
    modalidad: 'presencial',
    estado: 'publicado',
  },
  {
    id: 'c-7',
    codigo: 'ADM-101',
    asignatura: 'Fundamentos de Administración',
    seccion: '03',
    creditos: 3,
    docente: null,
    programa: 'Administración de Empresas',
    periodo: '2026-2',
    inscritos: 0,
    cupo: 40,
    modalidad: 'presencial',
    estado: 'borrador',
  },
  {
    id: 'c-8',
    codigo: 'ISW-126',
    asignatura: 'Desarrollo de Aplicaciones Web',
    seccion: '02',
    creditos: 4,
    docente: 'Wender Robinson Batista',
    programa: 'Ingeniería de Software',
    periodo: '2026-1',
    inscritos: 33,
    cupo: 35,
    modalidad: 'presencial',
    estado: 'cerrado',
  },
]

export type Programa = {
  id: string
  codigo: string
  nombre: string
  nivel: 'técnico' | 'grado' | 'especialidad' | 'maestría' | 'doctorado' | 'diplomado'
  unidad: string
  creditos: number
  duracion: string
  estudiantes: number
  activo: boolean
}

export const programas: Programa[] = [
  {
    id: 'pr-1',
    codigo: 'ISW',
    nombre: 'Ingeniería de Software',
    nivel: 'grado',
    unidad: 'Escuela de Informática',
    creditos: 216,
    duracion: '4 años',
    estudiantes: 412,
    activo: true,
  },
  {
    id: 'pr-2',
    codigo: 'ISI',
    nombre: 'Ingeniería en Sistemas',
    nivel: 'grado',
    unidad: 'Escuela de Informática',
    creditos: 220,
    duracion: '4 años',
    estudiantes: 388,
    activo: true,
  },
  {
    id: 'pr-3',
    codigo: 'ADM',
    nombre: 'Administración de Empresas',
    nivel: 'grado',
    unidad: 'Escuela de Negocios',
    creditos: 198,
    duracion: '4 años',
    estudiantes: 507,
    activo: true,
  },
  {
    id: 'pr-4',
    codigo: 'MCD',
    nombre: 'Maestría en Ciencia de Datos',
    nivel: 'maestría',
    unidad: 'Escuela de Informática',
    creditos: 48,
    duracion: '2 años',
    estudiantes: 41,
    activo: true,
  },
  {
    id: 'pr-5',
    codigo: 'DIP-CIB',
    nombre: 'Diplomado en Ciberseguridad',
    nivel: 'diplomado',
    unidad: 'Escuela de Informática',
    creditos: 12,
    duracion: '6 meses',
    estudiantes: 0,
    activo: false,
  },
]

export type Periodo = {
  id: string
  codigo: string
  nombre: string
  estado: 'planificado' | 'activo' | 'cerrado'
  inicio: string
  fin: string
  inscripcion: string
  cursos: number
}

export const periodos: Periodo[] = [
  {
    id: 'pe-1',
    codigo: '2026-2',
    nombre: 'Cuatrimestre mayo – agosto 2026',
    estado: 'activo',
    inicio: '04 may 2026',
    fin: '29 ago 2026',
    inscripcion: '20 abr – 03 may',
    cursos: 212,
  },
  {
    id: 'pe-2',
    codigo: '2026-3',
    nombre: 'Cuatrimestre septiembre – diciembre 2026',
    estado: 'planificado',
    inicio: '07 sep 2026',
    fin: '19 dic 2026',
    inscripcion: '24 ago – 05 sep',
    cursos: 18,
  },
  {
    id: 'pe-3',
    codigo: '2026-1',
    nombre: 'Cuatrimestre enero – abril 2026',
    estado: 'cerrado',
    inicio: '12 ene 2026',
    fin: '24 abr 2026',
    inscripcion: '05 – 11 ene',
    cursos: 198,
  },
]

export type Sede = {
  id: string
  nombre: string
  ciudad: string
  direccion: string
  principal: boolean
  personas: number
}

export const sedes: Sede[] = [
  {
    id: 's-1',
    nombre: 'Campus San Pedro',
    ciudad: 'San Pedro de Macorís',
    direccion: 'Av. Circunvalación, km 2',
    principal: true,
    personas: 2840,
  },
  {
    id: 's-2',
    nombre: 'Recinto Santo Domingo',
    ciudad: 'Santo Domingo',
    direccion: 'Av. Abraham Lincoln 1052',
    principal: false,
    personas: 512,
  },
  {
    id: 's-3',
    nombre: 'Extensión virtual',
    ciudad: '—',
    direccion: 'Sin sede física',
    principal: false,
    personas: 66,
  },
]

export type EventoBitacora = {
  id: string
  cuando: string
  actor: string
  accion: string
  objeto: string
  ip: string
}

export const bitacora: EventoBitacora[] = [
  {
    id: 'b-1',
    cuando: 'Hoy · 11:42',
    actor: 'Joanpher Jiménez',
    accion: 'Invitó a una persona',
    objeto: 'ysantos@uce.edu.do · estudiante',
    ip: '190.80.14.22',
  },
  {
    id: 'b-2',
    cuando: 'Hoy · 10:18',
    actor: 'Loammi Francisco Martínez',
    accion: 'Creó un curso',
    objeto: 'ISW-312-01 · Tecnologías de Integración',
    ip: '190.80.14.90',
  },
  {
    id: 'b-3',
    cuando: 'Hoy · 09:55',
    actor: 'Joanpher Jiménez',
    accion: 'Suspendió una membresía',
    objeto: 'Ángel Luis Florentino',
    ip: '190.80.14.22',
  },
  {
    id: 'b-4',
    cuando: 'Ayer · 16:31',
    actor: 'Sistema',
    accion: 'Expiró una invitación',
    objeto: 'rdiaz@uce.edu.do',
    ip: '—',
  },
  {
    id: 'b-5',
    cuando: 'Ayer · 14:02',
    actor: 'Joanpher Jiménez',
    accion: 'Abrió el periodo',
    objeto: '2026-2',
    ip: '190.80.14.22',
  },
  {
    id: 'b-6',
    cuando: '17 ago · 08:20',
    actor: 'Rosanna Peña Guerrero',
    accion: 'Publicó un curso',
    objeto: 'ISW-220-01 · Bases de Datos Avanzadas',
    ip: '152.166.7.4',
  },
]

/* Lo que aún falta para que la institución esté realmente en marcha. */
export const puestaEnMarcha = [
  { paso: 'Crear la institución', hecho: true, ruta: '/admin/institucion' },
  { paso: 'Definir unidades académicas', hecho: true, ruta: '/admin/unidades' },
  { paso: 'Registrar programas', hecho: true, ruta: '/admin/programas' },
  { paso: 'Abrir el periodo académico', hecho: true, ruta: '/admin/periodos' },
  { paso: 'Invitar al equipo docente', hecho: true, ruta: '/admin/personas' },
  { paso: 'Publicar los cursos del periodo', hecho: false, ruta: '/admin/cursos' },
  { paso: 'Verificar el dominio de correo', hecho: false, ruta: '/admin/institucion' },
  { paso: 'Definir la escala de calificación', hecho: false, ruta: '/admin/institucion' },
]
