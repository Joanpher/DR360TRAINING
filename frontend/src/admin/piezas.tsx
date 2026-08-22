import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Etiqueta } from '../ui/Etiqueta'
import { cn } from '../ui/cn'
import { nombreRolInstitucional } from '../app/rol'
import type { EstadoCurso } from './catalogo'
import type { EstadoCargo, EstadoInscripcion } from './inscripciones'
import { nombreEstadoCargo, nombreEstadoInscripcion } from './inscripciones'
import type { EstadoInvitacion } from './datos'
import type { EstadoMembresia, RolInstitucional } from './personas'

/*
  Piezas que se repiten en todas las pantallas del panel. Viven juntas porque
  su valor esta en ser identicas en los diez sitios donde aparecen: si el
  encabezado de "Cursos" y el de "Programas" se dibujan distinto, el panel deja
  de leerse como una sola herramienta.
*/

export function EncabezadoPagina({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string
  descripcion?: string
  accion?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-tinta">
          {titulo}
        </h1>
        {descripcion && (
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-tinta-media">
            {descripcion}
          </p>
        )}
      </div>
      {accion}
    </header>
  )
}

/* Fila de filtros sobre una tabla: siempre por encima y siempre igual. */
export function BarraFiltros({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-regla px-4 py-3">
      {children}
    </div>
  )
}

export function FiltroSelect({
  etiqueta,
  valor,
  alCambiar,
  opciones,
}: {
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
  opciones: Array<{ valor: string; texto: string }>
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="etiqueta-dato text-[11.5px] font-semibold text-tinta">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className="h-9 rounded-sm border border-regla-fuerte bg-superficie px-2 text-[13px] text-tinta focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15"
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  )
}

/*
  Bloque de cifras: un solo panel reglado en vez de cuatro tarjetas sueltas.
  Cuatro tarjetas con sombra compiten entre si; cuatro columnas separadas por
  una regla de 1px se leen de un vistazo como lo que son, una misma medida
  partida en cuatro.
*/
export function Cifras({
  datos,
}: {
  datos: Array<{ etiqueta: string; valor: string; pie: string; alerta?: boolean }>
}) {
  return (
    <dl className="grid grid-cols-2 divide-regla md:grid-cols-4 md:divide-x">
      {datos.map((dato, i) => (
        <div
          key={dato.etiqueta}
          className={cn('px-5 py-4', i < 2 && 'border-b border-regla md:border-b-0')}
        >
          <dt className="etiqueta-dato text-tinta-suave">{dato.etiqueta}</dt>
          <dd
            className={cn(
              'mt-2 font-dato text-[28px] font-medium leading-none tabular-nums',
              dato.alerta ? 'text-correccion' : 'text-tinta',
            )}
          >
            {dato.valor}
          </dd>
          <p className="mt-1.5 text-[12px] text-tinta-suave">{dato.pie}</p>
        </div>
      ))}
    </dl>
  )
}

/* --- Etiquetas de estado ---------------------------------------------- */

const tonoMembresia = {
  activa: 'aprobado',
  invitada: 'aviso',
  suspendida: 'correccion',
  retirada: 'neutro',
  egresada: 'info',
} as const

const textoMembresia: Record<EstadoMembresia, string> = {
  activa: 'Activa',
  invitada: 'Invitada',
  suspendida: 'Suspendida',
  retirada: 'Retirada',
  egresada: 'Egresada',
}

export function EstadoDeMembresia({ estado }: { estado: EstadoMembresia }) {
  return <Etiqueta tono={tonoMembresia[estado]}>{textoMembresia[estado]}</Etiqueta>
}

const tonoCurso = {
  promocion: 'aviso',
  activo: 'aprobado',
  graduado: 'neutro',
} as const

const textoCurso: Record<EstadoCurso, string> = {
  promocion: 'En promoción',
  activo: 'Activo',
  graduado: 'Graduado',
}

export function EstadoDeCurso({ estado }: { estado: EstadoCurso }) {
  return <Etiqueta tono={tonoCurso[estado]}>{textoCurso[estado]}</Etiqueta>
}

/*
  Una inscripcion tiene cinco estados y solo dos importan de un vistazo: la que
  esta cursando y la que se fue. Las demas van en gris porque son finales -ya no
  hay nada que hacer con ellas- y pintarlas de colores las haria competir con las
  filas que si piden atencion.
*/
const tonoInscripcion = {
  activa: 'aprobado',
  preinscrita: 'aviso',
  completada: 'info',
  retirada: 'correccion',
  cancelada: 'neutro',
} as const

