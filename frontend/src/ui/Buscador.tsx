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
        className="h-10 w-full rounded-sm border border-regla-fuerte bg-superficie pl-9 pr-3 text-[13px] text-tinta shadow-[0_1px_2px_rgba(11,24,51,0.04)_inset] placeholder:text-tinta-suave hover:border-tinta-suave focus:border-pizarra focus:outline-none focus:ring-[3px] focus:ring-pizarra/18"
      />
    </div>
  )
}
