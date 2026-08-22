import { useRol } from '../app/rol'
import { InicioDocente } from '../portal/InicioDocente'
import { InicioEstudiante } from '../portal/InicioEstudiante'

export function Inicio() {
  const { rol } = useRol()
  return rol === 'estudiante' ? <InicioEstudiante /> : <InicioDocente />
}
