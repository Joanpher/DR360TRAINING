import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
  Megaphone,
  MessageSquare,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSesion } from '../app/sesion'
import { usePortal } from './contexto'
import { fechaClase, horaClase, proximasClases } from './cursoPortal'
import { TarjetaCursoEstudiante } from './TarjetaCursoEstudiante'
import { Boton } from '../ui/Boton'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Ficha, FichaCabecera } from '../ui/Ficha'

export function InicioEstudiante() {
  const { usuario, institucion } = useSesion()
  const { cursos, cargando, error, recargar } = usePortal()
  const clases = proximasClases(cursos, 8)
  const proxima = clases[0]
  const activos = cursos.filter((curso) => curso.estado === 'activo').length
  const enPromocion = cursos.filter((curso) => curso.estado === 'promocion').length
  const completados = cursos.filter((curso) => curso.estado === 'graduado').length

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-md border border-pizarra-fondo bg-pizarra-fondo text-white">
        <div className="grid min-h-[250px] lg:grid-cols-[1fr_38%]">
          <div className="flex flex-col justify-between p-6 sm:p-8">
            <div>
              <p className="etiqueta-dato text-pizarra-vivo">{institucion?.nombre}</p>
              <h1 className="mt-3 max-w-xl font-display text-[30px] font-bold leading-tight sm:text-[36px]">
                Hola, {usuario?.nombres.split(' ')[0] ?? ''}
              </h1>
              <p className="mt-2 text-[14px] text-white/65">
                {cargando
                  ? 'Preparando tu agenda…'
                  : error
                    ? 'No pudimos actualizar tu agenda.'
                    : proxima
                      ? 'Tu próxima clase ya está en agenda.'
                      : 'No tienes clases próximas programadas.'}
              </p>
            </div>

            {proxima ? (
              <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
                <div>
                  <p className="font-dato text-[12px] text-pizarra-vivo">{proxima.curso.codigo}</p>
                  <h2 className="mt-1 text-[19px] font-semibold leading-snug">{proxima.curso.nombre}</h2>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-white/70">
                    <span className="flex items-center gap-1.5"><CalendarClock size={14} /> {fechaClase(proxima.inicio)}</span>
                    <span className="flex items-center gap-1.5"><Clock3 size={14} /> {horaClase(proxima.inicio)} – {horaClase(proxima.fin)}</span>
                    <span className="flex items-center gap-1.5"><MapPin size={14} /> {[proxima.curso.sede, proxima.curso.aula].filter(Boolean).join(' · ') || 'Virtual'}</span>
                  </div>
                </div>
                <Link to={`/cursos/${encodeURIComponent(proxima.curso.codigo)}`} className="flex h-10 items-center gap-2 rounded-sm bg-white px-4 text-[13px] font-semibold text-pizarra-fondo hover:bg-pizarra-vivo">
                  Abrir curso <ArrowRight size={15} />
                </Link>
              </div>
            ) : !cargando && !error ? (
              <Link to="/cursos" className="mt-8 flex w-fit items-center gap-2 text-[13px] font-semibold text-pizarra-vivo hover:text-white">
                Ver mis cursos <ArrowRight size={15} />
              </Link>
            ) : null}
          </div>

          <div className="relative hidden overflow-hidden bg-lienzo p-3 lg:block">
            {proxima?.curso.imagenUrl ? (
              <img src={proxima.curso.imagenUrl} alt={`Portada de ${proxima.curso.nombre}`} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-white/20"><BookOpen size={70} strokeWidth={1} /></div>
            )}
            <div className="absolute inset-y-0 left-0 w-px bg-white/15" />
          </div>
        </div>
      </section>

      <dl className="grid border-y border-regla bg-superficie sm:grid-cols-3 sm:divide-x sm:divide-regla">
        <Resumen icono={<BookOpen size={18} />} etiqueta="En curso" valor={cargando ? '—' : activos} />
        <Resumen icono={<CalendarClock size={18} />} etiqueta="Próximamente" valor={cargando ? '—' : enPromocion} />
        <Resumen icono={<CheckCircle2 size={18} />} etiqueta="Completados" valor={cargando ? '—' : completados} />
      </dl>

      {error ? (
        <Ficha><EstadoVacio icono={BookOpen} titulo="No se pudieron cargar tus cursos" texto={error} accion={<Boton tamano="sm" onClick={() => void recargar()}>Reintentar</Boton>} /></Ficha>
      ) : cargando ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-96 animate-pulse rounded-md bg-superficie" />)}</div>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="etiqueta-dato text-pizarra">Tu aprendizaje</p><h2 className="mt-1 font-display text-[22px] font-bold text-tinta">Mis cursos</h2></div>
              <Link to="/cursos" className="flex items-center gap-1.5 text-[13px] font-medium text-pizarra hover:underline underline-offset-4">Ver todos <ArrowRight size={14} /></Link>
            </div>
            {cursos.length === 0 ? (
              <Ficha><EstadoVacio icono={BookOpen} titulo="Todavía no tienes cursos" texto="Tus cursos aparecerán aquí después de la inscripción." /></Ficha>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">{cursos.slice(0, 4).map((curso) => <TarjetaCursoEstudiante key={curso.id} curso={curso} />)}</div>
            )}
          </section>

          <Agenda clases={clases} />
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Ficha><FichaCabecera titulo="Anuncios" /><EstadoVacio icono={Megaphone} titulo="No hay anuncios" texto="La institución todavía no ha publicado anuncios." /></Ficha>
        <Ficha><FichaCabecera titulo="Mensajes" /><EstadoVacio icono={MessageSquare} titulo="No hay mensajes nuevos" texto="Tus conversaciones aparecerán aquí." /></Ficha>
      </div>
    </div>
  )
}

