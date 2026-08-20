/*
  Datos de maqueta. Se reemplazan por el API del backend.
  Sirven para validar densidad, jerarquia y casos limite de la interfaz.
*/

export type EstadoEntrega = 'pendiente' | 'entregada' | 'calificada' | 'vencida'

export type Curso = {
  codigo: string
  asignatura: string
  docente: string
  creditos: number
  progreso: number
  proxima: { titulo: string; fecha: string; estado: EstadoEntrega } | null
}

export const institucion = {
  codigo: 'uce',
  nombre: 'Universidad Central del Este',
  siglas: 'UCE',
  periodo: '2026-2',
}

export const usuario = {
  nombre: 'Joanpher Jiménez',
  iniciales: 'JJ',
  correo: 'jj2023-3970@uce.edu.do',
  matricula: '2023-3970',
  carrera: 'Ingeniería de Software',
}

export const cursos: Curso[] = [
  {
    codigo: 'ISW-132-1',
    asignatura: 'Análisis y Optimización de Sistemas',
    docente: 'Germán Chirino López',
    creditos: 4,
    progreso: 62,
    proxima: {
      titulo: 'Informe de optimización',
      fecha: '18 ago',
      estado: 'pendiente',
    },
  },
  {
    codigo: 'ISW-115-1',
    asignatura: 'Gestión de Configuración de Software',
    docente: 'Loammi Francisco Martínez',
    creditos: 3,
    progreso: 48,
    proxima: {
      titulo: 'Práctica 4: ramas y versiones',
      fecha: '16 ago',
      estado: 'vencida',
    },
  },
  {
    codigo: 'ISW-126-1',
    asignatura: 'Desarrollo de Aplicaciones Web',
    docente: 'Ángel Luis Florentino',
    creditos: 4,
    progreso: 71,
    proxima: {
      titulo: 'Proyecto parcial: API REST',
      fecha: '22 ago',
      estado: 'pendiente',
    },
  },
  {
    codigo: 'ISW-312-1',
    asignatura: 'Tecnologías de Integración',
    docente: 'Wender Robinson Batista',
    creditos: 3,
    progreso: 35,
    proxima: null,
  },
  {
    codigo: 'ISW-412-1',
    asignatura: 'Computación Gráfica',
    docente: 'Bernardino Javier Estévez',
    creditos: 4,
    progreso: 55,
    proxima: {
      titulo: 'Taller de rasterización',
      fecha: '25 ago',
      estado: 'pendiente',
    },
  },
  {
    codigo: 'ISW-220-1',
    asignatura: 'Bases de Datos Avanzadas',
    docente: 'Rosanna Peña Guerrero',
    creditos: 4,
    progreso: 80,
    proxima: {
      titulo: 'Modelo relacional entregado',
      fecha: '12 ago',
      estado: 'calificada',
    },
  },
]

export const resumenPorRol = {
  estudiante: [
    { etiqueta: 'Cursos activos', valor: '6', pie: `Periodo ${institucion.periodo}` },
    { etiqueta: 'Entregas pendientes', valor: '3', pie: '1 vencida' },
    { etiqueta: 'Índice acumulado', valor: '3.62', pie: 'Escala 0.00 – 4.00' },
    { etiqueta: 'Asistencia', valor: '96%', pie: '48 de 50 sesiones' },
  ],
  docente: [
    { etiqueta: 'Cursos asignados', valor: '4', pie: `Periodo ${institucion.periodo}` },
    { etiqueta: 'Por calificar', valor: '27', pie: '9 fuera de plazo' },
    { etiqueta: 'Clases esta semana', valor: '6', pie: '2 sin grabar' },
    { etiqueta: 'Estudiantes', valor: '142', pie: '4 retirados' },
  ],
  admin: [
    { etiqueta: 'Usuarios activos', valor: '3418', pie: 'Últimos 30 días' },
    { etiqueta: 'Cursos del periodo', valor: '212', pie: '18 sin docente' },
    { etiqueta: 'Clases en vivo hoy', valor: '34', pie: '112 horas grabadas' },
    { etiqueta: 'Almacenamiento', valor: '68%', pie: '340 GB de 500 GB' },
  ],
}

export const proximaClase = {
  curso: 'ISW-126-1',
  asignatura: 'Desarrollo de Aplicaciones Web',
  docente: 'Ángel Luis Florentino',
  inicio: '14:00',
  faltan: '00:47:12',
}

export const agenda = [
  {
    fecha: '16 ago',
    hora: '23:59',
    titulo: 'Práctica 4: ramas y versiones',
    curso: 'ISW-115-1',
    estado: 'vencida' as EstadoEntrega,
  },
  {
    fecha: '18 ago',
    hora: '23:59',
    titulo: 'Informe de optimización',
    curso: 'ISW-132-1',
    estado: 'pendiente' as EstadoEntrega,
  },
  {
    fecha: '19 ago',
    hora: '10:00',
    titulo: 'Clase en vivo: integración continua',
    curso: 'ISW-312-1',
    estado: 'pendiente' as EstadoEntrega,
  },
  {
    fecha: '22 ago',
    hora: '23:59',
    titulo: 'Proyecto parcial: API REST',
    curso: 'ISW-126-1',
    estado: 'pendiente' as EstadoEntrega,
  },
]

