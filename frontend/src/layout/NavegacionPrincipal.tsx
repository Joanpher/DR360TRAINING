import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Award,
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
import {
  fondoRotulador,
  fondoRotuladorHover,
  textoRotulador,
  textoRotuladorHover,
  type Rotulador,
} from '../ui/rotulador'

type Seccion = {
  etiqueta: string
  ruta: string
  icono: LucideIcon
  color: Rotulador
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
  { etiqueta: 'Inicio', ruta: '/inicio', icono: House, color: 'azul', roles: ['estudiante', 'docente'] },
  { etiqueta: 'Cursos', ruta: '/cursos', icono: BookOpen, color: 'violeta', roles: ['estudiante', 'docente'], panel: 'cursos' },
  { etiqueta: 'Calendario', ruta: '/calendario', icono: Calendar, color: 'cian', roles: ['estudiante', 'docente'] },
  { etiqueta: 'Clases', ruta: '/clases', icono: Video, color: 'coral', roles: ['estudiante', 'docente'] },
  { etiqueta: 'Mensajes', ruta: '/mensajes', icono: MessageSquare, color: 'magenta', roles: ['estudiante', 'docente'] },
  { etiqueta: 'Mis certificados', ruta: '/certificados', icono: Award, color: 'ambar', roles: ['estudiante'] },
  { etiqueta: 'Reportes', ruta: '/reportes', icono: ChartColumn, color: 'menta', roles: ['docente'] },
]

export function NavegacionPrincipal() {
  const { rol } = useRol()
  /*
    El punto rojo sobre "Clases". Es lo que hace que una llamada aparezca sola
    en la pantalla de quien la esta esperando, en vez de tener que avisar por
    fuera de la plataforma de que ya se puede entrar.
  */
  const { enVivo } = usePortal()
  const { pathname } = useLocation()
  const [abierto, setAbierto] = useState<string | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  /*
    La barra scrollea en horizontal cuando no caben las secciones, y ese
    overflow recorta cualquier panel absoluto que cuelgue de ella. Por eso el
    desplegable se posiciona fijo: medimos el boton al abrirlo y lo anclamos
    debajo, fuera del alcance del recorte.
  */
  const [ancla, setAncla] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => setAbierto(null), [pathname])

  useEffect(() => {
    if (!abierto) return
    function medir() {
      const caja = boton.current?.getBoundingClientRect()
      if (!caja) return
      const ancho = Math.min(560, window.innerWidth - 24)
      setAncla({
        top: caja.bottom,
        left: Math.max(12, Math.min(caja.left, window.innerWidth - ancho - 12)),
      })
    }
    medir()
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [abierto])

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
      className="sticky top-13 z-20 border-b border-regla bg-superficie/95 shadow-[0_1px_0_rgba(11,24,51,0.03)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1500px] items-stretch gap-0.5 overflow-x-auto px-3 sm:px-6">
        {visibles.map((seccion) => {
          const Icono = seccion.icono
          const activa = pathname.startsWith(seccion.ruta)
          const etiqueta = rol === 'estudiante' && seccion.ruta === '/cursos'
            ? 'Mis cursos'
            : seccion.etiqueta

          const clases = cn(
            'group relative flex items-center gap-2 px-2.5 py-2.5 text-[13.5px] font-medium transition-colors',
            'after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-t-full after:transition-colors',
            activa
              ? 'font-semibold text-tinta after:bg-pizarra'
              : 'text-tinta-media after:bg-transparent hover:text-tinta hover:after:bg-regla-fuerte',
          )

          /* La pastilla de color solo se enciende en la seccion abierta o
             cuando el raton pasa: seis pastillas encendidas a la vez serian
             seis cosas pidiendo atencion y ninguna la conseguiria. */
          const pastilla = cn(
            'flex h-7 w-7 items-center justify-center rounded-xs transition-all duration-200',
            activa
              ? cn(fondoRotulador[seccion.color], textoRotulador[seccion.color])
              : cn(
                  'bg-transparent text-tinta-suave group-hover:scale-105',
                  fondoRotuladorHover[seccion.color],
                  textoRotuladorHover[seccion.color],
                ),
          )

          if (seccion.panel) {
            const esteAbierto = abierto === seccion.panel
            return (
              <div key={seccion.ruta} className="flex">
                <button
                  ref={boton}
                  onClick={() =>
                    setAbierto(esteAbierto ? null : seccion.panel!)
                  }
                  aria-expanded={esteAbierto}
                  className={clases}
                >
                  <span className={pastilla}>
                    <Icono size={15} strokeWidth={1.75} />
                  </span>
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
                {esteAbierto && ancla && <PanelCursos ancla={ancla} />}
              </div>
            )
          }

          return (
            <NavLink key={seccion.ruta} to={seccion.ruta} className={clases}>
              <span className={pastilla}>
                <Icono size={15} strokeWidth={1.75} />
              </span>
              {etiqueta}
              {seccion.ruta === '/clases' && enVivo.length > 0 && (
                <span
                  title={
                    enVivo.length === 1
                      ? `${enVivo[0].cursoCodigo} esta en vivo`
                      : `${enVivo.length} clases en vivo`
                  }
                  className="ml-0.5 inline-flex items-center gap-1 rounded-xs border border-correccion/30 bg-correccion-tenue px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-correccion"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-correccion" />
                  {enVivo.length > 1 ? enVivo.length : 'En vivo'}
                </span>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

function PanelCursos({ ancla }: { ancla: { top: number; left: number } }) {
  const { cursos, cargando } = usePortal()

  return (
    <div
      style={{ top: ancla.top, left: ancla.left }}
      className="fixed z-30 w-[min(560px,calc(100vw-24px))] border border-regla bg-superficie shadow-[0_12px_28px_-12px_rgba(20,23,26,0.28)] rounded-md"
    >
      <div className="grid grid-cols-[1fr_200px] max-sm:grid-cols-1">
        <div className="border-r border-regla p-4 max-sm:border-b max-sm:border-r-0">
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

