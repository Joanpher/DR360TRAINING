import { ArrowRight, CalendarDays, Image as IconoImagen, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  fechaLegible,
  horarioLegible,
  nombreEstadoCurso,
  type Curso,
} from '../admin/catalogo'
import { Etiqueta } from '../ui/Etiqueta'

export function TarjetaCursoDocente({ curso }: { curso: Curso }) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-md border border-regla bg-superficie">
      <div className="relative aspect-video overflow-hidden border-b border-regla bg-lienzo p-2">
        {curso.imagenUrl ? (
          <img src={curso.imagenUrl} alt={`Portada de ${curso.nombre}`} loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-tinta-suave"><IconoImagen size={30} strokeWidth={1.25} /></div>
        )}
        {curso.categoria && <span className="absolute left-3 top-3 border border-white/70 bg-superficie/95 px-2 py-1 text-[10.5px] font-semibold text-tinta">{curso.categoria}</span>}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-dato text-[11px] font-medium text-pizarra">{curso.codigo}</p>
            <h2 className="mt-1 text-[16px] font-bold leading-snug text-tinta">{curso.nombre}</h2>
          </div>
          <Etiqueta tono={curso.estado === 'activo' ? 'aprobado' : curso.estado === 'promocion' ? 'aviso' : 'neutro'}>{nombreEstadoCurso[curso.estado]}</Etiqueta>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-regla pt-3">
          <Dato etiqueta="Horario" valor={horarioLegible(curso.horarios)} icono={<CalendarDays size={13} />} />
          <Dato etiqueta="Grupo" valor={`${curso.inscritos}${curso.cupo ? ` / ${curso.cupo}` : ''} inscritos`} icono={<Users size={13} />} />
          <Dato etiqueta="Inicio" valor={fechaLegible(curso.iniciaEn)} />
          <Dato etiqueta="Final" valor={fechaLegible(curso.terminaEn)} />
        </dl>

        <Link to={`/cursos/${encodeURIComponent(curso.codigo)}`} className="mt-4 flex items-center justify-between border-t border-regla pt-3 text-[13px] font-semibold text-pizarra hover:text-pizarra-fondo">
          Gestionar curso <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  )
}

function Dato({ etiqueta, valor, icono }: { etiqueta: string; valor: string; icono?: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-[10.5px] font-semibold uppercase text-tinta-suave">{etiqueta}</dt><dd className="mt-1 flex items-start gap-1.5 break-words text-[11.5px] font-medium leading-relaxed text-tinta">{icono && <span className="mt-0.5 shrink-0 text-pizarra">{icono}</span>}{valor}</dd></div>
}