export const anuncios = [
  {
    titulo: 'Cierre de carga académica',
    cuerpo:
      'El periodo de retiro de asignaturas termina el viernes 21 de agosto a las 5:00 p.m.',
    origen: 'Registro académico',
    fecha: '15 ago',
  },
  {
    titulo: 'Mantenimiento del campus virtual',
    cuerpo:
      'El domingo 23 de agosto la plataforma estará fuera de servicio de 1:00 a 5:00 a.m.',
    origen: 'Dirección de tecnología',
    fecha: '14 ago',
  },
]

export const actividad = [
  { hora: '11:42', texto: 'Calificaste 18 entregas en ISW-115-1', tipo: 'nota' },
  { hora: '09:15', texto: 'Nuevo material en ISW-126-1: “Middleware”', tipo: 'material' },
  { hora: 'Ayer', texto: 'Grabación disponible de la clase del 14 ago', tipo: 'clase' },
  { hora: 'Ayer', texto: 'Ángel Luis Florentino respondió en el foro', tipo: 'foro' },
]

/* --- Detalle de curso --- */

export const unidades = [
  {
    titulo: 'Unidad 1 · Fundamentos de la web moderna',
    estado: 'Completada',
    materiales: [
      { tipo: 'documento', titulo: 'Guía de la asignatura', peso: '412 KB', fecha: '05 ago' },
      { tipo: 'video', titulo: 'Arquitectura cliente-servidor', peso: '38 min', fecha: '06 ago' },
      { tipo: 'enlace', titulo: 'Documentación de referencia', peso: 'Externo', fecha: '06 ago' },
    ],
  },
  {
    titulo: 'Unidad 2 · Servicios y APIs',
    estado: 'En curso',
    materiales: [
      { tipo: 'documento', titulo: 'Diseño de una API REST', peso: '1.2 MB', fecha: '12 ago' },
      { tipo: 'documento', titulo: 'Middleware y manejo de errores', peso: '840 KB', fecha: '15 ago' },
      { tipo: 'video', titulo: 'Autenticación con tokens', peso: '52 min', fecha: '15 ago' },
    ],
  },
  {
    titulo: 'Unidad 3 · Persistencia',
    estado: 'Bloqueada',
    materiales: [],
  },
]

export const tareas = [
  {
    titulo: 'Proyecto parcial: API REST',
    unidad: 'Unidad 2',
    limite: '22 ago · 23:59',
    puntos: 30,
    obtenido: null as number | null,
    estado: 'pendiente' as EstadoEntrega,
  },
  {
    titulo: 'Práctica 3: rutas y controladores',
    unidad: 'Unidad 2',
    limite: '10 ago · 23:59',
    puntos: 15,
    obtenido: 14,
    estado: 'calificada' as EstadoEntrega,
  },
  {
    titulo: 'Cuestionario de arquitectura',
    unidad: 'Unidad 1',
    limite: '03 ago · 23:59',
    puntos: 10,
    obtenido: 8,
    estado: 'calificada' as EstadoEntrega,
  },
  {
    titulo: 'Ensayo: historia de la web',
    unidad: 'Unidad 1',
    limite: '28 jul · 23:59',
    puntos: 10,
    obtenido: 0,
    estado: 'vencida' as EstadoEntrega,
  },
]

export const sesiones = [
  {
    titulo: 'Middleware y manejo de errores',
    fecha: 'Hoy · 14:00',
    duracion: '90 min',
    estado: 'proxima' as const,
    asistencia: null as string | null,
  },
  {
    titulo: 'Diseño de una API REST',
    fecha: '14 ago · 14:00',
    duracion: '88 min',
    estado: 'grabada' as const,
    asistencia: 'Presente',
  },
  {
    titulo: 'Rutas y controladores',
    fecha: '12 ago · 14:00',
    duracion: '95 min',
    estado: 'grabada' as const,
    asistencia: 'Ausente',
  },
]

/*
  El puntaje crudo es el dato guardado; la escala solo lo presenta.
  Esta tabla existe para ver esa regla funcionando en pantalla.
*/
export const escala = {
  nombre: 'Escala literal UCE',
  tipo: 'literal',
  bandas: [
    { etiqueta: 'A', desde: 90, hasta: 100, indice: 4.0 },
    { etiqueta: 'B', desde: 80, hasta: 89, indice: 3.0 },
    { etiqueta: 'C', desde: 70, hasta: 79, indice: 2.0 },
    { etiqueta: 'D', desde: 60, hasta: 69, indice: 1.0 },
    { etiqueta: 'F', desde: 0, hasta: 59, indice: 0.0 },
  ],
}

export const categorias = [
  { nombre: 'Prácticas', peso: 30, obtenido: 22, posible: 25 },
  { nombre: 'Proyecto', peso: 40, obtenido: 0, posible: 30 },
  { nombre: 'Exámenes', peso: 30, obtenido: 26, posible: 30 },
]
