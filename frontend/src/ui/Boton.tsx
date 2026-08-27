import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

/*
  Los botones del sistema. La regla es que el color diga que pasa al pulsar y
  no solo que el elemento se puede pulsar: azul lo que continua, verde lo que
  cobra o confirma dinero, ambar lo que emite un documento, rojo lo que
  destruye. Con un solo azul para todo, la fila de acciones de una tabla se
  leia como una hilera de rectangulos iguales.

  Las variantes con relleno llevan un degradado corto y una sombra a juego con
  su propio color. Es lo que separa un boton "encendido" de un rectangulo de
  color plano.
*/

type Variante =
  | 'primario'
  | 'secundario'
  | 'fantasma'
  | 'peligro'
  | 'exito'
  | 'emitir'
  | 'suave'
type Tamano = 'sm' | 'md' | 'lg'

const variantes: Record<Variante, string> = {
  primario:
    'border-transparent bg-linear-to-b from-pizarra to-[#0046d4] text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_16px_-8px_rgba(0,85,252,0.9)] hover:from-[#0d61ff] hover:to-pizarra hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_22px_-8px_rgba(0,85,252,0.85)]',
  exito:
    'border-transparent bg-linear-to-b from-[#16a663] to-rotulador-menta text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_16px_-8px_rgba(18,138,82,0.85)] hover:from-[#1cb96f] hover:to-[#0f7546]',
  emitir:
    'border-transparent bg-linear-to-b from-[#f0a318] to-[#d98407] text-white shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_6px_16px_-8px_rgba(176,114,6,0.85)] hover:from-[#f6b234] hover:to-[#c47706]',
  secundario:
    'border-regla-fuerte bg-superficie text-tinta shadow-[0_1px_2px_rgba(11,24,51,0.04)] hover:border-pizarra/45 hover:bg-pizarra-tenue hover:text-pizarra',
  suave:
    'border-transparent bg-pizarra-tenue text-pizarra hover:bg-[#d7e6ff]',
  fantasma:
    'border-transparent bg-transparent text-tinta-media hover:bg-pizarra-tenue hover:text-pizarra',
  peligro:
    'border-correccion/35 bg-correccion-tenue text-correccion hover:border-correccion hover:bg-correccion hover:text-white',
}

const tamanos: Record<Tamano, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-sm',
  md: 'h-10 px-4 text-sm gap-2 rounded-sm',
  lg: 'h-11 px-5 text-sm gap-2 rounded-md',
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
        'inline-flex items-center justify-center border font-semibold tracking-[-0.005em]',
        'transition-all duration-150 ease-out active:scale-[0.98]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none',
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
