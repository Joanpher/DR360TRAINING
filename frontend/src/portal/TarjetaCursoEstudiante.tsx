import { ArrowUpRight, CalendarDays, Image as IconoImagen, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  fechaLegible,
  horarioLegible,
  nombreEstadoCurso,
  type Curso,
} from '../admin/catalogo'
import { Etiqueta } from '../ui/Etiqueta'

export function TarjetaCursoEstudiante({ curso }: { curso: Curso }) {
  return (
    <Link
      to={`/cursos/${encodeURIComponent(curso.codigo)}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-md border border-regla bg-superficie transition-colors hover:border-pizarra focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pizarra/30"
    >
      <div className="relative aspect-video overflow-hidden border-b border-regla bg-lienzo p-2">
        {curso.imagenUrl ? (
          <img
            src={curso.imagenUrl}
            alt={`Portada de ${curso.nombre}`}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-tinta-suave">
            <IconoImagen size={32} strokeWidth={1.25} />
          </div>
        )}
        <span className="absolute bottom-3 left-3 border border-white/70 bg-superficie/95 px-2 py-1 font-dato text-[10.5px] font-medium text-tinta">
          {curso.codigo}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {curso.categoria && (
              <p className="etiqueta-dato text-tinta-suave">{curso.categoria}</p>
            )}
            <h2 className="mt-1 text-[17px] font-bold leading-snug text-tinta group-hover:text-pizarra">
              {curso.nombre}
            </h2>
          </div>
          <Etiqueta tono={curso.estado === 'activo' ? 'aprobado' : curso.estado === 'promocion' ? 'aviso' : 'neutro'}>
            {nombreEstadoCurso[curso.estado]}
          </Etiqueta>
        </div>

        <div className="mt-4 space-y-2 text-[12.5px] text-tinta-media">
          <p className="flex items-center gap-2">
            <UserRound size={14} className="shrink-0 text-pizarra" />
            <span className="truncate">{curso.instructor ?? 'Sin instructor asignado'}</span>
          </p>
          <p className="flex items-start gap-2">
            <CalendarDays size={14} className="mt-0.5 shrink-0 text-pizarra" />
            <span>{horarioLegible(curso.horarios)}</span>
          </p>
        </div>

        <footer className="mt-4 flex items-end justify-between gap-3 border-t border-regla pt-3">
          <div>
            <p className="text-[10.5px] font-semibold text-tinta-suave">PERÍODO</p>
            <p className="mt-1 text-[11.5px] font-medium text-tinta">
              {fechaLegible(curso.iniciaEn)} – {fechaLegible(curso.terminaEn)}
            </p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-pizarra-tenue text-pizarra transition-colors group-hover:bg-pizarra group-hover:text-white">
            <ArrowUpRight size={15} />
          </span>
        </footer>
      </div>
    </Link>
  )
}
