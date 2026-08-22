/*
  Datos de maqueta de las pantallas administrativas que todavia no tienen API.
  El portal de estudiantes y docentes consume datos reales.

  Queda lo que todavia no esta conectado -personas, invitaciones, bitacora-.
  El catalogo y las inscripciones ya leen del API y por eso salieron de aqui.

  Los casos limite estan puestos a proposito: membresias suspendidas,
  invitaciones vencidas, cuentas que nunca entraron. Una maqueta que solo enseña
  filas perfectas no sirve para diseñar.
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
    ingreso: '01 jul 2026',
    ultimoAcceso: 'Hace 1 mes',
  },
]

export type EstadoInvitacion = 'pendiente' | 'aceptada' | 'revocada' | 'expirada'

export type Invitacion = {
  id: string
  correo: string
  roles: RolInstitucional[]
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
    estado: 'pendiente',
    enviada: '17 ago 2026',
    expira: 'En 5 días',
    invitadaPor: 'Joanpher Jiménez',
  },
  {
    id: 'i-2',
    correo: 'jmatos@uce.edu.do',
    roles: ['docente'],
    estado: 'pendiente',
    enviada: '16 ago 2026',
    expira: 'En 4 días',
    invitadaPor: 'Loammi Francisco Martínez',
  },
  {
    id: 'i-3',
    correo: 'pgomez@uce.edu.do',
    roles: ['coordinador', 'docente'],
    estado: 'pendiente',
    enviada: '15 ago 2026',
    expira: 'Mañana',
    invitadaPor: 'Joanpher Jiménez',
  },
  {
    id: 'i-4',
    correo: 'rdiaz@uce.edu.do',
    roles: ['estudiante'],
    estado: 'expirada',
    enviada: '02 ago 2026',
    expira: 'Venció el 09 ago',
    invitadaPor: 'Joanpher Jiménez',
  },
  {
    id: 'i-5',
    correo: 'ktorres@uce.edu.do',
    roles: ['administrador'],
    estado: 'revocada',
    enviada: '28 jul 2026',
    expira: '—',
    invitadaPor: 'Joanpher Jiménez',
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
    accion: 'Publicó un curso',
    objeto: 'ING-101 · Inglés Básico',
    ip: '190.80.14.22',
  },
  {
    id: 'b-6',
    cuando: '17 ago · 08:20',
    actor: 'Rosanna Peña Guerrero',
    accion: 'Emitió una matrícula',
    objeto: 'ITC-2026-0031 · Carla Méndez',
    ip: '152.166.7.4',
  },
]
