export function Medidor({
  valor,
  etiqueta,
}: {
  valor: number
  etiqueta?: string
}) {
  const acotado = Math.max(0, Math.min(100, valor))
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="h-1.5 w-24 shrink-0 bg-regla"
        role="progressbar"
        aria-valuenow={acotado}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={etiqueta}
      >
        <div className="h-full bg-pizarra" style={{ width: `${acotado}%` }} />
      </div>
      <span className="font-dato text-[13px] tabular-nums text-tinta-media">
        {acotado}%
      </span>
    </div>
  )
}
