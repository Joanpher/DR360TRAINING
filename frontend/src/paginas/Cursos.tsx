import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Medidor } from '../ui/Medidor'
import { Etiqueta } from '../ui/Etiqueta'
import { cursos, institucion } from '../datos/demo'

export function Cursos() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-tinta">
          Cursos
        </h1>
        <p className="etiqueta-dato mt-1.5 text-tinta-suave">
          {cursos.length} asignaturas · Periodo {institucion.periodo}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 border border-regla bg-superficie p-3 rounded-md">
        <div className="relative min-w-56 flex-1">
          <Search
            size={15}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave"
          />
          <input
            type="search"
            placeholder="Buscar por código o asignatura"
            className="h-9 w-full rounded-sm border border-regla-fuerte bg-superficie pl-9 pr-3 text-[13px] placeholder:text-tinta-suave focus:border-pizarra focus:outline-none"
          />
        </div>

        {['Periodo 2026-2', 'Todas las carreras', 'Todos los estados'].map(
          (filtro) => (
            <select
              key={filtro}
              className="h-9 rounded-sm border border-regla-fuerte bg-superficie px-2.5 text-[13px] text-tinta-media focus:border-pizarra focus:outline-none"
            >
              <option>{filtro}</option>
            </select>
          ),
        )}

        <button className="flex h-9 items-center gap-2 rounded-sm border border-regla-fuerte px-3 text-[13px] text-tinta-media hover:bg-lienzo">
          <SlidersHorizontal size={15} strokeWidth={1.5} />
          Más filtros
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {cursos.map((curso) => (
          <Link
            key={curso.codigo}
            to={`/cursos/${curso.codigo}`}
            className="group flex flex-col border border-regla bg-superficie transition-colors hover:border-pizarra rounded-md"
          >
            <div className="flex items-start justify-between gap-3 border-b border-regla px-5 py-4">
              <div className="min-w-0">
                <p className="font-dato text-[12px] font-medium text-pizarra">
                  {curso.codigo}
                </p>
                <h2 className="mt-1.5 font-display text-[16px] font-semibold leading-snug tracking-[-0.01em] text-tinta group-hover:text-pizarra">
                  {curso.asignatura}
                </h2>
                <p className="mt-1 text-[13px] text-tinta-media">
                  {curso.docente}
                </p>
              </div>
              <span className="font-dato text-[11px] text-tinta-suave">
                {curso.creditos} cr
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
              <Medidor valor={curso.progreso} etiqueta="Avance del curso" />
              {curso.proxima ? (
                <Etiqueta
                  tono={curso.proxima.estado === 'vencida' ? 'correccion' : 'aviso'}
                >
                  {curso.proxima.fecha}
                </Etiqueta>
              ) : (
                <Etiqueta tono="neutro">Al día</Etiqueta>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
