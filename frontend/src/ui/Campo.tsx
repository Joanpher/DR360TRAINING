import { useId, useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff, type LucideIcon } from 'lucide-react'
import { cn } from './cn'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string
  icono?: LucideIcon
  ayuda?: string
  error?: string
}

export function Campo({
  etiqueta,
  icono: Icono,
  ayuda,
  error,
  type = 'text',
  className,
  ...resto
}: Props) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const esClave = type === 'password'
  const tipoFinal = esClave && visible ? 'text' : type

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="etiqueta-dato text-tinta-media"
      >
        {etiqueta}
      </label>

      <div className="relative">
        {Icono && (
          <Icono
            size={16}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave"
          />
        )}
        <input
          id={id}
          type={tipoFinal}
          className={cn(
            'h-11 w-full rounded-sm border bg-superficie text-sm text-tinta',
            'placeholder:text-tinta-suave',
            'focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15',
            Icono ? 'pl-9' : 'pl-3',
            esClave ? 'pr-10' : 'pr-3',
            error ? 'border-correccion' : 'border-regla-fuerte',
            className,
          )}
          {...resto}
        />
        {esClave && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-xs text-tinta-suave hover:bg-lienzo hover:text-tinta"
          >
            {visible ? (
              <EyeOff size={16} strokeWidth={1.5} />
            ) : (
              <Eye size={16} strokeWidth={1.5} />
            )}
          </button>
        )}
      </div>

      {(ayuda || error) && (
        <p
          className={cn(
            'text-[12px]',
            error ? 'text-correccion' : 'text-tinta-suave',
          )}
        >
          {error ?? ayuda}
        </p>
      )}
    </div>
  )
}
