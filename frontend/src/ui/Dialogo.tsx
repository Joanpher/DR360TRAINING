import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from './cn'

/*
  Un dialogo, no un cajon lateral ni una pagina aparte. Crear un curso o invitar
  a alguien son actos cortos que ocurren mirando la lista a la que van a
  sumarse: sacar a la persona de esa lista para volver a traerla despues rompe
  el hilo de lo que estaba haciendo.

  Es de las poquisimas superficies con sombra del sistema: flota de verdad.
*/
export function Dialogo({
  abierto,
  alCerrar,
  titulo,
  descripcion,
  ancho = 'md',
  pie,
  children,
}: {
  abierto: boolean
  alCerrar: () => void
  titulo: string
  descripcion?: string
  ancho?: 'sm' | 'md' | 'lg'
  pie?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!abierto) return
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') alCerrar()
    }
    document.addEventListener('keydown', escape)
    // Sin esto la pagina de atras sigue haciendo scroll bajo el dialogo.
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', escape)
      document.body.style.overflow = previo
    }
  }, [abierto, alCerrar])

  if (!abierto) return null

  const anchos = {
    sm: 'max-w-[420px]',
    md: 'max-w-[560px]',
    lg: 'max-w-[760px]',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-tinta/35 px-4 py-10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) alCerrar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          'w-full rounded-md border border-regla bg-superficie shadow-[0_24px_60px_-20px_rgba(20,23,26,0.45)]',
          anchos[ancho],
        )}
      >
        <header className="flex items-start justify-between gap-6 border-b border-regla px-5 py-4">
          <div>
            <h2 className="font-display text-[17px] font-bold tracking-[-0.015em] text-tinta">
              {titulo}
            </h2>
            {descripcion && (
              <p className="mt-1 text-[13px] leading-relaxed text-tinta-media">
                {descripcion}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-tinta-suave hover:bg-lienzo hover:text-tinta"
          >
            <X size={17} strokeWidth={1.5} />
          </button>
        </header>

        <div className="px-5 py-5">{children}</div>

        {pie && (
          <footer className="flex items-center justify-end gap-2 border-t border-regla bg-lienzo px-5 py-3.5">
            {pie}
          </footer>
        )}
      </div>
    </div>
  )
}
