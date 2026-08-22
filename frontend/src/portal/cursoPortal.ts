import type { Curso, Horario } from '../admin/catalogo'

export type ClaseProgramada = {
  clave: string
  curso: Curso
  inicio: Date
  fin: Date
  horario: Horario
}

function isoLocal(fecha: Date): string {
  const ano = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function conHora(fecha: Date, hora: string): Date {
  const [horas, minutos] = hora.split(':').map(Number)
  const resultado = new Date(fecha)
  resultado.setHours(horas, minutos, 0, 0)
  return resultado
}

export function proximasClases(cursos: Curso[], cantidad = 6): ClaseProgramada[] {
  const ahora = new Date()
  const diaActual = ahora.getDay() || 7
  const clases: ClaseProgramada[] = []

  for (const curso of cursos) {
    if (curso.estado === 'graduado') continue

    for (const horario of curso.horarios) {
      let dias = (horario.diaSemana - diaActual + 7) % 7
      let fecha = new Date(ahora)
      fecha.setHours(0, 0, 0, 0)
      fecha.setDate(fecha.getDate() + dias)
      let inicio = conHora(fecha, horario.horaInicio)

      if (inicio <= ahora) {
        dias += 7
        fecha = new Date(fecha)
        fecha.setDate(fecha.getDate() + 7)
        inicio = conHora(fecha, horario.horaInicio)
      }

      while (curso.iniciaEn && isoLocal(inicio) < curso.iniciaEn) {
        inicio.setDate(inicio.getDate() + 7)
      }
      if (curso.terminaEn && isoLocal(inicio) > curso.terminaEn) continue

      for (let semana = 0; semana < cantidad; semana += 1) {
        const inicioDeClase = new Date(inicio)
        inicioDeClase.setDate(inicioDeClase.getDate() + semana * 7)
        if (curso.terminaEn && isoLocal(inicioDeClase) > curso.terminaEn) break

        clases.push({
          clave: `${curso.id}-${horario.diaSemana}-${horario.horaInicio}-${isoLocal(inicioDeClase)}`,
          curso,
          inicio: inicioDeClase,
          fin: conHora(inicioDeClase, horario.horaFin),
          horario,
        })
      }
    }
  }

  return clases.sort((a, b) => a.inicio.getTime() - b.inicio.getTime()).slice(0, cantidad)
}

export function fechaClase(fecha: Date): string {
  return new Intl.DateTimeFormat('es-DO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(fecha)
}

export function horaClase(fecha: Date): string {
  return new Intl.DateTimeFormat('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(fecha)
}
