import { useMemo, useState } from 'react'
import {
  Award,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileQuestion,
  FileUp,
  UsersRound,
} from 'lucide-react'
import type { Curso } from '../admin/catalogo'
import { useConsulta } from '../datos/consulta'
import { Boton } from '../ui/Boton'
import { cn } from '../ui/cn'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Ficha } from '../ui/Ficha'
import { EntregasTarea } from './AulaCurso'
import { fechaTarea, type RespuestaAula, type TareaAula } from './aula'
import type {
  EvaluacionResumen,
  RespuestaEvaluacionesCurso,
} from './evaluaciones'

type TareaConSemana = TareaAula & { semanaNumero: number; semanaTitulo: string }

export function TareasCurso({
  curso,
  esDocente,
  alAbrirAula,
}: {
  curso: Curso
  esDocente: boolean
  alAbrirAula: () => void
}) {
  const consulta = useConsulta<RespuestaAula>(`/aulas/curso/${curso.id}`)
  const tareas = useMemo(() => extraerTareas(consulta.datos), [consulta.datos])

  if (consulta.cargando) return <CargaModulo />
  if (consulta.error) {
    return (
      <Ficha>
        <EstadoVacio
          icono={ClipboardList}
          titulo="No se pudieron cargar las tareas"
          texto={consulta.error}
          accion={<Boton tamano="sm" onClick={() => void consulta.recargar()}>Reintentar</Boton>}
        />
      </Ficha>
    )
  }
  if (tareas.length === 0) {
    return (
      <Ficha>
        <EstadoVacio
          icono={ClipboardList}
          titulo="No hay tareas"
          texto="Las actividades publicadas apareceran en este espacio."
          accion={esDocente ? <Boton tamano="sm" onClick={alAbrirAula}>Crear en el aula</Boton> : undefined}
        />
      </Ficha>
    )
  }

  return (
    <section className="space-y-4 entrada-suave">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="etiqueta-dato text-pizarra">Actividades del curso</p>
          <h2 className="mt-1 font-display text-[21px] font-bold text-tinta">Tareas</h2>
          <p className="mt-1 text-[12.5px] text-tinta-media">{tareas.length} actividades organizadas por fecha de entrega.</p>
        </div>
        {esDocente && <Boton tamano="sm" onClick={alAbrirAula}>Gestionar tareas</Boton>}
      </div>
      <div className="overflow-hidden border border-regla bg-superficie">
        {tareas.map((tarea) => {
          const estado = estadoEstudiante(tarea)
          return (
            <article key={tarea.id} className="grid gap-3 border-b border-regla px-4 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="font-dato text-[10.5px] text-pizarra">Semana {tarea.semanaNumero} · {tarea.semanaTitulo}</p>
                <h3 className="mt-1 text-[14px] font-semibold text-tinta">{tarea.titulo}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-tinta-media">
                  <span className="flex items-center gap-1.5"><CalendarClock size={13} /> {fechaTarea(tarea.venceEn)}</span>
                  <span>{Number(tarea.puntos)} puntos</span>
                </p>
              </div>
              {esDocente ? (
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-pizarra">
                  <UsersRound size={14} /> {tarea.cantidadEntregas} entregas
                </span>
              ) : (
                <span className={cn('flex items-center gap-1.5 text-[12px] font-semibold', estado.clase)}>
                  {estado.icono} {estado.texto}
                </span>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function CalificacionesCurso({
  curso,
  esDocente,
}: {
  curso: Curso
  esDocente: boolean
}) {
  const consulta = useConsulta<RespuestaAula>(`/aulas/curso/${curso.id}`)
  const consultaExamenes = useConsulta<RespuestaEvaluacionesCurso>(
    `/evaluaciones/curso/${curso.id}`,
  )
  const tareas = useMemo(() => extraerTareas(consulta.datos), [consulta.datos])
  const examenes = consultaExamenes.datos?.evaluaciones ?? []

  if (consulta.cargando || consultaExamenes.cargando) return <CargaModulo />
  if (consulta.error || consultaExamenes.error) {
    return (
      <Ficha>
        <EstadoVacio
          icono={Award}
          titulo="No se pudieron cargar las calificaciones"
          texto={
            consulta.error ??
            consultaExamenes.error ??
            'No se pudo cargar el libro.'
          }
          accion={
            <Boton
              tamano="sm"
              onClick={() => {
                void consulta.recargar()
                void consultaExamenes.recargar()
              }}
            >
              Reintentar
            </Boton>
          }
        />
      </Ficha>
    )
  }
  if (tareas.length === 0 && examenes.length === 0) {
    return (
      <Ficha>
        <EstadoVacio
          icono={Award}
          titulo="Sin evaluaciones"
          texto="Las notas de tareas y exámenes aparecerán en este espacio."
        />
      </Ficha>
    )
  }

  return esDocente ? (
    <LibroDocente tareas={tareas} examenes={examenes} />
  ) : (
    <NotasEstudiante tareas={tareas} examenes={examenes} />
  )
}

function LibroDocente({
  tareas,
  examenes,
}: {
  tareas: TareaConSemana[]
  examenes: EvaluacionResumen[]
}) {
  const [abierta, setAbierta] = useState<string | null>(null)
  const entregas = tareas.reduce(
    (total, tarea) => total + tarea.cantidadEntregas,
    0,
  )
  const intentos = examenes.reduce(
    (total, examen) => total + examen.cantidadIntentos,
    0,
  )
  const puntos =
    tareas.reduce((total, tarea) => total + Number(tarea.puntos), 0) +
    examenes.reduce(
      (total, examen) => total + Number(examen.puntosTotal),
      0,
    )

  return (
    <section className="space-y-4 entrada-suave">
      <div>
        <p className="etiqueta-dato text-pizarra">Seguimiento académico</p>
        <h2 className="mt-1 font-display text-[21px] font-bold text-tinta">
          Libro de calificaciones
        </h2>
      </div>
      <dl className="grid border border-regla bg-superficie sm:grid-cols-3 sm:divide-x sm:divide-regla">
        <Resumen
          etiqueta="Evaluaciones"
          valor={String(tareas.length + examenes.length)}
        />
        <Resumen
          etiqueta="Respuestas recibidas"
          valor={String(entregas + intentos)}
          secundario={`${entregas} tareas · ${intentos} exámenes`}
        />
        <Resumen
          etiqueta="Puntos del curso"
          valor={String(puntos)}
          secundario="Suma de tareas y exámenes"
        />
      </dl>
      <div className="overflow-hidden border border-regla bg-superficie">
        {tareas.map((tarea) => (
          <article
            key={tarea.id}
            className="border-b border-regla last:border-b-0"
          >
            <button
              type="button"
              onClick={() =>
                setAbierta((actual) =>
                  actual === tarea.id ? null : tarea.id,
                )
              }
              className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-lienzo/70"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-pizarra-tenue text-pizarra">
                <Award size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-tinta">
                  {tarea.titulo}
                </span>
                <span className="mt-1 block font-dato text-[10.5px] text-tinta-suave">
                  Semana {tarea.semanaNumero} · {Number(tarea.puntos)} puntos ·{' '}
                  {tarea.cantidadEntregas} entregas
                </span>
              </span>
              <ChevronDown
                size={16}
                className={cn(
                  'shrink-0 text-tinta-suave transition-transform',
                  abierta === tarea.id && 'rotate-180',
                )}
              />
            </button>
            {abierta === tarea.id && (
              <div className="border-t border-regla px-4 pb-4">
                <EntregasTarea tareaId={tarea.id} />
              </div>
            )}
          </article>
        ))}
        {examenes.map((examen) => (
          <article
            key={examen.id}
            className="flex items-center gap-3 border-b border-regla px-4 py-4 last:border-b-0"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-pizarra-tenue text-pizarra">
              <FileQuestion size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-tinta">
                {examen.titulo}
              </span>
              <span className="mt-1 block font-dato text-[10.5px] text-tinta-suave">
                Examen · {Number(examen.puntosTotal)} puntos ·{' '}
                {examen.cantidadIntentos} intentos
              </span>
            </span>
            <span
              className={cn(
                'shrink-0 text-[11.5px] font-semibold',
                examen.publicada ? 'text-exito' : 'text-tinta-suave',
              )}
            >
              {examen.publicada ? 'Publicado' : 'Borrador'}
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}

function NotasEstudiante({
  tareas,
  examenes,
}: {
  tareas: TareaConSemana[]
  examenes: EvaluacionResumen[]
}) {
  const calificadas = tareas.filter(
    (tarea) =>
      tarea.entrega?.calificacion !== null &&
      tarea.entrega?.calificacion !== undefined,
  )
  const examenesCalificados = examenes.filter(
    (examen) =>
      examen.intento?.estado === 'calificado' &&
      examen.intento.calificacion !== null,
  )
  const obtenidos =
    calificadas.reduce(
      (total, tarea) => total + Number(tarea.entrega?.calificacion ?? 0),
      0,
    ) +
    examenesCalificados.reduce(
      (total, examen) => total + Number(examen.intento?.calificacion ?? 0),
      0,
    )
  const posibles =
    calificadas.reduce(
      (total, tarea) => total + Number(tarea.puntos),
      0,
    ) +
    examenesCalificados.reduce(
      (total, examen) => total + Number(examen.puntosTotal),
      0,
    )
  const porcentaje = posibles > 0 ? Math.round((obtenidos / posibles) * 100) : 0
  const totalCalificadas = calificadas.length + examenesCalificados.length
  const totalActividades = tareas.length + examenes.length

  return (
    <section className="space-y-4 entrada-suave">
      <div>
        <p className="etiqueta-dato text-pizarra">Tu desempeño</p>
        <h2 className="mt-1 font-display text-[21px] font-bold text-tinta">
          Calificaciones
        </h2>
      </div>
      <div className="grid gap-px border border-regla bg-regla sm:grid-cols-[220px_1fr]">
        <div className="bg-pizarra-fondo p-5 text-white">
          <p className="etiqueta-dato text-pizarra-vivo">Promedio actual</p>
          <p className="mt-2 font-dato text-[36px] font-semibold leading-none">
            {totalCalificadas ? `${porcentaje}%` : '—'}
          </p>
          <p className="mt-3 text-[11.5px] text-white/65">
            {totalCalificadas} de {totalActividades} actividades calificadas
          </p>
        </div>
        <div className="bg-superficie p-5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-tinta-media">Puntos acumulados</span>
            <strong className="font-dato text-tinta">
              {obtenidos} / {posibles || 0}
            </strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden bg-lienzo">
            <span
              className="block h-full bg-exito transition-[width] duration-500"
              style={{ width: `${Math.min(100, porcentaje)}%` }}
            />
          </div>
          <p className="mt-3 text-[11.5px] text-tinta-suave">
            El promedio usa solamente actividades que ya tienen calificación.
          </p>
        </div>
      </div>
      <div className="overflow-hidden border border-regla bg-superficie">
        {tareas.map((tarea) => {
          const nota = tarea.entrega?.calificacion
          return (
            <article
              key={tarea.id}
              className="grid gap-3 border-b border-regla px-4 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <p className="font-dato text-[10.5px] text-pizarra">
                  Semana {tarea.semanaNumero}
                </p>
                <h3 className="mt-1 text-[13.5px] font-semibold text-tinta">
                  {tarea.titulo}
                </h3>
              </div>
              {nota !== null && nota !== undefined ? (
                <span className="flex items-center gap-2 font-dato text-[13px] font-semibold text-exito">
                  <CheckCircle2 size={15} /> {Number(nota)} /{' '}
                  {Number(tarea.puntos)}
                </span>
              ) : (
                <span className="flex items-center gap-2 text-[11.5px] font-semibold text-tinta-suave">
                  <FileUp size={14} />{' '}
                  {tarea.entrega ? 'En revisión' : 'Sin calificar'}
                </span>
              )}
            </article>
          )
        })}
        {examenes.map((examen) => {
          const intento = examen.intento
          const calificado =
            intento?.estado === 'calificado' && intento.calificacion !== null
          return (
            <article
              key={examen.id}
              className="grid gap-3 border-b border-regla px-4 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center bg-pizarra-tenue text-pizarra">
                  <FileQuestion size={15} />
                </span>
                <div className="min-w-0">
                  <p className="font-dato text-[10.5px] text-pizarra">
                    Examen
                  </p>
                  <h3 className="mt-1 text-[13.5px] font-semibold text-tinta">
                    {examen.titulo}
                  </h3>
                </div>
              </div>
              {calificado ? (
                <span className="flex items-center gap-2 font-dato text-[13px] font-semibold text-exito">
                  <CheckCircle2 size={15} /> {Number(intento.calificacion)} /{' '}
                  {Number(examen.puntosTotal)}
                </span>
              ) : (
                <span className="flex items-center gap-2 text-[11.5px] font-semibold text-tinta-suave">
                  <FileQuestion size={14} />{' '}
                  {intento?.estado === 'enviado'
                    ? 'En revisión'
                    : intento?.estado === 'en_progreso'
                      ? 'En progreso'
                      : 'Sin calificar'}
                </span>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function Resumen({ etiqueta, valor, secundario }: { etiqueta: string; valor: string; secundario?: string }) {
  return <div className="bg-superficie px-5 py-4"><dt className="etiqueta-dato text-tinta-suave">{etiqueta}</dt><dd className="mt-1 font-dato text-[24px] font-semibold text-tinta">{valor}</dd>{secundario && <p className="mt-1 text-[10.5px] text-tinta-suave">{secundario}</p>}</div>
}

function CargaModulo() {
  return <div className="h-64 animate-pulse border border-regla bg-superficie" />
}

function extraerTareas(datos: RespuestaAula | null): TareaConSemana[] {
  return (datos?.aula?.semanas ?? []).flatMap((semana) =>
    semana.tareas.map((tarea) => ({ ...tarea, semanaNumero: semana.numero, semanaTitulo: semana.titulo })),
  )
}

function estadoEstudiante(tarea: TareaAula) {
  if (tarea.entrega?.calificacion !== null && tarea.entrega?.calificacion !== undefined) {
    return { texto: `Calificada: ${Number(tarea.entrega.calificacion)} / ${Number(tarea.puntos)}`, clase: 'text-exito', icono: <CheckCircle2 size={14} /> }
  }
  if (tarea.entrega) return { texto: 'Enviada', clase: 'text-exito', icono: <CheckCircle2 size={14} /> }
  if (tarea.venceEn && new Date(tarea.venceEn).getTime() < Date.now()) return { texto: 'Vencida', clase: 'text-correccion', icono: <CalendarClock size={14} /> }
  return { texto: 'Pendiente', clase: 'text-entrega', icono: <FileUp size={14} /> }
}
