import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Building2, ChevronDown, LogOut, Search, UserRound } from 'lucide-react'
import { Marca } from '../ui/Marca'
import { nombreRol, useRol } from '../app/rol'
import { iniciales, useSesion } from '../app/sesion'

/*
  Banda de identidad: quién eres y dónde estás.
  Nunca cambia de contenido al navegar; por eso va separada de la navegación.

  En una plataforma multi-institución el "dónde" no es decorativo: es la
  respuesta a de quién son los datos que hay debajo. Por eso las siglas van
  fijas junto a la marca y no escondidas en un menú.

  El rol que aparece bajo el nombre se lee, no se elige: es el que trae la
  membresía de esta institución y el que decide en qué panel se está.
*/
export function BarraIdentidad({
  inicio = '/inicio',
  buscar = 'Buscar cursos, tareas o personas',
}: {
  inicio?: string
  buscar?: string
}) {
  const { rol } = useRol()
  const { usuario, institucion, instituciones, salir } = useSesion()
  const [menu, setMenu] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setMenu(false)
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenu(false)
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [])

  return (
    <header className="sticky top-0 z-30 bg-pizarra-fondo">
      <div className="mx-auto flex h-13 max-w-[1500px] items-center gap-5 px-6">
        <Link to={inicio} className="rounded-xs">
          <Marca tono="claro" />
        </Link>

        <span className="h-5 w-px bg-white/20" aria-hidden="true" />

        <span className="etiqueta-dato text-white/70" title={institucion?.nombre}>
          {institucion?.siglas ?? institucion?.nombre ?? '—'}
        </span>

        {rol === 'admin' && (
          <span className="etiqueta-dato hidden border border-pizarra-vivo/40 px-1.5 py-0.5 text-pizarra-vivo sm:inline-block">
            Administración
          </span>
        )}

        <div className="relative ml-4 hidden max-w-md flex-1 md:block">
          <Search
            size={15}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45"
          />
          <input
            type="search"
            placeholder={buscar}
            className="h-8 w-full rounded-sm border border-white/15 bg-white/8 pl-9 pr-14 text-[13px] text-white placeholder:text-white/45 focus:border-pizarra-vivo focus:bg-white/12 focus:outline-none"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 font-dato text-[11px] text-white/40 lg:block">
            Ctrl K
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            aria-label="Notificaciones"
            className="relative flex h-8 w-8 items-center justify-center rounded-sm text-white/75 hover:bg-white/10 hover:text-white"
          >
            <Bell size={17} strokeWidth={1.5} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 bg-pizarra-vivo" />
          </button>

          <div ref={contenedor} className="relative">
            <button
              onClick={() => setMenu((v) => !v)}
              aria-expanded={menu}
              className="flex items-center gap-2 rounded-sm py-1 pl-1 pr-2 hover:bg-white/10"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-xs bg-pizarra-vivo font-dato text-[12px] font-semibold text-pizarra-fondo">
                {iniciales(usuario?.nombreCompleto ?? '')}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-[13px] font-medium leading-tight text-white">
                  {usuario?.nombreCompleto ?? ''}
                </span>
                <span className="block font-dato text-[11px] leading-tight text-white/50">
                  {nombreRol[rol]}
                </span>
              </span>
              <ChevronDown size={14} strokeWidth={1.5} className="text-white/50" />
            </button>

            {menu && (
              <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-md border border-regla bg-superficie py-1 shadow-[0_12px_28px_-12px_rgba(20,23,26,0.35)]">
                <div className="border-b border-regla px-3 py-2">
                  <p className="truncate text-[13px] font-medium text-tinta">
                    {usuario?.nombreCompleto}
                  </p>
                  <p className="truncate font-dato text-[11px] text-tinta-suave">
                    {usuario?.correo}
                  </p>
                </div>

                <MenuEnlace to="/perfil" icono={<UserRound size={14} strokeWidth={1.5} />}>
                  Mi perfil
                </MenuEnlace>

                {instituciones.length > 1 && (
                  <MenuEnlace
                    to="/elegir-institucion"
                    icono={<Building2 size={14} strokeWidth={1.5} />}
                  >
                    Cambiar de institución
                  </MenuEnlace>
                )}

                <button
                  onClick={() => void salir()}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-correccion hover:bg-correccion-tenue"
                >
                  <LogOut size={14} strokeWidth={1.5} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function MenuEnlace({
  to,
  icono,
  children,
}: {
  to: string
  icono: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-3 py-2 text-[13px] text-tinta-media hover:bg-lienzo hover:text-tinta"
    >
      {icono}
      {children}
    </Link>
  )
}
