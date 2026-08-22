import { NavLink } from 'react-router-dom'
import {
  BookOpen,
  Building2,
  LayoutGrid,
  MapPin,
  ScrollText,
  Send,
  Tags,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../ui/cn'
import { useSesion } from '../app/sesion'
import { useConsulta } from '../datos/consulta'
import type { Curso } from './catalogo'

/*
  Barra lateral, no pestañas horizontales. La diferencia no es estetica: el
  trabajo de administrar son decenas de pantallas agrupadas por materia, y
  quien administra salta entre grupos todo el rato -crea un curso, le asigna un
  instructor, inscribe a alguien-. Una lista siempre visible deja ver el mapa
  completo; una barra horizontal obligaria a esconder la mitad en menus.

  El orden de los grupos es el orden en que se monta un centro: primero el
  catalogo -sin cursos no hay nada que vender-, luego quien entra en el, y al
  final la configuracion que casi nunca se toca.
*/

type Entrada = { etiqueta: string; ruta: string; icono: LucideIcon; fin?: boolean }
type Grupo = { titulo: string; entradas: Entrada[] }

const grupos: Grupo[] = [
  {
    titulo: 'Panel',
    entradas: [{ etiqueta: 'Resumen', ruta: '/admin', icono: LayoutGrid, fin: true }],
  },
  {
    titulo: 'Catálogo',
    entradas: [
      { etiqueta: 'Cursos', ruta: '/admin/cursos', icono: BookOpen },
      { etiqueta: 'Categorías', ruta: '/admin/categorias', icono: Tags },
    ],
  },
  {
    titulo: 'Alumnado',
    entradas: [
      { etiqueta: 'Inscripciones', ruta: '/admin/inscripciones', icono: UserRoundCheck },
      { etiqueta: 'Usuarios', ruta: '/admin/personas', icono: Users },
      { etiqueta: 'Invitaciones', ruta: '/admin/invitaciones', icono: Send },
    ],
  },
  {
    titulo: 'Institución',
    entradas: [
      { etiqueta: 'Datos y marca', ruta: '/admin/institucion', icono: Building2 },
      { etiqueta: 'Sedes', ruta: '/admin/sedes', icono: MapPin },
      { etiqueta: 'Bitácora', ruta: '/admin/bitacora', icono: ScrollText },
    ],
  },
]

export function NavegacionAdmin() {
  const { institucion } = useSesion()

  /*
    Cuantos cursos estan disponibles va aqui y no solo en su pantalla porque es
    contexto, no contenido: si el catalogo esta vacio no hay nada que inscribir
    ni que cobrar, y conviene tenerlo a la vista aunque se este editando otra
    cosa.
  */
  const { datos } = useConsulta<{ cursos: Curso[] }>('/catalogo/cursos')
  const disponibles = datos?.cursos.filter((c) => c.estado !== 'graduado').length

  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-regla bg-superficie lg:block">
      <div className="sticky top-13 flex h-[calc(100vh-3.25rem)] flex-col overflow-y-auto">
        {/*
          Encabezado de contexto: en una plataforma multi-institución, saber de
          quién son los datos que estás a punto de cambiar no es un detalle.
        */}
        <div className="border-b border-regla px-4 py-4">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xs bg-pizarra font-dato text-[12px] font-semibold text-white">
              {(institucion?.siglas ?? institucion?.nombre ?? '—').slice(0, 3)}
            </span>
            <div className="min-w-0">
              <p
                className="truncate text-[13px] font-semibold leading-tight text-tinta"
                title={institucion?.nombre}
              >
                {institucion?.nombre ?? '—'}
              </p>
              <p className="mt-0.5 font-dato text-[11px] text-tinta-suave">
                {disponibles === undefined
                  ? '—'
                  : `${disponibles} curso${disponibles === 1 ? '' : 's'} disponible${disponibles === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4">
          {grupos.map((grupo) => (
            <div key={grupo.titulo} className="mb-5 last:mb-0">
              <p className="etiqueta-dato mb-1.5 px-2 text-tinta-suave">
                {grupo.titulo}
              </p>
              <ul className="space-y-px">
                {grupo.entradas.map((entrada) => {
                  const Icono = entrada.icono
                  return (
                    <li key={entrada.ruta}>
                      <NavLink
                        to={entrada.ruta}
                        end={entrada.fin}
                        className={({ isActive }) =>
                          cn(
                            'relative flex items-center gap-2.5 rounded-sm px-2 py-[7px] text-[13.5px] transition-colors',
                            'before:absolute before:inset-y-1 before:-left-3 before:w-[2px] before:transition-colors',
                            isActive
                              ? 'bg-pizarra-tenue font-medium text-pizarra before:bg-pizarra'
                              : 'text-tinta-media before:bg-transparent hover:bg-lienzo hover:text-tinta',
                          )
                        }
                      >
                        <Icono size={16} strokeWidth={1.5} className="shrink-0" />
                        {entrada.etiqueta}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-regla px-4 py-3">
          <p className="text-[12px] leading-relaxed text-tinta-suave">
            Los cambios de esta sección afectan a toda la institución y quedan
            registrados en la bitácora.
          </p>
        </div>
      </div>
    </aside>
  )
}
