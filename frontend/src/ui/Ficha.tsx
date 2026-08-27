import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './cn'
import { fondoRotulador, textoRotulador, type Rotulador } from './rotulador'

/*
  La jerarquia sigue viniendo del espaciado y de las reglas de 1px, pero ahora
  la tarjeta se apoya en la pagina con una sombra muy corta en vez de flotar
  sobre nada. Sin ella, doce fichas blancas sobre un fondo casi blanco se leian
  como un unico bloque de texto.
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
      /*
        Sin overflow-hidden: dentro de una ficha viven las tablas, y de sus
        filas cuelga el menu de acciones en posicion absoluta. Recortar el
        contenido dejaria ese menu cortado por el borde de abajo. Las pocas
        fichas que si necesitan recortar -las que llevan una cabecera de color
        a sangre- lo piden en su className.
      */
      className={cn(
        'rounded-md border border-regla bg-superficie shadow-apoyo',
        'transition-[border-color,box-shadow,transform] duration-200 ease-out',
        className,
      )}
    >
      {children}
    </section>
  )
}

/*
  La cabecera admite un icono de color. No es decoracion: en una pantalla con
  cuatro fichas apiladas, el icono es lo que deja saltar a la que interesa sin
  leer los cuatro titulos.
*/
export function FichaCabecera({
  titulo,
  descripcion,
  icono: Icono,
  color = 'azul',
  accion,
}: {
  titulo: string
  descripcion?: string
  icono?: LucideIcon
  color?: Rotulador
  accion?: ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-regla bg-linear-to-b from-[#fbfdff] to-superficie px-5 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        {Icono && (
          <span
            className={cn(
              'mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-sm',
              fondoRotulador[color],
              textoRotulador[color],
            )}
          >
            <Icono size={16} strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-semibold tracking-tight text-tinta">
            {titulo}
          </h2>
          {descripcion && (
            <p className="mt-0.5 text-[13px] text-tinta-media">{descripcion}</p>
          )}
        </div>
      </div>
      {accion}
    </header>
  )
}
