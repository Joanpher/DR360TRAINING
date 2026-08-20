import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/* Una pantalla vacia es una invitacion a actuar, no un mensaje de disculpa. */
export function EstadoVacio({
  icono: Icono,
  titulo,
  texto,
  accion,
}: {
  icono: LucideIcon
  titulo: string
  texto: string
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center border border-regla-fuerte bg-lienzo rounded-sm">
        <Icono size={20} strokeWidth={1.5} className="text-tinta-suave" />
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
