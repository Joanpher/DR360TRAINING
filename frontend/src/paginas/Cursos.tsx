import { useRol } from '../app/rol'
import { CursosDocente } from '../portal/CursosDocente'
import { CursosEstudiante } from '../portal/CursosEstudiante'

export function Cursos() {
  const { rol } = useRol()
  return rol === 'estudiante' ? <CursosEstudiante /> : <CursosDocente />
}
