import { CalendarDays } from 'lucide-react'
import { useRol } from '../app/rol'
import { CalendarioEstudiante } from '../portal/CalendarioEstudiante'
import { Pendiente } from './Pendiente'

export function Calendario() {
  const { rol } = useRol()

  if (rol === 'estudiante') return <CalendarioEstudiante />

  return (
    <Pendiente
      titulo="Calendario"
      icono={CalendarDays}
      texto="Reúne clases, fechas límite y eventos de la institución. No guarda datos propios: proyecta los de cursos, tareas y sesiones."
    />
  )
}
