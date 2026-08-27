import { useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  EyeOff,
  FileQuestion,
  Video,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useConsulta } from '../datos/consulta'
import { Boton } from '../ui/Boton'
import { cn } from '../ui/cn'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Etiqueta } from '../ui/Etiqueta'
import { Ficha } from '../ui/Ficha'
import {
  DIAS_REJILLA,
  claveFecha,
  formatoDiaCompleto,
  horaCorta,
  inicioDia,
  rangoCalendario,
} from './calendario'
import type { RespuestaAgendaDocente } from './docencia'

/*
  El calendario de quien imparte.

  Mira los mismos dias que el del estudiante y cuenta lo contrario: no "que
  tengo que entregar" sino "que tengo que preparar y que tengo que corregir".
  Por eso cada evento trae su contador -3/12 entregas, 5 sin calificar- y por eso
  aparecen tambien las tareas y evaluaciones sin publicar, que para el estudiante
  no existen todavia pero para quien las escribe son la mitad del trabajo.

  Un examen ocupa dos dias en la rejilla, el que abre y el que cierra, porque son
  dos momentos distintos de vigilar y separarlos evita la duda de si la fecha que
  se ve es el principio o el final.
*/

type TipoEvento = 'tarea' | 'examen-abre' | 'examen-cierra' | 'clase'

type Evento = {
  clave: string
  tipo: TipoEvento
  fecha: Date
  titulo: string
  cursoCodigo: string
  cursoNombre: string
  publicada: boolean
  detalle: string
  /* Algo que exige una accion de quien imparte: entregas o intentos sin nota. */
  pendiente: number
}

const ASPECTO: Record<
  TipoEvento,
  { punto: string; icono: typeof ClipboardList; nombre: string }
> = {
  tarea: { punto: 'bg-entrega', icono: ClipboardList, nombre: 'Tarea' },
  'examen-abre': { punto: 'bg-pizarra', icono: FileQuestion, nombre: 'Abre examen' },
  'examen-cierra': { punto: 'bg-correccion', icono: FileQuestion, nombre: 'Cierra examen' },
  clase: { punto: 'bg-exito', icono: Video, nombre: 'Clase en vivo' },
}

