import { NavLink } from 'react-router-dom'
import {
  BookOpen,
  Award,
  Building2,
  LayoutGrid,
  MapPin,
  ScrollText,
  ShoppingCart,
  Send,
  Tags,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../ui/cn'
import {
  fondoRotulador,
  textoRotulador,
  type Rotulador,
} from '../ui/rotulador'
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

type Entrada = {
  etiqueta: string
  ruta: string
  icono: LucideIcon
  color: Rotulador
  fin?: boolean
}
type Grupo = { titulo: string; entradas: Entrada[] }

/*
  Cada entrada lleva su color y no lo hereda del grupo: el color es de la
  pantalla, no de la seccion, y asi Certificados se reconoce por su ambar este
  donde este -en la barra lateral, en su encabezado y en sus botones-.
*/
const grupos: Grupo[] = [
  {
    titulo: 'Panel',
    entradas: [
      { etiqueta: 'Resumen', ruta: '/admin', icono: LayoutGrid, color: 'azul', fin: true },
    ],
  },
  {
    titulo: 'Catálogo',
    entradas: [
      { etiqueta: 'Cursos', ruta: '/admin/cursos', icono: BookOpen, color: 'violeta' },
      { etiqueta: 'Categorías', ruta: '/admin/categorias', icono: Tags, color: 'cian' },
    ],
  },
  {
    titulo: 'Alumnado',
    entradas: [
      {
        etiqueta: 'Inscripciones',
        ruta: '/admin/inscripciones',
        icono: UserRoundCheck,
        color: 'menta',
      },
      { etiqueta: 'Usuarios', ruta: '/admin/personas', icono: Users, color: 'azul' },
      { etiqueta: 'Invitaciones', ruta: '/admin/invitaciones', icono: Send, color: 'magenta' },
    ],
  },
  {
    titulo: 'Operaciones',
    entradas: [
      { etiqueta: 'Caja / POS', ruta: '/admin/pos', icono: ShoppingCart, color: 'menta' },
      { etiqueta: 'Certificados', ruta: '/admin/certificados', icono: Award, color: 'ambar' },
    ],
  },
  {
    titulo: 'Institución',
    entradas: [
      { etiqueta: 'Datos y marca', ruta: '/admin/institucion', icono: Building2, color: 'azul' },
      { etiqueta: 'Sedes', ruta: '/admin/sedes', icono: MapPin, color: 'coral' },
      { etiqueta: 'Bitácora', ruta: '/admin/bitacora', icono: ScrollText, color: 'violeta' },
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
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-linear-to-br from-pizarra to-pizarra-fondo font-dato text-[12px] font-semibold text-white shadow-[0_4px_10px_-4px_rgba(0,85,252,0.7)]">
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
                            'group relative flex items-center gap-2.5 rounded-sm py-[5px] pl-1.5 pr-2 text-[13.5px] transition-colors',
                            'before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-r-full before:transition-colors',
                            isActive
                              ? 'bg-pizarra-tenue font-semibold text-tinta before:bg-pizarra'
                              : 'text-tinta-media before:bg-transparent hover:bg-lienzo hover:text-tinta',
                          )
                        }
                      >
                        {/*
                          El icono va dentro de una pastilla de su color: en una
                          lista de trece entradas es lo primero que se busca, y
                          trece iconos grises del mismo tono no se distinguen.
                        */}
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-xs transition-transform duration-200 group-hover:scale-105',
                            fondoRotulador[entrada.color],
                            textoRotulador[entrada.color],
                          )}
                        >
                          <Icono size={15} strokeWidth={1.75} />
                        </span>
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
