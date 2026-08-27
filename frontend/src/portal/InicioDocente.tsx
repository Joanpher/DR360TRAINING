import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ChartColumn,
  ClipboardCheck,
  Megaphone,
  MessageSquare,
  Users,
  Video,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSesion } from '../app/sesion'
import { usePortal } from './contexto'
import { fechaClase, horaClase, proximasClases } from './cursoPortal'
import { Boton } from '../ui/Boton'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Etiqueta } from '../ui/Etiqueta'
import { Ficha, FichaCabecera } from '../ui/Ficha'
import { Azulejo, RejillaAzulejos } from '../ui/Azulejo'
import { cn } from '../ui/cn'
import { fondoRotulador, textoRotulador, type Rotulador } from '../ui/rotulador'

export function InicioDocente() {
  const { usuario, institucion } = useSesion()
  const { cursos, cargando, error, recargar } = usePortal()
  const clases = proximasClases(cursos, 8)
  const activos = cursos.filter((curso) => curso.estado === 'activo').length
  const bloques = cursos.reduce((total, curso) => total + curso.horarios.length, 0)
  const inscripciones = cursos.reduce((total, curso) => total + curso.inscritos, 0)

  return (
    <div className="space-y-7">
      {/*
        La misma portada que ve el estudiante. Que los dos paneles se abran
        igual no es uniformidad por gusto: quien administra se asoma a los dos
        desde la barra de arriba, y dos aperturas distintas hacen dudar de en
        cual esta.
      */}
      <header className="fondo-cabecera flex flex-wrap items-end justify-between gap-4 rounded-lg px-6 py-6 text-white shadow-realce">
        <div>
          <p className="etiqueta-dato text-pizarra-vivo">Panel del instructor</p>
          <h1 className="mt-2 font-display text-[30px] font-bold leading-tight">
            Buen día, {usuario?.nombres.split(' ')[0] ?? ''}
          </h1>
          <p className="mt-2 text-[13px] text-white/70">{institucion?.nombre}</p>
        </div>
        <Link
          to="/calendario"
          className="flex h-10 items-center gap-2 rounded-sm bg-white px-4 text-[13px] font-semibold text-pizarra-fondo transition-colors hover:bg-pizarra-vivo"
        >
          <CalendarClock size={15} /> Ver horario
        </Link>
      </header>

      <RejillaAzulejos>
        <Azulejo icono={BookOpen} color="violeta" titulo="Mis cursos" pie="Aula, tareas y notas" ruta="/cursos" />
        <Azulejo icono={Video} color="coral" titulo="Clases en vivo" pie="Abrir la sala" ruta="/clases" />
        <Azulejo icono={ChartColumn} color="menta" titulo="Reportes" pie="Rendimiento del grupo" ruta="/reportes" />
        <Azulejo icono={MessageSquare} color="magenta" titulo="Mensajes" pie="Foros de tus cursos" ruta="/mensajes" />
      </RejillaAzulejos>

      <dl className="grid overflow-hidden rounded-md border border-regla bg-superficie shadow-apoyo sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-regla">
        <Resumen etiqueta="Cursos asignados" valor={cargando ? '—' : cursos.length} pie="Total en tu portal" icono={BookOpen} color="violeta" />
        <Resumen etiqueta="En docencia" valor={cargando ? '—' : activos} pie="Cursos activos" icono={ClipboardCheck} color="azul" />
        <Resumen etiqueta="Bloques semanales" valor={cargando ? '—' : bloques} pie="Clases programadas" icono={CalendarClock} color="cian" />
        <Resumen etiqueta="Inscripciones" valor={cargando ? '—' : inscripciones} pie="En tus grupos" icono={Users} color="menta" />
      </dl>

      {error ? (
        <Ficha><EstadoVacio icono={BookOpen} color="coral" titulo="No se pudieron cargar tus asignaciones" texto={error} accion={<Boton tamano="sm" onClick={() => void recargar()}>Reintentar</Boton>} /></Ficha>
      ) : cargando ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]"><div className="h-[420px] animate-pulse rounded-md bg-superficie" /><div className="h-[420px] animate-pulse rounded-md bg-superficie" /></div>
      ) : (
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_350px]">
          <section className="min-w-0">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="etiqueta-dato text-tinta-suave">Asignación actual</p><h2 className="mt-1 font-display text-[21px] font-bold text-tinta">Cursos que impartes</h2></div>
              <Link to="/cursos" className="flex items-center gap-1.5 text-[13px] font-medium text-pizarra hover:underline underline-offset-4">Ver todos <ArrowRight size={14} /></Link>
            </div>
            {cursos.length === 0 ? (
              <Ficha><EstadoVacio icono={BookOpen} color="violeta" titulo="No tienes cursos asignados" texto="Cuando te asignen como instructor, aparecerán aquí." /></Ficha>
            ) : (
              <div className="overflow-hidden rounded-md border border-regla bg-superficie shadow-apoyo">
                {cursos.slice(0, 5).map((curso) => (
                  <Link key={curso.id} to={`/cursos/${encodeURIComponent(curso.codigo)}`} className="grid gap-3 border-b border-regla p-3.5 last:border-b-0 hover:bg-lienzo sm:grid-cols-[72px_minmax(0,1fr)_140px_90px] sm:items-center">
                    <div className="hidden h-12 overflow-hidden rounded-sm bg-lienzo sm:block">{curso.imagenUrl ? <img src={curso.imagenUrl} alt="" className="h-full w-full object-cover" /> : <BookOpen size={18} className="m-auto h-full text-tinta-suave" />}</div>
                    <div className="min-w-0"><p className="font-dato text-[10.5px] text-pizarra">{curso.codigo}</p><p className="mt-0.5 truncate text-[13.5px] font-semibold text-tinta">{curso.nombre}</p><p className="mt-1 truncate text-[11.5px] text-tinta-suave">{curso.horarios.length ? `${curso.horarios.length} bloque${curso.horarios.length === 1 ? '' : 's'} semanal${curso.horarios.length === 1 ? '' : 'es'}` : 'Sin horario'}</p></div>
                    <p className="text-[12px] text-tinta-media"><Users size={13} className="mr-1.5 inline text-pizarra" />{curso.inscritos}{curso.cupo ? ` / ${curso.cupo}` : ''} inscritos</p>
                    <div className="sm:text-right"><Etiqueta tono={curso.estado === 'activo' ? 'aprobado' : curso.estado === 'promocion' ? 'aviso' : 'neutro'}>{curso.estado === 'activo' ? 'Activo' : curso.estado === 'promocion' ? 'Promoción' : 'Graduado'}</Etiqueta></div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <AgendaDocente clases={clases} />
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Ficha><FichaCabecera titulo="Por calificar" icono={ClipboardCheck} color="menta" /><EstadoVacio icono={ClipboardCheck} color="menta" titulo="No hay evaluaciones pendientes" texto="Las entregas pendientes aparecerán aquí." /></Ficha>
        <Ficha><FichaCabecera titulo="Anuncios" icono={Megaphone} color="ambar" /><EstadoVacio icono={Megaphone} color="ambar" titulo="No hay anuncios" texto="La institución todavía no ha publicado anuncios." /></Ficha>
      </div>
    </div>
  )
}

function Resumen({
  etiqueta,
  valor,
  pie,
  icono: Icono,
  color,
}: {
  etiqueta: string
  valor: number | string
  pie: string
  icono: typeof BookOpen
  color: Rotulador
}) {
  return (
    <div className="group border-b border-regla px-5 py-4 transition-colors last:border-b-0 hover:bg-[#fafcff] sm:[&:nth-child(n+3)]:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:[&:nth-child(odd)]:border-r-0">
      <div className="flex items-start justify-between gap-2">
        <dt className="etiqueta-dato text-tinta-suave">{etiqueta}</dt>
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-xs transition-transform duration-200 group-hover:scale-110',
            fondoRotulador[color],
            textoRotulador[color],
          )}
        >
          <Icono size={15} strokeWidth={1.75} />
        </span>
      </div>
      <dd className="mt-2 font-dato text-[27px] font-medium leading-none text-tinta">{valor}</dd>
      <p className="mt-1.5 text-[11.5px] text-tinta-suave">{pie}</p>
    </div>
  )
}

function AgendaDocente({ clases }: { clases: ReturnType<typeof proximasClases> }) {
  return (
    <aside>
      <div className="mb-4"><p className="etiqueta-dato text-tinta-suave">Agenda docente</p><h2 className="mt-1 font-display text-[21px] font-bold text-tinta">Próximas clases</h2></div>
      <div className="overflow-hidden rounded-md border border-regla bg-superficie shadow-apoyo">
        {clases.length === 0 ? <EstadoVacio icono={CalendarClock} color="cian" titulo="Sin clases próximas" texto="No hay bloques programados en tus cursos." /> : (
          <ul>{clases.slice(0, 6).map((clase, indice) => <li key={clase.clave} className="flex gap-3 border-b border-regla px-4 py-3.5 last:border-b-0"><span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', indice === 0 ? 'bg-pizarra ring-4 ring-pizarra-tenue' : 'bg-regla-fuerte')} /><div className="min-w-0"><p className="font-dato text-[11px] text-tinta-suave">{fechaClase(clase.inicio)} · {horaClase(clase.inicio)}</p><p className="mt-1 truncate text-[13px] font-semibold text-tinta">{clase.curso.nombre}</p><p className="mt-0.5 font-dato text-[10.5px] text-pizarra">{clase.curso.codigo}</p></div></li>)}</ul>
        )}
        <Link to="/calendario" className="flex items-center justify-between border-t border-regla px-4 py-3 text-[13px] font-medium text-pizarra hover:bg-lienzo">Calendario completo <ArrowRight size={14} /></Link>
      </div>
    </aside>
  )
}
