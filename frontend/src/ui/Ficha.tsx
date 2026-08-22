import type { ReactNode } from 'react'
import { cn } from './cn'

/*
  La jerarquia la dan las reglas de 1px y el espaciado, no las sombras.
  Solo las superficies flotantes (menus, dialogos) llevan sombra.
*/
export function Ficha({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'rounded-md border border-regla bg-superficie transition-[border-color,box-shadow,transform] duration-200 ease-out',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function FichaCabecera({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string
  descripcion?: string
  accion?: ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-regla px-5 py-3.5">
      <div>
        <h2 className="font-display text-[15px] font-semibold tracking-tight text-tinta">
          {titulo}
        </h2>
        {descripcion && (
          <p className="mt-0.5 text-[13px] text-tinta-media">{descripcion}</p>
        )}
      </div>
      {accion}
    </header>
  )
}