export function EstadoDeInscripcion({ estado }: { estado: EstadoInscripcion }) {
  return (
    <Etiqueta tono={tonoInscripcion[estado]}>{nombreEstadoInscripcion[estado]}</Etiqueta>
  )
}

const tonoCargo = {
  pagado: 'aprobado',
  pendiente: 'aviso',
  condonado: 'info',
  anulado: 'neutro',
} as const

export function EstadoDeCargo({ estado }: { estado: EstadoCargo }) {
  return <Etiqueta tono={tonoCargo[estado]}>{nombreEstadoCargo[estado]}</Etiqueta>
}

const tonoInvitacion = {
  pendiente: 'aviso',
  aceptada: 'aprobado',
  revocada: 'neutro',
  expirada: 'correccion',
} as const

const textoInvitacion: Record<EstadoInvitacion, string> = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  revocada: 'Revocada',
  expirada: 'Expirada',
}

export function EstadoDeInvitacion({ estado }: { estado: EstadoInvitacion }) {
  return <Etiqueta tono={tonoInvitacion[estado]}>{textoInvitacion[estado]}</Etiqueta>
}

/*
  Los roles se dibujan en texto plano y no como etiquetas de color: una persona
  puede tener tres a la vez y tres pastillas de colores en una celda convierten
  la tabla en un semaforo. El unico que se distingue es propietario, porque es
  el que no se puede quitar.
*/
export function RolesDePersona({ roles }: { roles: RolInstitucional[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {roles.map((rol) => (
        <span
          key={rol}
          className={cn(
            'etiqueta-dato border px-1.5 py-0.5 rounded-xs',
            rol === 'propietario'
              ? 'border-pizarra/25 bg-pizarra-tenue text-pizarra'
              : 'border-regla bg-lienzo text-tinta-media',
          )}
        >
          {nombreRolInstitucional[rol] ?? rol}
        </span>
      ))}
    </span>
  )
}

/* --- Menú de fila ------------------------------------------------------ */

export type AccionFila = {
  etiqueta: string
  alElegir: () => void
  peligrosa?: boolean
}

export function MenuFila({ acciones }: { acciones: AccionFila[] }) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function fuera(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false)
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  return (
    <div ref={contenedor} className="relative flex justify-end">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label="Acciones"
        aria-expanded={abierto}
        className="flex h-7 w-7 items-center justify-center rounded-sm text-tinta-suave hover:bg-lienzo hover:text-tinta"
      >
        <MoreHorizontal size={16} strokeWidth={1.75} />
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-regla bg-superficie py-1 shadow-[0_12px_28px_-12px_rgba(20,23,26,0.3)]">
          {acciones.map((accion) => (
            <button
              key={accion.etiqueta}
              onClick={() => {
                setAbierto(false)
                accion.alElegir()
              }}
              className={cn(
                'block w-full px-3 py-2 text-left text-[13px]',
                accion.peligrosa
                  ? 'text-correccion hover:bg-correccion-tenue'
                  : 'text-tinta-media hover:bg-lienzo hover:text-tinta',
              )}
            >
              {accion.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* Pie de tabla: cuántas filas hay de cuántas. Siempre visible, nunca oculto. */
export function PieDeTabla({
  mostradas,
  total,
  sustantivo,
}: {
  mostradas: number
  total: number
  sustantivo: string
}) {
  return (
    <div className="flex items-center justify-between border-t border-regla px-5 py-2.5">
      <p className="font-dato text-[11px] text-tinta-suave">
        {mostradas === total
          ? `${total} ${sustantivo}`
          : `${mostradas} de ${total} ${sustantivo}`}
      </p>
    </div>
  )
}

/* --- Aviso en línea ---------------------------------------------------- */

const tonosNota = {
  error: 'border-correccion/30 bg-correccion-tenue text-correccion',
  exito: 'border-pizarra/25 bg-pizarra-tenue text-pizarra',
  aviso: 'border-aviso/25 bg-aviso-tenue text-tinta',
} as const

/*
  Un bloque, no un toast que se va solo. Cuando algo falla al guardar, el
  mensaje tiene que seguir ahí mientras la persona corrige el campo.
*/
export function Nota({
  tono,
  children,
}: {
  tono: keyof typeof tonosNota
  children: ReactNode
}) {
  return (
    <p
      role={tono === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-sm border px-3 py-2 text-[13px] leading-relaxed',
        tonosNota[tono],
      )}
    >
      {children}
    </p>
  )
}

/* Mientras llegan los datos: la forma de la página, no una rueda girando. */
export function Esqueleto({ filas = 3 }: { filas?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-md border border-regla bg-lienzo" />
      ))}
    </div>
  )
}
