import { ChevronDown, Eye } from 'lucide-react'
import { nombreRol, useVista, type Rol } from '../app/rol'
import { cn } from '../ui/cn'

const VISTAS: Rol[] = ['admin', 'docente', 'estudiante']

/*
  "Ver como": el administrador se asoma al panel del instructor o del
  estudiante sin salir de su sesion.

  Solo aparece para quien administra. Para los demas no es que este
  deshabilitado: no existe, porque para ellos no hay nada que elegir.

  Mientras se previsualiza el control se pone en ambar y lo dice con todas las
  letras. Esa insistencia es a proposito: una pantalla que se parece a la de
  otro y no avisa termina en un administrador convencido de que la plataforma
  perdio sus permisos.
*/
export function SelectorVista() {
  const { rol, puedeCambiarVista, previsualizando, cambiarVista } = useVista()

  if (!puedeCambiarVista) return null

  return (
    <div
      className={cn(
        'relative hidden items-center gap-1.5 rounded-sm border pl-2 pr-1 md:flex',
        previsualizando
          ? 'border-aviso bg-aviso/30 text-aviso-tenue'
          : 'border-white/15 bg-white/8 text-white/75',
      )}
    >
      <Eye size={14} strokeWidth={1.5} className="shrink-0" />

      <span className="etiqueta-dato hidden text-[10px] lg:inline">
        {previsualizando ? 'Vista previa' : 'Ver como'}
      </span>

      <select
        aria-label="Ver la plataforma como"
        value={rol}
        onChange={(e) => cambiarVista(e.target.value as Rol)}
        className="h-7 cursor-pointer appearance-none bg-transparent pl-1 pr-5 text-[12px] font-medium text-current focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {VISTAS.map((v) => (
          // El desplegable nativo se dibuja con el sistema, no con la barra:
          // sin estos colores queda texto claro sobre fondo claro en Windows.
          <option key={v} value={v} className="bg-superficie text-tinta">
            {v === 'admin' ? 'Administración' : nombreRol[v]}
          </option>
        ))}
      </select>

      <ChevronDown
        size={13}
        strokeWidth={1.5}
        className="pointer-events-none absolute right-1.5 opacity-70"
      />
    </div>
  )
}
