import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro'
type Tamano = 'sm' | 'md' | 'lg'

const variantes: Record<Variante, string> = {
  primario:
    'bg-pizarra text-white border border-pizarra hover:bg-pizarra-fondo hover:border-pizarra-fondo',
  secundario:
    'bg-superficie text-tinta border border-regla-fuerte hover:bg-lienzo hover:border-tinta-suave',
  fantasma:
    'bg-transparent text-tinta-media border border-transparent hover:bg-pizarra-tenue hover:text-pizarra',
  peligro:
    'bg-superficie text-correccion border border-correccion/40 hover:bg-correccion-tenue',
}

const tamanos: Record<Tamano, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  tamano?: Tamano
  iconoIzq?: ReactNode
  iconoDer?: ReactNode
  ancho?: boolean
}

export function Boton({
  variante = 'secundario',
  tamano = 'md',
  iconoIzq,
  iconoDer,
  ancho,
  className,
  children,
  ...resto
}: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:opacity-45',
        variantes[variante],
        tamanos[tamano],
        ancho && 'w-full',
        className,
      )}
      {...resto}
    >
      {iconoIzq}
      {children}
      {iconoDer}
    </button>
  )
}
