import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BookOpen,
  Calendar,
  ChartColumn,
  ChevronDown,
  House,
  MessageSquare,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { useRol, type Rol } from '../app/rol'
import { usePortal } from '../portal/contexto'
import { cn } from '../ui/cn'

type Seccion = {
  etiqueta: string
  ruta: string
  icono: LucideIcon
  roles: Rol[]
  panel?: 'cursos'
}

/*
  Navegacion horizontal para estudiantes y docentes: sus secciones son pocas y
  planas, y lo profundo cabe en el panel desplegable de cada una.

  La administracion no vive aqui. Es un trabajo distinto -no consultar sino
  configurar-, tiene decenas de pantallas y quien lo hace entra directo a su
  panel al iniciar sesion. Por eso tiene su propio marco con barra lateral.
*/
const secciones: Seccion[] = [
  { etiqueta: 'Inicio', ruta: '/inicio', icono: House, roles: ['estudiante', 'docente'] },
  { etiqueta: 'Cursos', ruta: '/cursos', icono: BookOpen, roles: ['estudiante', 'docente'], panel: 'cursos' },
  { etiqueta: 'Calendario', ruta: '/calendario', icono: Calendar, roles: ['estudiante', 'docente'] },
  { etiqueta: 'Clases', ruta: '/clases', icono: Video, roles: ['estudiante', 'docente'] },
  { etiqueta: 'Mensajes', ruta: '/mensajes', icono: MessageSquare, roles: ['estudiante', 'docente'] },
  { etiqueta: 'Reportes', ruta: '/reportes', icono: ChartColumn, roles: ['docente'] },
]

export function NavegacionPrincipal() {
  const { rol } = useRol()
  const { pathname } = useLocation()
  const [abierto, setAbierto] = useState<string | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => setAbierto(null), [pathname])

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(null)
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(null)
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [])

  const visibles = secciones.filter((s) => s.roles.includes(rol))

  return (
    <nav
      ref={contenedor}
      className="sticky top-13 z-20 border-b border-regla bg-superficie"
    >
      <div className="mx-auto flex max-w-[1500px] items-stretch gap-0.5 overflow-x-auto px-3 sm:px-6">
        {visibles.map((seccion) => {
          const Icono = seccion.icono
          const activa = pathname.startsWith(seccion.ruta)
          const etiqueta = rol === 'estudiante' && seccion.ruta === '/cursos'
            ? 'Mis cursos'
            : seccion.etiqueta

          const clases = cn(
            'relative flex items-center gap-2 px-3 py-3 text-[13.5px] font-medium transition-colors',
            'after:absolute after:inset-x-2 after:-bottom-px after:h-[2px] after:transition-colors',
            activa
              ? 'text-tinta after:bg-pizarra'
              : 'text-tinta-media after:bg-transparent hover:text-tinta hover:after:bg-regla-fuerte',
          )

          if (seccion.panel) {
            const esteAbierto = abierto === seccion.panel
            return (
              <div key={seccion.ruta} className="relative flex">
                <button
                  onClick={() =>
                    setAbierto(esteAbierto ? null : seccion.panel!)
                  }
                  aria-expanded={esteAbierto}
                  className={clases}
                >
                  <Icono size={16} strokeWidth={1.5} />
                  {etiqueta}
                  <ChevronDown
                    size={13}
                    strokeWidth={1.75}
                    className={cn(
                      'transition-transform',
                      esteAbierto && 'rotate-180',
                    )}
                  />
                </button>
                {esteAbierto && <PanelCursos />}
              </div>
            )
          }

          return (
            <NavLink key={seccion.ruta} to={seccion.ruta} className={clases}>
              <Icono size={16} strokeWidth={1.5} />
              {etiqueta}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

function PanelCursos() {
  const { cursos, cargando } = usePortal()

  return (
    <div className="absolute left-0 top-full z-30 w-[560px] border border-regla bg-superficie shadow-[0_12px_28px_-12px_rgba(20,23,26,0.28)] rounded-md">
      <div className="grid grid-cols-[1fr_200px]">
        <div className="border-r border-regla p-4">
          <p className="etiqueta-dato mb-3 text-tinta-suave">
            Mis cursos · {cursos.length}
          </p>
          {cargando ? (
            <p className="px-2 py-2 text-[13px] text-tinta-suave">Cargando cursos…</p>
          ) : cursos.length === 0 ? (
            <p className="px-2 py-2 text-[13px] text-tinta-media">No tienes cursos asignados.</p>
          ) : (
            <ul className="space-y-0.5">
              {cursos.slice(0, 5).map((curso) => (
                <li key={curso.id}>
                  <NavLink
                    to={`/cursos/${encodeURIComponent(curso.codigo)}`}
                    className="flex items-baseline gap-3 rounded-xs px-2 py-1.5 hover:bg-lienzo"
                  >
                    <span className="font-dato text-[12px] text-pizarra">{curso.codigo}</span>
                    <span className="truncate text-[13px] text-tinta">{curso.nombre}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-4">
          <p className="etiqueta-dato mb-3 text-tinta-suave">Ir a</p>
          <ul className="space-y-0.5 text-[13px]">
            <li>
              <NavLink to="/cursos" className="block rounded-xs px-2 py-1.5 text-tinta-media hover:bg-lienzo hover:text-tinta">
                Todos los cursos
              </NavLink>
            </li>
            <li>
              <NavLink to="/calendario" className="block rounded-xs px-2 py-1.5 text-tinta-media hover:bg-lienzo hover:text-tinta">
                Mi horario
              </NavLink>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