function Resumen({ icono, etiqueta, valor }: { icono: React.ReactNode; etiqueta: string; valor: number | string }) {
  return <div className="flex items-center gap-4 px-5 py-4"><span className="flex h-10 w-10 items-center justify-center rounded-sm bg-pizarra-tenue text-pizarra">{icono}</span><div><dt className="etiqueta-dato text-tinta-suave">{etiqueta}</dt><dd className="mt-1 font-dato text-[24px] font-medium leading-none text-tinta">{valor}</dd></div></div>
}

function Agenda({ clases }: { clases: ReturnType<typeof proximasClases> }) {
  return (
    <aside className="min-w-0">
      <div className="mb-4"><p className="etiqueta-dato text-pizarra">Agenda</p><h2 className="mt-1 font-display text-[22px] font-bold text-tinta">Próximas clases</h2></div>
      <div className="overflow-hidden rounded-md border border-regla bg-superficie">
        {clases.length === 0 ? (
          <EstadoVacio icono={CalendarClock} titulo="Agenda despejada" texto="No hay clases próximas programadas." />
        ) : (
          <ul>
            {clases.slice(0, 5).map((clase, indice) => (
              <li key={clase.clave} className="grid grid-cols-[54px_1fr] gap-3 border-b border-regla px-4 py-3.5 last:border-b-0">
                <div className={indice === 0 ? 'text-pizarra' : 'text-tinta-suave'}><p className="font-dato text-[18px] font-semibold leading-none">{clase.inicio.getDate().toString().padStart(2, '0')}</p><p className="mt-1 text-[10.5px] font-semibold uppercase">{new Intl.DateTimeFormat('es-DO', { month: 'short' }).format(clase.inicio)}</p></div>
                <div className="min-w-0"><p className="truncate text-[13px] font-semibold text-tinta">{clase.curso.nombre}</p><p className="mt-1 font-dato text-[11px] text-tinta-media">{horaClase(clase.inicio)} – {horaClase(clase.fin)}</p><p className="mt-0.5 truncate text-[11.5px] text-tinta-suave">{clase.curso.codigo}</p></div>
              </li>
            ))}
          </ul>
        )}
        <Link to="/calendario" className="flex items-center justify-between border-t border-regla px-4 py-3 text-[13px] font-medium text-pizarra hover:bg-lienzo">Calendario completo <ArrowRight size={14} /></Link>
      </div>
    </aside>
  )
}
