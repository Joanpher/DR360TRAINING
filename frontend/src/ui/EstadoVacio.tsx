import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'
import { fondoRotulador, textoRotulador, type Rotulador } from './rotulador'

/* Una pantalla vacia es una invitacion a actuar, no un mensaje de disculpa. */
export function EstadoVacio({
  icono: Icono,
  titulo,
  texto,
  color = 'azul',
  accion,
}: {
  icono: LucideIcon
  titulo: string
  texto: string
  color?: Rotulador
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className={cn(
          'mb-4 flex h-14 w-14 items-center justify-center rounded-md',
          fondoRotulador[color],
          textoRotulador[color],
        )}
      >
        <Icono size={24} strokeWidth={1.5} />
      </div>
      <h3 className="font-display text-[15px] font-semibold text-tinta">
        {titulo}
      </h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-tinta-media">
        {texto}
      </p>
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  )
}
