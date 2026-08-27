import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from './cn'
import {
  barraRotulador,
  fondoRotulador,
  textoRotulador,
  textoRotuladorHover,
  type Rotulador,
} from './rotulador'

/*
  El azulejo: un atajo grande, con icono de color y una franja arriba. Es lo
  que convierte una pantalla de inicio en un tablero de mandos en vez de una
  lista de enlaces subrayados.

  Se usa para acciones que se repiten todos los dias -cobrar, imprimir,
  inscribir-, nunca para navegacion secundaria: doce azulejos son un tablero,
  cuarenta son un buscador con pasos extra.
*/

type Props = {
  icono: LucideIcon
  titulo: string
  pie?: string
  color?: Rotulador
  ruta?: string
  alPulsar?: () => void
  desactivado?: boolean
}

export function Azulejo({
  icono: Icono,
  titulo,
  pie,
  color = 'azul',
  ruta,
  alPulsar,
  desactivado,
}: Props) {
  const clases = cn(
    'tarjeta-viva group relative flex min-h-[104px] w-full flex-col items-start gap-2.5',
    'overflow-hidden rounded-md border border-regla bg-superficie px-4 pb-3.5 pt-4 text-left shadow-apoyo',
    desactivado && 'pointer-events-none opacity-50',
  )

  const contenido = (
    <>
      <span
        className={cn(
          'absolute inset-x-0 top-0 h-[3px] transition-opacity',
          barraRotulador[color],
        )}
      />
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-sm transition-transform duration-200 group-hover:scale-105',
          fondoRotulador[color],
          textoRotulador[color],
        )}
      >
        <Icono size={20} strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block text-[13.5px] font-semibold leading-snug text-tinta transition-colors',
            textoRotuladorHover[color],
          )}
        >
          {titulo}
        </span>
        {pie && (
          <span className="mt-0.5 block text-[12px] leading-snug text-tinta-suave">
            {pie}
          </span>
        )}
      </span>
    </>
  )

  if (ruta && !desactivado) {
    return (
      <Link to={ruta} className={clases}>
        {contenido}
      </Link>
    )
  }
  return (
    <button type="button" onClick={alPulsar} disabled={desactivado} className={clases}>
      {contenido}
    </button>
  )
}

/* La rejilla en la que viven. Cuatro por fila en pantalla ancha, dos en movil. */
export function RejillaAzulejos({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  )
}
