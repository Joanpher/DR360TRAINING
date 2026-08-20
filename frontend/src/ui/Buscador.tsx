import { Search } from 'lucide-react'
import { cn } from './cn'

export function Buscador({
  valor,
  alCambiar,
  placeholder = 'Buscar',
  className,
}: {
  valor: string
  alCambiar: (valor: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search
        size={15}
        strokeWidth={1.5}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave"
      />
      <input
        type="search"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-sm border border-regla-fuerte bg-superficie pl-9 pr-3 text-[13px] text-tinta placeholder:text-tinta-suave focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15"
      />
    </div>
  )
}
