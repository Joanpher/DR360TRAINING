import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlarmClock,
  ArrowRight,
  Bold,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  FileQuestion,
  FileUp,
  Heading1,
  Heading2,
  List,
  Send,
  Upload,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { pedir, pedirArchivo } from '../datos/api'
import { useConsulta, useGuardar } from '../datos/consulta'
import { Boton } from '../ui/Boton'
import { cn } from '../ui/cn'
import { Dialogo } from '../ui/Dialogo'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Ficha } from '../ui/Ficha'
import {
  fechaTarea,
  tamanoArchivo,
  type RespuestaAula,
  type RespuestaCalendario,
  type TareaCalendario,
} from './aula'
import {
  DIAS_REJILLA,
  claveFecha,
  formatoDiaCompleto,
  inicioDia,
  rangoCalendario,
} from './calendario'
import {
  fechaEvaluacion,
  type EvaluacionCalendario,
  type RespuestaCalendarioEvaluaciones,
} from './evaluaciones'

export function CalendarioEstudiante() {
  const hoy = inicioDia(new Date())
  const [mesVisible, setMesVisible] = useState(
    new Date(hoy.getFullYear(), hoy.getMonth(), 1),
  )
  const [seleccionada, setSeleccionada] = useState(hoy)
  const [tareaActiva, setTareaActiva] = useState<TareaCalendario | null>(null)
  const [entregaActiva, setEntregaActiva] = useState<TareaCalendario | null>(
    null,
  )
  const rango = useMemo(() => rangoCalendario(mesVisible), [mesVisible])
  const ruta = useMemo(
    () =>
      `/aulas/tareas/calendario?desde=${encodeURIComponent(rango.desde.toISOString())}&hasta=${encodeURIComponent(rango.hasta.toISOString())}`,
    [rango],
  )
  const consulta = useConsulta<RespuestaCalendario>(ruta)
  const tareas = consulta.datos?.tareas
  const consultaEvaluaciones = useConsulta<RespuestaCalendarioEvaluaciones>(
    `/evaluaciones/calendario?desde=${encodeURIComponent(rango.desde.toISOString())}&hasta=${encodeURIComponent(rango.hasta.toISOString())}`,
  )
  const evaluaciones = consultaEvaluaciones.datos?.evaluaciones

  const porDia = useMemo(() => {
    const grupos = new Map<string, TareaCalendario[]>()
    for (const tarea of tareas ?? []) {
      const clave = claveFecha(new Date(tarea.venceEn))
      grupos.set(clave, [...(grupos.get(clave) ?? []), tarea])
    }
    return grupos
  }, [tareas])

  const evaluacionesPorDia = useMemo(() => {
    const grupos = new Map<string, EvaluacionCalendario[]>()
    for (const evaluacion of evaluaciones ?? []) {
      const clave = claveFecha(new Date(evaluacion.abreEn))
      grupos.set(clave, [...(grupos.get(clave) ?? []), evaluacion])
    }
    return grupos
  }, [evaluaciones])

  const tareasSeleccionadas = porDia.get(claveFecha(seleccionada)) ?? []
  const evaluacionesSeleccionadas =
    evaluacionesPorDia.get(claveFecha(seleccionada)) ?? []
  const tareaDetalle =
    tareas?.find((tarea) => tarea.id === tareaActiva?.id) ?? tareaActiva
  const tareaEntrega =
    tareas?.find((tarea) => tarea.id === entregaActiva?.id) ?? entregaActiva

  function moverMes(diferencia: number) {
    const siguiente = new Date(
      mesVisible.getFullYear(),
      mesVisible.getMonth() + diferencia,
      1,
    )
    setMesVisible(siguiente)
    setSeleccionada(siguiente)
  }

  function volverHoy() {
    const actual = inicioDia(new Date())
    setMesVisible(new Date(actual.getFullYear(), actual.getMonth(), 1))
    setSeleccionada(actual)
  }

  function abrirEntrega(tarea: TareaCalendario) {
    setTareaActiva(null)
    setEntregaActiva(tarea)
  }

  async function despuesDeEnviar() {
    await consulta.recargar()
    setEntregaActiva(null)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-regla pb-5">
        <div>
          <p className="etiqueta-dato text-pizarra">Tu agenda academica</p>
          <h1 className="mt-1 font-display text-[30px] font-bold leading-tight text-tinta">
            Calendario
          </h1>
          <p className="mt-2 text-[13px] text-tinta-media">
            Tareas y exámenes publicados por tus instructores aparecen aquí.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-tinta-media">
          <LeyendaEstado clase="bg-entrega" texto="Pendiente" />
          <LeyendaEstado clase="bg-exito" texto="Enviada" />
          <LeyendaEstado clase="bg-correccion" texto="Vencida" />
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_370px]">
        <Ficha className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-regla px-4 py-3 sm:px-5">
            <h2 className="font-display text-[19px] font-bold capitalize text-tinta">
              {new Intl.DateTimeFormat('es-DO', {
                month: 'long',
                year: 'numeric',
              }).format(mesVisible)}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Mes anterior"
                aria-label="Mes anterior"
                onClick={() => moverMes(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-sm text-tinta-media hover:bg-lienzo hover:text-tinta"
              >
                <ChevronLeft size={17} />
              </button>
              <Boton tamano="sm" variante="fantasma" onClick={volverHoy}>
                Hoy
              </Boton>
              <button
                type="button"
                title="Mes siguiente"
                aria-label="Mes siguiente"
                onClick={() => moverMes(1)}
                className="flex h-9 w-9 items-center justify-center rounded-sm text-tinta-media hover:bg-lienzo hover:text-tinta"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-regla bg-lienzo">
            {DIAS_REJILLA.map((dia) => (
              <div
                key={dia}
                className="border-r border-regla px-1 py-2 text-center text-[10.5px] font-semibold uppercase text-tinta-media last:border-r-0"
              >
                {dia}
              </div>
            ))}
          </div>

          {consulta.cargando || consultaEvaluaciones.cargando ? (
            <div className="h-[480px] animate-pulse bg-lienzo/60" />
          ) : consulta.error || consultaEvaluaciones.error ? (
            <EstadoVacio
              icono={CalendarDays}
              titulo="No se pudo cargar el calendario"
              texto={consulta.error ?? consultaEvaluaciones.error ?? 'No se pudo cargar la agenda.'}
              accion={
                <Boton tamano="sm" onClick={() => { void consulta.recargar(); void consultaEvaluaciones.recargar() }}>
                  Reintentar
                </Boton>
              }
            />
          ) : (
            <div className="grid grid-cols-7">
              {rango.dias.map((dia, indice) => {
                const clave = claveFecha(dia)
                const tareasDia = porDia.get(clave) ?? []
                const examenesDia = evaluacionesPorDia.get(clave) ?? []
                const cantidad = tareasDia.length
                const totalDia = cantidad + examenesDia.length
                const resumen = estadoResumen(tareasDia)
                const esMes = dia.getMonth() === mesVisible.getMonth()
                const esHoy = clave === claveFecha(hoy)
                const elegida = clave === claveFecha(seleccionada)
                return (
                  <button
                    key={clave}
                    type="button"
                    disabled={!esMes}
                    onClick={() => {
                      if (esMes) setSeleccionada(dia)
                    }}
                    aria-label={
                      esMes
                        ? `${formatoDiaCompleto(dia)}${totalDia ? `, ${totalDia} actividades` : ''}`
                        : 'Dia fuera del mes visible'
                    }
                    className={cn(
                      'relative flex min-h-[76px] flex-col items-center border-b border-r border-regla px-1 py-2 text-center transition-all duration-200 ease-out sm:min-h-[104px] sm:items-start sm:px-2.5 sm:text-left',
                      (indice + 1) % 7 === 0 && 'border-r-0',
                      esMes ? 'bg-superficie' : 'bg-lienzo/55',
                      elegida &&
                        'z-[1] bg-pizarra-tenue ring-1 ring-inset ring-pizarra',
                      esMes && !elegida && 'hover:bg-lienzo hover:shadow-inner',
                      !esMes && 'cursor-default bg-lienzo/35',
                    )}
                  >
                    {esMes && (
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full font-dato text-[11px] transition-all duration-200',
                          'text-tinta',
                          esHoy && 'bg-pizarra text-white shadow-sm',
                        )}
                      >
                        {dia.getDate()}
                      </span>
                    )}
                    {esMes && cantidad > 0 && (
                      <span className="mt-1.5 flex w-full min-w-0 items-center gap-1.5 sm:mt-auto">
                        <span
                          className={cn(
                            'h-2 w-2 shrink-0 rounded-full',
                            resumen.clasePunto,
                          )}
                        />
                        <span
                          className={cn(
                            'hidden min-w-0 truncate font-dato text-[9.5px] sm:inline',
                            resumen.claseTexto,
                          )}
                        >
                          {cantidad} {cantidad === 1 ? 'tarea' : 'tareas'}
                        </span>
                      </span>
                    )}
                    {esMes && examenesDia.length > 0 && (
                      <span className="mt-1 flex w-full min-w-0 items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-pizarra-vivo ring-1 ring-pizarra-fondo/20" />
                        <span className="hidden min-w-0 truncate font-dato text-[9.5px] text-pizarra sm:inline">
                          {examenesDia.length} {examenesDia.length === 1 ? 'examen' : 'exámenes'}
                        </span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Ficha>

        <aside className="min-w-0 xl:sticky xl:top-32">
          <Ficha className="overflow-hidden">
            <div className="border-b border-regla px-4 py-4">
              <p className="etiqueta-dato text-pizarra">Dia seleccionado</p>
              <h2 className="mt-1 font-display text-[18px] font-bold capitalize text-tinta">
                {formatoDiaCompleto(seleccionada)}
              </h2>
            </div>

            {tareasSeleccionadas.length === 0 && evaluacionesSeleccionadas.length === 0 ? (
              <EstadoVacio
                icono={ClipboardList}
                titulo="Sin actividades"
                texto="No tienes tareas ni exámenes programados este día."
              />
            ) : (
              <ul key={claveFecha(seleccionada)} className="entrada-suave">
                {tareasSeleccionadas.map((tarea) => (
                  <li
                    key={tarea.id}
                    className={cn(
                      'border-b border-l-2 border-regla p-4 transition-colors duration-200 last:border-b-0 hover:bg-lienzo/70',
                      estadoTarea(tarea).claseBorde,
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setTareaActiva(tarea)}
                      className="group flex w-full items-start gap-3 text-left transition-transform duration-200 active:scale-[0.99]"
                    >
                      <span
                        className={cn(
                          'mt-1 h-2 w-2 shrink-0 rounded-full',
                          estadoTarea(tarea).clasePunto,
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-dato text-[10.5px] text-pizarra">
                          {tarea.cursoCodigo} · Semana {tarea.semanaNumero}
                        </span>
                        <span className="mt-1 block text-[13px] font-semibold leading-snug text-tinta group-hover:text-pizarra">
                          {tarea.titulo}
                        </span>
                        <span className="mt-1 block text-[11.5px] text-tinta-media">
                          {horaEntrega(tarea.venceEn)} · {Number(tarea.puntos)}{' '}
                          puntos
                        </span>
                        <span
                          className={cn(
                            'mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold',
                            estadoTarea(tarea).claseTexto,
                          )}
                        >
                          <IconoEstado estado={estadoTarea(tarea).tipo} />
                          {estadoTarea(tarea).etiqueta}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {evaluacionesSeleccionadas.map((evaluacion) => (
                  <li key={`examen-${evaluacion.id}`} className="border-b border-l-2 border-pizarra p-4 last:border-b-0 hover:bg-pizarra-tenue/45">
                    <Link to={`/cursos/${encodeURIComponent(evaluacion.cursoCodigo)}?seccion=examenes`} className="group flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-pizarra-tenue text-pizarra"><FileQuestion size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-dato text-[10.5px] text-pizarra">{evaluacion.cursoCodigo} · Examen</span>
                        <span className="mt-1 block text-[13px] font-semibold text-tinta group-hover:text-pizarra">{evaluacion.titulo}</span>
                        <span className="mt-1 block text-[11.5px] text-tinta-media">Abre {fechaEvaluacion(evaluacion.abreEn)} · {evaluacion.duracionMinutos} min</span>
                        <span className={cn('mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold', evaluacion.intento?.estado === 'calificado' ? 'text-exito' : 'text-pizarra')}>
                          {evaluacion.intento?.estado === 'calificado' ? <CheckCircle2 size={13} /> : <AlarmClock size={13} />}
                          {evaluacion.intento?.estado === 'calificado' ? `Calificado: ${Number(evaluacion.intento.calificacion)} / ${Number(evaluacion.puntosTotal)}` : evaluacion.intento?.estado === 'enviado' ? 'En revisión' : 'Ver examen'}
                        </span>
                      </span>
                      <ArrowRight size={14} className="mt-1 text-tinta-suave group-hover:text-pizarra" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Ficha>
        </aside>
      </div>

      {tareaDetalle && (
        <DetalleTarea
          tarea={tareaDetalle}
          abierto={Boolean(tareaActiva)}
          alCerrar={() => setTareaActiva(null)}
          alEntregar={() => abrirEntrega(tareaDetalle)}
        />
      )}

      {tareaEntrega && (
        <EntregaTarea
          tarea={tareaEntrega}
          abierto={Boolean(entregaActiva)}
          alCerrar={() => setEntregaActiva(null)}
          alEnviada={() => void despuesDeEnviar()}
        />
      )}
    </div>
  )
}

function DetalleTarea({
  tarea,
  abierto,
  alCerrar,
  alEntregar,
}: {
  tarea: TareaCalendario
  abierto: boolean
  alCerrar: () => void
  alEntregar: () => void
}) {
  const entrega = tarea.entrega
  const calificada =
    entrega?.calificacion !== null && entrega?.calificacion !== undefined
  const estado = estadoTarea(tarea)

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={tarea.titulo}
      ancho="lg"
      pie={
        <>
          <Link
            to={`/cursos/${encodeURIComponent(tarea.cursoCodigo)}`}
            className="mr-auto inline-flex h-8 items-center gap-1.5 px-1 text-[12px] font-semibold text-pizarra hover:underline"
          >
            Abrir aula <ArrowRight size={13} />
          </Link>
          <Boton tamano="sm" variante="fantasma" onClick={alCerrar}>
            Cerrar
          </Boton>
          {!calificada && (
            <Boton
              tamano="sm"
              variante="primario"
              iconoIzq={<FileUp size={14} />}
              onClick={alEntregar}
            >
              {entrega ? 'Actualizar entrega' : 'Agregar entrega'}
            </Boton>
          )}
        </>
      }
    >
      <div
        className={cn(
          '-mx-5 -mt-5 border-b px-5 py-5',
          estado.claseCabecera,
        )}
      >
        <p className={cn('etiqueta-dato', estado.claseTexto)}>
          {estado.etiquetaEstado}
        </p>
        <h3 className="mt-2 font-display text-[24px] font-bold leading-tight text-tinta">
          {tarea.titulo}
        </h3>
      </div>

      <div className="max-h-[58vh] overflow-y-auto pr-2">
        <div className="grid gap-3 border-b border-regla py-4 sm:grid-cols-3">
          <DatoDetalle etiqueta="Cierre" valor={fechaTarea(tarea.venceEn)} />
          <DatoDetalle etiqueta="Puntos" valor={`${Number(tarea.puntos)}`} />
          <DatoDetalle
            etiqueta="Estado"
            valor={estado.etiqueta}
            claseValor={estado.claseTexto}
            icono={<IconoEstado estado={estado.tipo} />}
          />
        </div>

        <div className="py-5">
          <p className="font-dato text-[11px] text-pizarra">
            {tarea.cursoCodigo} · {tarea.cursoNombre}
          </p>
          <p className="mt-1 text-[12.5px] text-tinta-media">
            Semana {tarea.semanaNumero}: {tarea.semanaTitulo}
          </p>
        </div>

        <section className="border-t border-regla py-5">
          <h4 className="text-[13px] font-semibold text-tinta">
            Instrucciones
          </h4>
          {tarea.instrucciones ? (
            <p className="mt-3 whitespace-pre-line text-[14px] leading-7 text-tinta">
              {tarea.instrucciones}
            </p>
          ) : (
            <p className="mt-3 text-[13px] text-tinta-suave">
              Esta tarea no tiene instrucciones adicionales.
            </p>
          )}
          {tarea.archivoNombre && <ArchivoTarea tarea={tarea} />}
        </section>

        {entrega && (
          <section className="border-t border-regla py-5">
            <div className="border-l-2 border-exito bg-exito-tenue px-3 py-3">
            <h4 className="flex items-center gap-2 text-[13px] font-semibold text-exito">
              <CheckCircle2 size={15} /> Tu entrega
            </h4>
            <p className="mt-2 text-[12.5px] text-tinta-media">
              Enviada el {fechaEntrega(entrega.entregadoEn)}
            </p>
            {entrega.comentario && (
              <p className="mt-3 whitespace-pre-line border-l-2 border-pizarra bg-lienzo px-3 py-2.5 text-[13px] leading-6 text-tinta-media">
                {entrega.comentario}
              </p>
            )}
            {entrega.archivoNombre && (
              <ArchivoEntrega entregaId={entrega.id} entrega={entrega} />
            )}
            {calificada && (
              <div className="mt-4 border border-pizarra/20 bg-pizarra-tenue px-3 py-3">
                <p className="etiqueta-dato text-pizarra">Calificacion</p>
                <p className="mt-1 font-dato text-[18px] font-semibold text-tinta">
                  {Number(entrega.calificacion)} / {Number(tarea.puntos)}
                </p>
                {entrega.retroalimentacion && (
                  <p className="mt-2 whitespace-pre-line text-[12.5px] leading-6 text-tinta-media">
                    {entrega.retroalimentacion}
                  </p>
                )}
              </div>
            )}
            </div>
          </section>
        )}
      </div>
    </Dialogo>
  )
}

function EntregaTarea({
  tarea,
  abierto,
  alCerrar,
  alEnviada,
}: {
  tarea: TareaCalendario
  abierto: boolean
  alCerrar: () => void
  alEnviada: () => void
}) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [comentario, setComentario] = useState(tarea.entrega?.comentario ?? '')
  const guardado = useGuardar()

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const cuerpo = new FormData()
    if (archivo) cuerpo.append('archivo', archivo)
    if (comentario.trim()) cuerpo.append('comentario', comentario.trim())
    const resultado = await guardado.guardar(() =>
      pedir<RespuestaAula>(`/aulas/tareas/${tarea.id}/entrega`, {
        metodo: 'POST',
        cuerpo,
      }),
    )
    if (resultado) {
      setArchivo(null)
      alEnviada()
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Agregar entrega"
      descripcion={tarea.titulo}
      ancho="lg"
    >
      <form onSubmit={(evento) => void enviar(evento)} className="space-y-6">
        <div className="border-b border-regla pb-4">
          <p className="etiqueta-dato text-pizarra">
            {tarea.cursoCodigo} · Semana {tarea.semanaNumero}
          </p>
          <h3 className="mt-2 font-display text-[24px] font-bold text-tinta">
            {tarea.titulo}
          </h3>
          <p className="mt-2 flex items-center gap-2 text-[13px] text-tinta-media">
            <CalendarClock size={15} /> Cierre: {fechaTarea(tarea.venceEn)}
          </p>
        </div>

        <section className="grid gap-3 md:grid-cols-[190px_minmax(0,1fr)]">
          <div>
            <h4 className="text-[14px] font-semibold text-tinta">
              Archivos enviados
            </h4>
            <p className="mt-1 text-[12px] leading-5 text-tinta-suave">
              Maximo 20 MB, un archivo por envio.
            </p>
          </div>
          <div className="min-w-0 overflow-hidden rounded-sm border border-regla">
            <div className="flex items-center justify-between border-b border-regla bg-lienzo px-3 py-2">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-pizarra">
                <FileText size={15} /> Archivos
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Vista de lista"
                  aria-label="Vista de lista"
                  className="flex h-7 w-7 items-center justify-center rounded-sm bg-tinta-media text-white"
                >
                  <List size={14} />
                </button>
                <label
                  title="Seleccionar archivo"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm bg-tinta-media text-white hover:bg-pizarra"
                >
                  <Upload size={14} />
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.zip"
                    onChange={(evento) =>
                      setArchivo(evento.target.files?.[0] ?? null)
                    }
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
            <label className="m-3 flex min-h-[150px] cursor-pointer flex-col items-center justify-center border border-dashed border-regla-fuerte bg-superficie px-4 py-5 text-center hover:border-pizarra">
              <Upload size={42} strokeWidth={1.5} className="text-tinta-suave" />
              <span className="mt-4 text-[14px] font-medium text-tinta">
                {archivo
                  ? archivo.name
                  : tarea.entrega?.archivoNombre ??
                    'Puede arrastrar y soltar archivos aqui para anadirlos'}
              </span>
              <span className="mt-1 font-dato text-[11px] text-tinta-suave">
                {archivo
                  ? tamanoArchivo(archivo.size)
                  : tarea.entrega?.archivoTamano !== null &&
                      tarea.entrega?.archivoTamano !== undefined
                    ? tamanoArchivo(tarea.entrega.archivoTamano)
                    : 'PDF, Office, imagen, texto o ZIP'}
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.zip"
                onChange={(evento) =>
                  setArchivo(evento.target.files?.[0] ?? null)
                }
                className="sr-only"
              />
            </label>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-[190px_minmax(0,1fr)]">
          <div>
            <h4 className="text-[14px] font-semibold text-tinta">
              Texto en linea
            </h4>
            <p className="mt-1 text-[12px] leading-5 text-tinta-suave">
              Respuesta breve o nota para el instructor.
            </p>
          </div>
          <div className="min-w-0 overflow-hidden rounded-sm border border-regla bg-superficie">
            <div className="flex flex-wrap items-center gap-1 border-b border-regla bg-lienzo px-3 py-2">
              <button
                type="button"
                title="Negrita"
                aria-label="Negrita"
                className="flex h-8 w-8 items-center justify-center rounded-sm text-tinta-media hover:bg-superficie hover:text-tinta"
              >
                <Bold size={16} />
              </button>
              <button
                type="button"
                title="Titulo grande"
                aria-label="Titulo grande"
                className="flex h-8 w-8 items-center justify-center rounded-sm text-tinta-media hover:bg-superficie hover:text-tinta"
              >
                <Heading1 size={16} />
              </button>
              <button
                type="button"
                title="Titulo mediano"
                aria-label="Titulo mediano"
                className="flex h-8 w-8 items-center justify-center rounded-sm text-tinta-media hover:bg-superficie hover:text-tinta"
              >
                <Heading2 size={16} />
              </button>
            </div>
            <textarea
              value={comentario}
              onChange={(evento) => setComentario(evento.target.value)}
              rows={9}
              maxLength={8000}
              placeholder="Escribe aqui tu respuesta."
              className="block min-h-[220px] w-full resize-y border-0 bg-superficie px-4 py-4 text-[14px] leading-7 text-tinta focus:outline-none"
            />
          </div>
        </section>

        {guardado.error && (
          <p className="border border-correccion/30 bg-correccion-tenue px-3 py-2 text-[12.5px] text-correccion">
            {guardado.error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-regla pt-4">
          <Boton
            type="button"
            tamano="sm"
            variante="fantasma"
            iconoIzq={<X size={14} />}
            onClick={alCerrar}
          >
            Cancelar
          </Boton>
          <Boton
            type="submit"
            tamano="sm"
            variante="primario"
            iconoIzq={<Send size={14} />}
            disabled={guardado.guardando || (!archivo && !comentario.trim())}
          >
            {guardado.guardando
              ? 'Enviando...'
              : tarea.entrega
                ? 'Actualizar entrega'
                : 'Guardar cambios'}
          </Boton>
        </div>
      </form>
    </Dialogo>
  )
}

function DatoDetalle({
  etiqueta,
  valor,
  claseValor,
  icono,
}: {
  etiqueta: string
  valor: string
  claseValor?: string
  icono?: ReactNode
}) {
  return (
    <div className="border-l-2 border-regla px-3">
      <p className="etiqueta-dato text-tinta-suave">{etiqueta}</p>
      <p
        className={cn(
          'mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-tinta',
          claseValor,
        )}
      >
        {icono}
        {valor}
      </p>
    </div>
  )
}

type TipoEstadoTarea = 'pendiente' | 'enviada' | 'calificada' | 'vencida'

function estadoTarea(tarea: TareaCalendario) {
  const calificada =
    tarea.entrega?.calificacion !== null &&
    tarea.entrega?.calificacion !== undefined

  if (calificada) {
    return {
      tipo: 'calificada' as const,
      etiqueta: 'Calificada',
      etiquetaEstado: 'Tarea calificada',
      clasePunto: 'bg-exito',
      claseTexto: 'text-exito',
      claseBorde: 'border-l-exito',
      claseCabecera: 'border-exito/20 bg-exito-tenue',
    }
  }

  if (tarea.entrega) {
    return {
      tipo: 'enviada' as const,
      etiqueta: 'Enviada',
      etiquetaEstado: 'Entrega registrada',
      clasePunto: 'bg-exito',
      claseTexto: 'text-exito',
      claseBorde: 'border-l-exito',
      claseCabecera: 'border-exito/20 bg-exito-tenue',
    }
  }

  if (new Date(tarea.venceEn).getTime() < Date.now()) {
    return {
      tipo: 'vencida' as const,
      etiqueta: 'Vencida',
      etiquetaEstado: 'Fecha limite vencida',
      clasePunto: 'bg-correccion',
      claseTexto: 'text-correccion',
      claseBorde: 'border-l-correccion',
      claseCabecera: 'border-correccion/20 bg-correccion-tenue',
    }
  }

  return {
    tipo: 'pendiente' as const,
    etiqueta: 'Pendiente',
    etiquetaEstado: 'Vencimiento de tarea',
    clasePunto: 'bg-entrega',
    claseTexto: 'text-entrega',
    claseBorde: 'border-l-entrega',
    claseCabecera: 'border-entrega/20 bg-entrega-tenue',
  }
}

function estadoResumen(tareas: TareaCalendario[]) {
  const estados = tareas.map((tarea) => estadoTarea(tarea))
  return (
    estados.find((estado) => estado.tipo === 'vencida') ??
    estados.find((estado) => estado.tipo === 'pendiente') ??
    estados[0] ?? {
      clasePunto: 'bg-entrega',
      claseTexto: 'text-entrega',
    }
  )
}

function IconoEstado({ estado }: { estado: TipoEstadoTarea }) {
  return estado === 'enviada' || estado === 'calificada' ? (
    <CheckCircle2 size={13} />
  ) : estado === 'vencida' ? (
    <CalendarClock size={13} />
  ) : (
    <FileUp size={13} />
  )
}

function LeyendaEstado({ clase, texto }: { clase: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-full', clase)} />
      {texto}
    </span>
  )
}

function ArchivoEntrega({
  entregaId,
  entrega,
}: {
  entregaId: string
  entrega: NonNullable<TareaCalendario['entrega']>
}) {
  const [error, setError] = useState<string | null>(null)

  async function descargar() {
    setError(null)
    try {
      const blob = await pedirArchivo(`/aulas/entregas/${entregaId}/archivo`)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = entrega.archivoNombre ?? 'entrega'
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar.')
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void descargar()}
        className="flex max-w-full items-center gap-2 text-[12.5px] font-semibold text-pizarra hover:underline"
      >
        <Download size={14} />
        <span className="min-w-0 truncate">{entrega.archivoNombre}</span>
        {entrega.archivoTamano !== null && (
          <span className="shrink-0 font-normal text-tinta-suave">
            {tamanoArchivo(entrega.archivoTamano)}
          </span>
        )}
      </button>
      {error && <p className="mt-2 text-[11.5px] text-correccion">{error}</p>}
    </div>
  )
}

function ArchivoTarea({ tarea }: { tarea: TareaCalendario }) {
  const [error, setError] = useState<string | null>(null)

  async function descargar() {
    if (!tarea.archivoNombre) return
    setError(null)
    try {
      const blob = await pedirArchivo(`/aulas/tareas/${tarea.id}/archivo`)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = tarea.archivoNombre
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar.')
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => void descargar()}
        className="flex max-w-full items-center gap-2 text-[12.5px] font-semibold text-pizarra hover:underline"
      >
        <Download size={14} />
        <span className="min-w-0 truncate">{tarea.archivoNombre}</span>
        {tarea.archivoTamano !== null && (
          <span className="shrink-0 font-normal text-tinta-suave">
            {tamanoArchivo(tarea.archivoTamano)}
          </span>
        )}
      </button>
      {error && <p className="mt-2 text-[11.5px] text-correccion">{error}</p>}
    </div>
  )
}





function horaEntrega(iso: string): string {
  return new Intl.DateTimeFormat('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

function fechaEntrega(iso: string): string {
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
