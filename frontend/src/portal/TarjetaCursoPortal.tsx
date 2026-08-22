import { CalendarDays, Clock3, Image as IconoImagen, MapPin, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  fechaLegible,
  horarioLegible,
  nombreEstadoCurso,
  nombreModalidad,
  type Curso,
} from '../admin/catalogo'
import { Etiqueta } from '../ui/Etiqueta'

export function TarjetaCursoPortal({ curso }: { curso: Curso }) {
  return (
    <Link
      to={`/cursos/${encodeURIComponent(curso.codigo)}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-md border border-regla bg-superficie transition-colors hover:border-pizarra focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pizarra/30"
    >
      <div className="relative aspect-[16/7] overflow-hidden bg-lienzo">
        {curso.imagenUrl ? (
          <img
            src={curso.imagenUrl}
            alt={`Portada de ${curso.nombre}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-tinta-suave">
            <IconoImagen size={30} strokeWidth={1.25} />
          </div>
        )}
        {curso.categoria && (
          <span className="absolute left-3 top-3 border border-white/70 bg-superficie/95 px-2 py-1 text-[11px] font-semibold text-tinta">
            {curso.categoria}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-dato text-[11.5px] font-medium text-pizarra">{curso.codigo}</p>
            <h2 className="mt-1 text-[16px] font-bold leading-snug text-tinta group-hover:text-pizarra">
              {curso.nombre}
            </h2>
          </div>
          <Etiqueta tono={curso.estado === 'activo' ? 'aprobado' : curso.estado === 'promocion' ? 'aviso' : 'neutro'}>
            {nombreEstadoCurso[curso.estado]}
          </Etiqueta>
        </div>

        {curso.resumen && (
          <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-tinta-media">
            {curso.resumen}
          </p>
        )}

        <div className="mt-4 space-y-2 border-t border-regla pt-3 text-[12.5px] text-tinta-media">
          <p className="flex items-center gap-2">
            <CalendarDays size={14} className="shrink-0 text-pizarra" />
            {horarioLegible(curso.horarios)}
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={14} className="shrink-0 text-pizarra" />
            {curso.modalidad === 'virtual'
              ? nombreModalidad[curso.modalidad]
              : [curso.sede, curso.aula, nombreModalidad[curso.modalidad]].filter(Boolean).join(' · ')}
          </p>
        </div>

        <footer className="mt-auto grid grid-cols-3 gap-3 border-t border-regla pt-3">
          <Dato icono={<Clock3 size={13} />} etiqueta="Duración" valor={curso.duracionSemanas ? `${curso.duracionSemanas} sem.` : '—'} />
          <Dato etiqueta="Inicio" valor={fechaLegible(curso.iniciaEn)} />
          <Dato icono={<Users size={13} />} etiqueta="Inscritos" valor={String(curso.inscritos)} />
        </footer>
      </div>
    </Link>
  )
}

function Dato({ icono, etiqueta, valor }: { icono?: React.ReactNode; etiqueta: string; valor: string }) {
  return (
    <dl className="min-w-0">
      <dt className="text-[10.5px] font-semibold text-tinta-suave">{etiqueta}</dt>
      <dd className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-tinta">
        {icono}
        <span className="min-w-0 break-words">{valor}</span>
      </dd>
    </dl>
  )
}
