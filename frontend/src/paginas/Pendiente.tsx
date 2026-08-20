import type { LucideIcon } from 'lucide-react'
import { Ficha } from '../ui/Ficha'
import { EstadoVacio } from '../ui/EstadoVacio'

export function Pendiente({
  titulo,
  icono,
  texto,
}: {
  titulo: string
  icono: LucideIcon
  texto: string
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-tinta">
          {titulo}
        </h1>
      </header>
      <Ficha>
        <EstadoVacio icono={icono} titulo="Módulo por construir" texto={texto} />
      </Ficha>
    </div>
  )
}
