import { cn } from './cn'

/*
  Marca provisional de DR360TRAINING: un libro reglado.
  Cuando exista el logo real se sustituye solo este componente.

  El nombre va en dos pesos y no en uno: DR360 es lo que la gente dice en voz
  alta, TRAINING es la coletilla. Con trece letras del mismo peso el ojo no
  sabe donde agarrarse.
*/
export function Marca({
  tono = 'claro',
  className,
}: {
  tono?: 'claro' | 'oscuro'
  className?: string
}) {
  const color = tono === 'claro' ? '#ffffff' : 'var(--color-tinta)'
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <rect
          x="1.5"
          y="1.5"
          width="17"
          height="17"
          stroke={color}
          strokeWidth="1.6"
          fill="none"
        />
        <path
          d="M5 7h10M5 10h10M5 13h6"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="square"
        />
      </svg>
      <span
        className="font-display text-[17px] font-bold tracking-[-0.02em]"
        style={{ color }}
      >
        DR360<span className="font-medium opacity-65">TRAINING</span>
      </span>
    </span>
  )
}
