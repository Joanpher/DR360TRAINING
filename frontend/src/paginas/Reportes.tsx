import { ChartColumn } from 'lucide-react'
import { useRol } from '../app/rol'
import { ReportesDocente } from '../portal/ReportesDocente'
import { Pendiente } from './Pendiente'

/*
  Reportes es del docente: la ruta ni siquiera aparece en el menu del
  estudiante. La rama del estudiante existe igualmente porque el selector de
  vista de la barra superior deja a quien administra asomarse a los dos paneles,
  y desde ahi se puede llegar a esta direccion escribiendola.
*/
export function Reportes() {
  const { rol } = useRol()

  if (rol === 'estudiante') {
    return (
      <Pendiente
        titulo="Reportes"
        icono={ChartColumn}
        texto="El seguimiento de rendimiento es de quien imparte el curso. Lo tuyo lo ves en cada curso, en Calificaciones."
      />
    )
  }

  return <ReportesDocente />
}
