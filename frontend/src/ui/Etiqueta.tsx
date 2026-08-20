import type { ReactNode } from 'react'
import { cn } from './cn'

type Tono = 'neutro' | 'aprobado' | 'aviso' | 'correccion' | 'info'

const tonos: Record<Tono, string> = {
  neutro: 'bg-lienzo text-tinta-media border-regla',
  aprobado: 'bg-pizarra-tenue text-pizarra border-pizarra/25',
  aviso: 'bg-aviso-tenue text-aviso border-aviso/25',
  correccion: 'bg-correccion-tenue text-correccion border-correccion/25',
  info: 'bg-superficie text-tinta-media border-regla-fuerte',
}

export function Etiqueta({
  tono = 'neutro',
  icono,
  children,
}: {
  tono?: Tono
  icono?: ReactNode
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'etiqueta-dato inline-flex items-center gap-1 border px-1.5 py-0.5 rounded-xs whitespace-nowrap',
        tonos[tono],
      )}
    >
      {icono}
      {children}
    </span>
  )
}