export function CalendarioDocente() {
  const hoy = inicioDia(new Date())
  const [mesVisible, setMesVisible] = useState(
    new Date(hoy.getFullYear(), hoy.getMonth(), 1),
  )
  const [seleccionada, setSeleccionada] = useState(hoy)

  const rango = useMemo(() => rangoCalendario(mesVisible), [mesVisible])
  const ruta = useMemo(
    () =>
      `/docencia/agenda?desde=${encodeURIComponent(rango.desde.toISOString())}&hasta=${encodeURIComponent(rango.hasta.toISOString())}`,
    [rango],
  )
  const consulta = useConsulta<RespuestaAgendaDocente>(ruta)

  const eventos = useMemo(
    () => construirEventos(consulta.datos, rango.desde, rango.hasta),
    [consulta.datos, rango],
  )

  const porDia = useMemo(() => {
    const mapa = new Map<string, Evento[]>()
    for (const evento of eventos) {
      const clave = claveFecha(evento.fecha)
      const lista = mapa.get(clave)
      if (lista) lista.push(evento)
      else mapa.set(clave, [evento])
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
    }
    return mapa
  }, [eventos])

  const delDia = porDia.get(claveFecha(seleccionada)) ?? []
  const porCalificar = eventos.reduce((total, evento) => total + evento.pendiente, 0)

  function moverMes(salto: number) {
    const siguiente = new Date(
      mesVisible.getFullYear(),
      mesVisible.getMonth() + salto,
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-regla pb-5">
        <div>
          <p className="etiqueta-dato text-pizarra">Tu agenda docente</p>
          <h1 className="mt-1 font-display text-[30px] font-bold leading-tight text-tinta">
            Calendario
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-tinta-media">
            Cierres de tareas, ventanas de examen y clases en vivo de los cursos que
            impartes. Incluye lo que aún no has publicado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-tinta-media">
          <Leyenda clase="bg-entrega" texto="Tarea" />
          <Leyenda clase="bg-pizarra" texto="Abre examen" />
          <Leyenda clase="bg-correccion" texto="Cierra examen" />
          <Leyenda clase="bg-exito" texto="Clase" />
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

          {consulta.cargando ? (
            <div className="h-[480px] animate-pulse bg-lienzo/60" />
          ) : consulta.error ? (
            <EstadoVacio
              icono={CalendarDays}
              titulo="No se pudo cargar la agenda"
              texto={consulta.error}
              accion={
                <Boton tamano="sm" onClick={() => void consulta.recargar()}>
                  Reintentar
                </Boton>
              }
            />
          ) : (
            <div className="grid grid-cols-7">
              {rango.dias.map((dia, indice) => {
                const clave = claveFecha(dia)
                const delDiaRejilla = porDia.get(clave) ?? []
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
                        ? `${formatoDiaCompleto(dia)}${delDiaRejilla.length ? `, ${delDiaRejilla.length} eventos` : ''}`
                        : 'Dia fuera del mes visible'
                    }
                    className={cn(
                      'relative flex min-h-[76px] flex-col items-center border-b border-r border-regla px-1 py-2 text-center transition-all duration-200 ease-out sm:min-h-[104px] sm:items-start sm:px-2.5 sm:text-left',
                      (indice + 1) % 7 === 0 && 'border-r-0',
                      esMes ? 'bg-superficie' : 'bg-lienzo/55',
                      elegida && 'z-[1] bg-pizarra-tenue ring-1 ring-inset ring-pizarra',
                      esMes && !elegida && 'hover:bg-lienzo hover:shadow-inner',
                      !esMes && 'cursor-default bg-lienzo/35',
                    )}
                  >
                    {esMes && (
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full font-dato text-[11px] text-tinta transition-all duration-200',
                          esHoy && 'bg-pizarra text-white shadow-sm',
                        )}
                      >
                        {dia.getDate()}
                      </span>
                    )}

                    {esMes && delDiaRejilla.length > 0 && (
                      <span className="mt-1.5 flex w-full min-w-0 flex-col gap-1 sm:mt-auto">
                        {/* Dos como mucho: la celda de un dia cargado tiene que
                            seguir siendo legible, y el resto esta a un clic. */}
                        {delDiaRejilla.slice(0, 2).map((evento) => (
                          <span
                            key={evento.clave}
                            className="flex w-full min-w-0 items-center gap-1.5"
                          >
                            <span
                              className={cn(
                                'h-2 w-2 shrink-0 rounded-full',
                                ASPECTO[evento.tipo].punto,
                                !evento.publicada && 'opacity-40',
                              )}
                            />
                            <span className="hidden min-w-0 flex-1 truncate text-[11px] text-tinta-media sm:block">
                              {evento.titulo}
                            </span>
                          </span>
                        ))}
                        {delDiaRejilla.length > 2 && (
                          <span className="hidden text-[10.5px] text-tinta-suave sm:block">
                            +{delDiaRejilla.length - 2} más
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Ficha>

        <div className="space-y-4">
          {porCalificar > 0 && (
            <Ficha className="border-aviso/30 bg-aviso-tenue p-4">
              <p className="text-[13px] text-tinta">
                <span className="font-dato font-semibold">{porCalificar}</span>{' '}
                {porCalificar === 1 ? 'entrega o intento' : 'entregas e intentos'} sin
                calificar este mes.
              </p>
            </Ficha>
          )}

          <Ficha>
            <header className="border-b border-regla px-5 py-3.5">
              <h2 className="font-display text-[15px] font-semibold capitalize text-tinta">
                {formatoDiaCompleto(seleccionada)}
              </h2>
              <p className="mt-0.5 text-[13px] text-tinta-media">
                {delDia.length === 0
                  ? 'Nada programado este día.'
                  : `${delDia.length} ${delDia.length === 1 ? 'evento' : 'eventos'}`}
              </p>
            </header>

            {delDia.length === 0 ? (
              <EstadoVacio
                icono={CalendarDays}
                titulo="Día despejado"
                texto="Elige otro día en el calendario para ver lo que tienes programado."
              />
            ) : (
              <div className="divide-y divide-regla">
                {delDia.map((evento) => (
                  <TarjetaEvento key={evento.clave} evento={evento} />
                ))}
              </div>
            )}
          </Ficha>
        </div>
      </div>
    </div>
  )
}

function TarjetaEvento({ evento }: { evento: Evento }) {
  const aspecto = ASPECTO[evento.tipo]
  const Icono = aspecto.icono

  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-regla bg-lienzo text-tinta-media',
          !evento.publicada && 'opacity-60',
        )}
      >
        <Icono size={15} strokeWidth={1.5} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', aspecto.punto)} />
          <span className="etiqueta-dato text-tinta-suave">{aspecto.nombre}</span>
          <span className="font-dato text-[12px] text-tinta-media">
            {horaCorta(evento.fecha.toISOString())}
          </span>
          {!evento.publicada && (
            <Etiqueta tono="neutro" icono={<EyeOff size={11} />}>
              Sin publicar
            </Etiqueta>
          )}
          {evento.pendiente > 0 && (
            <Etiqueta tono="aviso">{evento.pendiente} sin calificar</Etiqueta>
          )}
        </div>

        <p className="mt-1 font-medium leading-snug text-tinta">{evento.titulo}</p>
        <p className="mt-0.5 text-[12.5px] text-tinta-media">{evento.detalle}</p>
        <Link
          to={`/cursos/${encodeURIComponent(evento.cursoCodigo)}`}
          className="mt-1.5 inline-block font-dato text-[12px] text-pizarra hover:underline"
        >
          {evento.cursoCodigo} · {evento.cursoNombre}
        </Link>
      </div>
    </div>
  )
}

function Leyenda({ clase, texto }: { clase: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', clase)} />
      {texto}
    </span>
  )
}

// ---------------------------------------------------------------------------
/*
  Las tres listas del API se aplanan en una sola de eventos con fecha local.

  El filtro por rango se repite aqui aunque el servidor ya lo aplique: una
  evaluacion que abre antes del mes y cierra dentro llega entera -hace falta para
  pintar su cierre-, y sin este filtro su apertura se colaria en el primer dia de
  la rejilla, que no es donde ocurre.
*/
function construirEventos(
  datos: RespuestaAgendaDocente | null,
  desde: Date,
  hasta: Date,
): Evento[] {
  if (!datos) return []
  const eventos: Evento[] = []
  const dentro = (fecha: Date) => fecha >= desde && fecha < hasta

  for (const tarea of datos.tareas) {
    const fecha = new Date(tarea.venceEn)
    if (!dentro(fecha)) continue
    eventos.push({
      clave: `tarea-${tarea.id}`,
      tipo: 'tarea',
      fecha,
      titulo: tarea.titulo,
      cursoCodigo: tarea.cursoCodigo,
      cursoNombre: tarea.cursoNombre,
      publicada: tarea.publicada,
      detalle: `${tarea.entregas} de ${tarea.estudiantes} entregas · ${tarea.puntos} puntos`,
      pendiente: tarea.porCalificar,
    })
  }

  for (const examen of datos.evaluaciones) {
    const abre = new Date(examen.abreEn)
    const cierra = new Date(examen.cierraEn)
    const detalle = `${examen.intentos} de ${examen.estudiantes} intentos`

    if (dentro(abre)) {
      eventos.push({
        clave: `abre-${examen.id}`,
        tipo: 'examen-abre',
        fecha: abre,
        titulo: examen.titulo,
        cursoCodigo: examen.cursoCodigo,
        cursoNombre: examen.cursoNombre,
        publicada: examen.publicada,
        detalle: `Se abre · cierra el ${new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short' }).format(cierra)}`,
        pendiente: 0,
      })
    }
    if (dentro(cierra)) {
      eventos.push({
        clave: `cierra-${examen.id}`,
        tipo: 'examen-cierra',
        fecha: cierra,
        titulo: examen.titulo,
        cursoCodigo: examen.cursoCodigo,
        cursoNombre: examen.cursoNombre,
        publicada: examen.publicada,
        detalle,
        pendiente: examen.porCalificar,
      })
    }
  }

  for (const reunion of datos.reuniones) {
    const fecha = new Date(reunion.programadaPara)
    if (!dentro(fecha)) continue
    eventos.push({
      clave: `clase-${reunion.id}`,
      tipo: 'clase',
      fecha,
      titulo: reunion.titulo,
      cursoCodigo: reunion.cursoCodigo,
      cursoNombre: reunion.cursoNombre,
      // Una clase en vivo no se publica ni se deja en borrador: o esta
      // programada o no existe. Nunca se dibuja atenuada.
      publicada: true,
      detalle:
        reunion.estado === 'cancelada'
          ? 'Cancelada'
          : `${reunion.duracionMinutos} min · ${reunion.asistentes} asistentes`,
      pendiente: 0,
    })
  }

  return eventos
}
