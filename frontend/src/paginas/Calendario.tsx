import { useRol } from '../app/rol'
import { CalendarioDocente } from '../portal/CalendarioDocente'
import { CalendarioEstudiante } from '../portal/CalendarioEstudiante'

/*
  Dos calendarios sobre los mismos dias. El del estudiante contesta "que tengo
  que entregar" y el de quien imparte "que tengo que preparar y corregir": las
  mismas fechas, leidas desde los dos lados de la clase.
*/
export function Calendario() {
  const { rol } = useRol()
  return rol === 'estudiante' ? <CalendarioEstudiante /> : <CalendarioDocente />
}
