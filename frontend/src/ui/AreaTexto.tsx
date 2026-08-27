import { useId, type TextareaHTMLAttributes } from 'react'
import { cn } from './cn'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  etiqueta: string
  ayuda?: string
  error?: string
}

export function AreaTexto({ etiqueta, ayuda, error, className, ...resto }: Props) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="etiqueta-dato text-[11.5px] font-semibold text-tinta">
        {etiqueta}
      </label>
      <textarea
        id={id}
        rows={3}
        className={cn(
          'w-full resize-y rounded-sm border bg-superficie px-3 py-2.5 text-sm leading-relaxed text-tinta',
          'placeholder:text-tinta-suave hover:border-tinta-suave',
          'focus:border-pizarra focus:outline-none focus:ring-[3px] focus:ring-pizarra/18',
          error ? 'border-correccion' : 'border-regla-fuerte',
          className,
        )}
        {...resto}
      />
      {(ayuda || error) && (
        <p className={cn('text-[12px]', error ? 'text-correccion' : 'text-tinta-suave')}>
          {error ?? ayuda}
        </p>
      )}
    </div>
  )
}
