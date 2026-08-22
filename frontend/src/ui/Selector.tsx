import { useId, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'

type Opcion = { valor: string; texto: string }

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  etiqueta: string
  opciones: Opcion[]
  ayuda?: string
  error?: string
  vacio?: string
}

export function Selector({
  etiqueta,
  opciones,
  ayuda,
  error,
  vacio,
  className,
  ...resto
}: Props) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="etiqueta-dato text-[11.5px] font-semibold text-tinta">
        {etiqueta}
      </label>
      <div className="relative">
        <select
          id={id}
          className={cn(
            'h-11 w-full appearance-none rounded-sm border bg-superficie pl-3 pr-9 text-sm text-tinta',
            'focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15',
            error ? 'border-correccion' : 'border-regla-fuerte',
            className,
          )}
          {...resto}
        >
          {vacio && <option value="">{vacio}</option>}
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          strokeWidth={1.5}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tinta-suave"
        />
      </div>
      {(ayuda || error) && (
        <p className={cn('text-[12px]', error ? 'text-correccion' : 'text-tinta-suave')}>
          {error ?? ayuda}
        </p>
      )}
    </div>
  )
}
