import type { ReactNode } from 'react'
import { cn } from './cn'

/*
  Pastillas de estado. Los cinco tonos originales se quedan con su significado
  intacto -aprobado, aviso, correccion, info, neutro- y se suman los que hacian
  falta para hablar de dinero y de documentos sin robarle el verde a "aprobado"
  ni el rojo a "hay un problema".
*/

type Tono =
  | 'neutro'
  | 'aprobado'
  | 'aviso'
  | 'correccion'
  | 'info'
  | 'dinero'
  | 'documento'
  | 'violeta'

const tonos: Record<Tono, string> = {
  neutro: 'bg-lienzo text-tinta-media border-regla-fuerte',
  aprobado: 'bg-rotulador-azul-tenue text-pizarra border-rotulador-azul-borde',
  aviso: 'bg-rotulador-ambar-tenue text-aviso border-rotulador-ambar-borde',
  correccion:
    'bg-rotulador-coral-tenue text-correccion border-rotulador-coral-borde',
  info: 'bg-rotulador-cian-tenue text-rotulador-cian border-rotulador-cian-borde',
  dinero:
    'bg-rotulador-menta-tenue text-rotulador-menta border-rotulador-menta-borde',
  documento:
    'bg-rotulador-ambar-tenue text-rotulador-ambar border-rotulador-ambar-borde',
  violeta:
    'bg-rotulador-violeta-tenue text-rotulador-violeta border-rotulador-violeta-borde',
}

export function Etiqueta({
  tono = 'neutro',
  icono,
  children,
}: {
  tono?: Tono
  icono?: ReactNode
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'etiqueta-dato inline-flex items-center gap-1 whitespace-nowrap rounded-xs border px-1.5 py-0.5',
        tonos[tono],
      )}
    >
      {icono}
      {children}
    </span>
  )
}
