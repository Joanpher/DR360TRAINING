import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from './cn'

export function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  )
}

export function Encabezado({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-regla">{children}</tr>
    </thead>
  )
}

export function Th({
  className,
  children,
  ...resto
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'etiqueta-dato px-5 py-2.5 font-medium text-tinta-suave',
        className,
      )}
      {...resto}
    >
      {children}
    </th>
  )
}

export function Fila({
  children,
  onClick,
}: {
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-regla last:border-b-0',
        onClick && 'cursor-pointer hover:bg-lienzo',
      )}
    >
      {children}
    </tr>
  )
}

export function Td({
  className,
  children,
  ...resto
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-5 py-3 align-middle', className)} {...resto}>
      {children}
    </td>
  )
}

/* Celda de dato: codigos, fechas, notas y conteos siempre en monoespaciada. */
export function TdDato({
  className,
  children,
  ...resto
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <Td
      className={cn('font-dato text-[13px] tabular-nums', className)}
      {...resto}
    >
      {children}
    </Td>
  )
}
