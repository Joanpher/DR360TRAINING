import { cn } from './cn'

export function Marca({
  tono = 'claro',
  className,
}: {
  tono?: 'claro' | 'oscuro'
  className?: string
}) {
  const fuente = tono === 'claro'
    ? '/Logo-RD360-PNG-White.png'
    : '/Logo-RD360-PNG.png'

  return (
    <span className={cn('inline-flex shrink-0 items-center', className)}>
      <img
        src={fuente}
        alt="DR360 Training"
        className="h-8 w-auto object-contain"
        decoding="async"
      />
    </span>
  )
}
