import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  EyeOff,
  FileQuestion,
  ListChecks,
  Plus,
  Send,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import type { Curso } from '../admin/catalogo'
import { pedir } from '../datos/api'
import { useConsulta, useGuardar } from '../datos/consulta'
import { Boton } from '../ui/Boton'
import { cn } from '../ui/cn'
import { Dialogo } from '../ui/Dialogo'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Etiqueta } from '../ui/Etiqueta'
import { Ficha } from '../ui/Ficha'
import {
  estadoEvaluacion,
  fechaEvaluacion,
  type EvaluacionResumen,
  type IntentoEvaluacion,
  type PreguntaIntento,
  type RespuestaEvaluacionesCurso,
  type RespuestaIntento,
  type RespuestaIntentosDocente,
  type RespuestaPregunta,
  type TipoPregunta,
} from './evaluaciones'

const nombresTipo: Record<TipoPregunta, string> = {
  seleccion_unica: 'Selección única',
  seleccion_multiple: 'Selección múltiple',
  verdadero_falso: 'Verdadero o falso',
  respuesta_libre: 'Respuesta abierta',
}

const claseCampo =
  'h-10 w-full border border-regla-fuerte bg-superficie px-3 text-[13px] text-tinta focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15'

export function EvaluacionesCurso({ curso, esDocente }: { curso: Curso; esDocente: boolean }) {
  const consulta = useConsulta<RespuestaEvaluacionesCurso>(`/evaluaciones/curso/${curso.id}`)
  const [creando, setCreando] = useState(false)
  const [resolviendo, setResolviendo] = useState<IntentoEvaluacion | null>(null)

  if (consulta.cargando) return <div className="h-72 animate-pulse border border-regla bg-superficie" />
  if (consulta.error) {
    return <Ficha><EstadoVacio icono={FileQuestion} titulo="No se pudieron cargar los exámenes" texto={consulta.error} accion={<Boton tamano="sm" onClick={() => void consulta.recargar()}>Reintentar</Boton>} /></Ficha>
  }

  const evaluaciones = consulta.datos?.evaluaciones ?? []

  async function iniciar(evaluacion: EvaluacionResumen) {
    const respuesta = await pedir<RespuestaIntento>(`/evaluaciones/${evaluacion.id}/iniciar`, { metodo: 'POST' })
    setResolviendo(respuesta.intento)
  }

  async function verResultado(evaluacion: EvaluacionResumen) {
    if (!evaluacion.intento) return
    const respuesta = await pedir<RespuestaIntento>(
      `/evaluaciones/intentos/${evaluacion.intento.id}/resultado`,
    )
    setResolviendo(respuesta.intento)
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-regla pb-4">
        <div>
          <p className="etiqueta-dato text-pizarra">Evaluación en línea</p>
          <h2 className="mt-1 font-display text-[22px] font-bold text-tinta">Exámenes</h2>
          <p className="mt-1.5 text-[13px] text-tinta-media">
            {esDocente ? 'Programa, publica y califica evaluaciones del curso.' : 'Consulta tus exámenes, intentos y calificaciones.'}
          </p>
        </div>
        {esDocente && <Boton variante="primario" tamano="sm" iconoIzq={<Plus size={14} />} onClick={() => setCreando(true)}>Crear examen</Boton>}
      </header>

      {evaluaciones.length === 0 ? (
        <Ficha><EstadoVacio icono={ClipboardCheck} titulo={esDocente ? 'Todavía no hay exámenes' : 'No tienes exámenes publicados'} texto={esDocente ? 'Crea una evaluación con fecha, duración y preguntas calificables.' : 'Los exámenes aparecerán aquí cuando el instructor los publique.'} accion={esDocente ? <Boton variante="primario" tamano="sm" onClick={() => setCreando(true)}>Crear el primero</Boton> : undefined} /></Ficha>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {evaluaciones.map((evaluacion) => esDocente ? (
            <TarjetaDocente key={evaluacion.id} evaluacion={evaluacion} alActualizar={consulta.fijar} />
          ) : (
            <TarjetaEstudiante
              key={evaluacion.id}
              evaluacion={evaluacion}
              alIniciar={() => void iniciar(evaluacion)}
              alVerResultado={() => void verResultado(evaluacion)}
            />
          ))}
        </div>
      )}

      <Dialogo abierto={creando} alCerrar={() => setCreando(false)} titulo="Crear examen" descripcion={curso.nombre} ancho="lg">
        <EditorEvaluacion cursoId={curso.id} alCancelar={() => setCreando(false)} alListo={(respuesta) => { consulta.fijar(respuesta); setCreando(false) }} />
      </Dialogo>

      {resolviendo && (
        <ResolverEvaluacion
          intentoInicial={resolviendo}
          alCerrar={() => { setResolviendo(null); void consulta.recargar() }}
          alActualizar={setResolviendo}
        />
      )}
    </div>
  )
}

function TarjetaDocente({ evaluacion, alActualizar }: { evaluacion: EvaluacionResumen; alActualizar: (r: RespuestaEvaluacionesCurso) => void }) {
  const accion = useGuardar()
  const [revisando, setRevisando] = useState(false)
  const estado = estadoEvaluacion(evaluacion)

  async function publicar() {
    const respuesta = await accion.guardar(() => pedir<RespuestaEvaluacionesCurso>(`/evaluaciones/${evaluacion.id}/publicacion`, { metodo: 'PATCH', cuerpo: { publicada: !evaluacion.publicada } }))
    if (respuesta) alActualizar(respuesta)
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar ${evaluacion.titulo}?`)) return
    const respuesta = await accion.guardar(() => pedir<RespuestaEvaluacionesCurso>(`/evaluaciones/${evaluacion.id}`, { metodo: 'DELETE' }))
    if (respuesta) alActualizar(respuesta)
  }

  return (
    <article className="flex flex-col border border-regla bg-superficie">
      <div className="flex items-start gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-pizarra-tenue text-pizarra"><FileQuestion size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="text-[15px] font-bold text-tinta">{evaluacion.titulo}</h3><p className="mt-1 text-[11.5px] text-tinta-suave">{evaluacion.cantidadPreguntas} preguntas · {Number(evaluacion.puntosTotal)} puntos</p></div>
            <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
          </div>
          <div className="mt-4 grid gap-2 text-[11.5px] text-tinta-media sm:grid-cols-2">
            <Dato icono={<Clock3 size={13} />} texto={`Abre: ${fechaEvaluacion(evaluacion.abreEn)}`} />
            <Dato icono={<AlarmClock size={13} />} texto={`${evaluacion.duracionMinutos} min · ${evaluacion.intentosPermitidos} intento${evaluacion.intentosPermitidos === 1 ? '' : 's'}`} />
            <Dato icono={<X size={13} />} texto={`Cierra: ${fechaEvaluacion(evaluacion.cierraEn)}`} />
            <Dato icono={<UsersRound size={13} />} texto={`${evaluacion.cantidadIntentos} intento${evaluacion.cantidadIntentos === 1 ? '' : 's'} recibido${evaluacion.cantidadIntentos === 1 ? '' : 's'}`} />
          </div>
        </div>
      </div>
      {accion.error && <p className="mx-5 mb-3 border border-correccion/25 bg-correccion-tenue px-3 py-2 text-[11.5px] text-correccion">{accion.error}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-regla bg-lienzo/45 px-4 py-3">
        <Boton tamano="sm" variante="fantasma" iconoIzq={<UsersRound size={14} />} onClick={() => setRevisando(true)}>Intentos</Boton>
        <Boton tamano="sm" variante="fantasma" iconoIzq={evaluacion.publicada ? <EyeOff size={14} /> : <Eye size={14} />} disabled={accion.guardando} onClick={() => void publicar()}>{evaluacion.publicada ? 'Ocultar' : 'Publicar'}</Boton>
        <button type="button" title="Eliminar" aria-label={`Eliminar ${evaluacion.titulo}`} disabled={accion.guardando || evaluacion.cantidadIntentos > 0} onClick={() => void eliminar()} className="ml-auto flex h-8 w-8 items-center justify-center text-tinta-suave hover:bg-correccion-tenue hover:text-correccion disabled:cursor-not-allowed disabled:opacity-35"><Trash2 size={14} /></button>
      </div>
      <Dialogo abierto={revisando} alCerrar={() => setRevisando(false)} titulo="Intentos y calificaciones" descripcion={evaluacion.titulo} ancho="lg">
        <RevisionIntentos evaluacionId={evaluacion.id} />
      </Dialogo>
    </article>
  )
}

function TarjetaEstudiante({
  evaluacion,
  alIniciar,
  alVerResultado,
}: {
  evaluacion: EvaluacionResumen
  alIniciar: () => void
  alVerResultado: () => void
}) {
  const estado = estadoEvaluacion(evaluacion)
  const intento = evaluacion.intento
  const abierta = estado.texto === 'Abierto'
  const quedanIntentos = evaluacion.cantidadIntentos < evaluacion.intentosPermitidos
  const puedeEntrar = abierta && (intento?.estado === 'en_progreso' || quedanIntentos)
  const tieneResultado = Boolean(intento && intento.estado !== 'en_progreso')
  const textoAccion = intento?.estado === 'en_progreso'
    ? 'Continuar'
    : !quedanIntentos
      ? 'Intentos agotados'
      : intento
        ? 'Nuevo intento'
        : 'Comenzar'
  return (
    <article className="flex flex-col border border-regla bg-superficie p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-pizarra-tenue text-pizarra"><FileQuestion size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-[15px] font-bold text-tinta">{evaluacion.titulo}</h3><Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta></div>
          {evaluacion.instrucciones && <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-tinta-media">{evaluacion.instrucciones}</p>}
          <div className="mt-4 grid gap-2 text-[11.5px] text-tinta-media sm:grid-cols-2">
            <Dato icono={<Clock3 size={13} />} texto={`${evaluacion.duracionMinutos} minutos`} />
            <Dato icono={<ListChecks size={13} />} texto={`${evaluacion.cantidadPreguntas} preguntas · ${Number(evaluacion.puntosTotal)} pts`} />
            <Dato icono={<AlarmClock size={13} />} texto={`Abre ${fechaEvaluacion(evaluacion.abreEn)}`} />
            <Dato icono={<X size={13} />} texto={`Cierra ${fechaEvaluacion(evaluacion.cierraEn)}`} />
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-regla pt-4">
        {intento?.estado === 'calificado' ? <span className="flex items-center gap-2 font-dato text-[13px] font-semibold text-exito"><CheckCircle2 size={16} /> {Number(intento.calificacion)} / {Number(evaluacion.puntosTotal)}</span> : intento?.estado === 'enviado' ? <span className="text-[12px] font-semibold text-aviso">Pendiente de revisión</span> : <span className="text-[11.5px] text-tinta-suave">{evaluacion.cantidadIntentos} de {evaluacion.intentosPermitidos} intentos usados</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {tieneResultado && (
            <Boton
              tamano="sm"
              variante="fantasma"
              iconoIzq={<Eye size={14} />}
              onClick={alVerResultado}
            >
              Ver resultado
            </Boton>
          )}
          <Boton
            tamano="sm"
            variante={puedeEntrar ? 'primario' : 'secundario'}
            disabled={!puedeEntrar}
            iconoDer={<ArrowRight size={14} />}
            onClick={alIniciar}
          >
            {textoAccion}
          </Boton>
        </div>
      </div>
    </article>
  )
}

type OpcionBorrador = { id: string; texto: string; correcta: boolean }
type PreguntaBorrador = {
  id: string
  tipo: TipoPregunta
  enunciado: string
  explicacion: string
  puntos: number
  opciones: OpcionBorrador[]
  respuestaVerdadera: boolean
}

function clave() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function nuevaPregunta(tipo: TipoPregunta = 'seleccion_unica'): PreguntaBorrador {
  return {
    id: clave(), tipo, enunciado: '', explicacion: '', puntos: 10,
    opciones: [{ id: clave(), texto: '', correcta: true }, { id: clave(), texto: '', correcta: false }],
    respuestaVerdadera: true,
  }
}

function fechaLocal(fecha: Date) {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function EditorEvaluacion({ cursoId, alCancelar, alListo }: { cursoId: string; alCancelar: () => void; alListo: (r: RespuestaEvaluacionesCurso) => void }) {
  const ahora = new Date()
  const [titulo, setTitulo] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [abreEn, setAbreEn] = useState(fechaLocal(new Date(ahora.getTime() + 60 * 60_000)))
  const [cierraEn, setCierraEn] = useState(fechaLocal(new Date(ahora.getTime() + 8 * 24 * 60 * 60_000)))
  const [duracion, setDuracion] = useState(60)
  const [intentos, setIntentos] = useState(1)
  const [barajar, setBarajar] = useState(false)
  const [mostrar, setMostrar] = useState(true)
  const [publicada, setPublicada] = useState(false)
  const [preguntas, setPreguntas] = useState<PreguntaBorrador[]>([nuevaPregunta()])
  const guardado = useGuardar()
  const total = preguntas.reduce((suma, pregunta) => suma + Number(pregunta.puntos || 0), 0)

  function actualizar(id: string, cambios: Partial<PreguntaBorrador>) {
    setPreguntas((actuales) => actuales.map((pregunta) => pregunta.id === id ? { ...pregunta, ...cambios } : pregunta))
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const respuesta = await guardado.guardar(() => pedir<RespuestaEvaluacionesCurso>(`/evaluaciones/curso/${cursoId}`, {
      metodo: 'POST',
      cuerpo: {
        titulo, instrucciones, abreEn: new Date(abreEn).toISOString(), cierraEn: new Date(cierraEn).toISOString(),
        duracionMinutos: duracion, intentosPermitidos: intentos, barajarPreguntas: barajar,
        mostrarResultados: mostrar, publicada,
        preguntas: preguntas.map(({ tipo, enunciado, explicacion, puntos, opciones, respuestaVerdadera }) => ({
          tipo, enunciado, explicacion, puntos: Number(puntos), obligatoria: true,
          ...(tipo === 'seleccion_unica' || tipo === 'seleccion_multiple'
            ? { opciones: opciones.map(({ texto, correcta }) => ({ texto, correcta })) }
            : {}),
          ...(tipo === 'verdadero_falso' ? { respuestaVerdadera } : {}),
        })),
      },
    }))
    if (respuesta) alListo(respuesta)
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><EtiquetaCampo>Nombre del examen</EtiquetaCampo><input value={titulo} onChange={(e) => setTitulo(e.target.value)} minLength={2} maxLength={180} required placeholder="Ej. Parcial de fundamentos" className={claseCampo} /></label>
        <label className="sm:col-span-2"><EtiquetaCampo>Instrucciones</EtiquetaCampo><textarea value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} rows={3} maxLength={8000} placeholder="Indicaciones antes de comenzar" className="w-full border border-regla-fuerte bg-superficie px-3 py-2 text-[13px] focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15" /></label>
        <label><EtiquetaCampo>Apertura</EtiquetaCampo><input type="datetime-local" value={abreEn} onChange={(e) => setAbreEn(e.target.value)} required className={claseCampo} /></label>
        <label><EtiquetaCampo>Cierre</EtiquetaCampo><input type="datetime-local" value={cierraEn} onChange={(e) => setCierraEn(e.target.value)} required className={claseCampo} /></label>
        <label><EtiquetaCampo>Tiempo límite (minutos)</EtiquetaCampo><input type="number" min={1} max={480} value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} required className={claseCampo} /></label>
        <label><EtiquetaCampo>Intentos permitidos</EtiquetaCampo><input type="number" min={1} max={10} value={intentos} onChange={(e) => setIntentos(Number(e.target.value))} required className={claseCampo} /></label>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-regla pb-3"><div><h3 className="text-[14px] font-bold text-tinta">Preguntas</h3><p className="mt-1 text-[11.5px] text-tinta-suave">{preguntas.length} preguntas · {total} puntos</p></div><Boton type="button" tamano="sm" iconoIzq={<Plus size={14} />} onClick={() => setPreguntas((actuales) => [...actuales, nuevaPregunta()])}>Añadir pregunta</Boton></div>
        <div className="mt-4 space-y-4">
          {preguntas.map((pregunta, indice) => <EditorPregunta key={pregunta.id} pregunta={pregunta} indice={indice} alCambiar={(cambios) => actualizar(pregunta.id, cambios)} alEliminar={() => setPreguntas((actuales) => actuales.filter((item) => item.id !== pregunta.id))} />)}
        </div>
      </section>

      <section className="grid gap-3 border border-regla bg-lienzo p-4 sm:grid-cols-3">
        <OpcionConfiguracion texto="Barajar preguntas" activa={barajar} alCambiar={setBarajar} />
        <OpcionConfiguracion texto="Mostrar respuestas correctas" activa={mostrar} alCambiar={setMostrar} />
        <OpcionConfiguracion texto="Publicar al guardar" activa={publicada} alCambiar={setPublicada} />
      </section>

      {guardado.error && <p className="border border-correccion/30 bg-correccion-tenue px-3 py-2 text-[12px] text-correccion">{guardado.error}</p>}
      <div className="flex justify-end gap-2 border-t border-regla pt-4"><Boton type="button" variante="fantasma" tamano="sm" onClick={alCancelar}>Cancelar</Boton><Boton type="submit" variante="primario" tamano="sm" disabled={guardado.guardando || preguntas.length === 0}>{guardado.guardando ? 'Creando…' : 'Crear examen'}</Boton></div>
    </form>
  )
}

function EditorPregunta({ pregunta, indice, alCambiar, alEliminar }: { pregunta: PreguntaBorrador; indice: number; alCambiar: (c: Partial<PreguntaBorrador>) => void; alEliminar: () => void }) {
  function cambiarTipo(tipo: TipoPregunta) {
    alCambiar({ tipo, opciones: tipo.startsWith('seleccion') && pregunta.opciones.length < 2 ? nuevaPregunta(tipo).opciones : pregunta.opciones })
  }
  function cambiarOpcion(id: string, cambios: Partial<OpcionBorrador>) {
    let opciones = pregunta.opciones.map((opcion) => opcion.id === id ? { ...opcion, ...cambios } : opcion)
    if (cambios.correcta && pregunta.tipo === 'seleccion_unica') opciones = opciones.map((opcion) => ({ ...opcion, correcta: opcion.id === id }))
    alCambiar({ opciones })
  }
  return (
    <article className="border border-regla bg-superficie">
      <header className="flex flex-wrap items-center gap-3 border-b border-regla bg-lienzo/60 px-4 py-3"><span className="flex h-7 w-7 items-center justify-center bg-pizarra text-[11px] font-bold text-white">{indice + 1}</span><select value={pregunta.tipo} onChange={(e) => cambiarTipo(e.target.value as TipoPregunta)} className="h-8 border border-regla-fuerte bg-superficie px-2 text-[12px] text-tinta focus:border-pizarra focus:outline-none">{Object.entries(nombresTipo).map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}</select><label className="ml-auto flex items-center gap-2 text-[11.5px] text-tinta-media">Puntos<input type="number" min={0.01} max={10000} step="0.01" value={pregunta.puntos} onChange={(e) => alCambiar({ puntos: Number(e.target.value) })} className="h-8 w-20 border border-regla-fuerte px-2 font-dato text-[12px]" /></label><button type="button" title="Eliminar pregunta" onClick={alEliminar} className="flex h-8 w-8 items-center justify-center text-tinta-suave hover:bg-correccion-tenue hover:text-correccion"><Trash2 size={14} /></button></header>
      <div className="space-y-4 p-4"><label><EtiquetaCampo>Enunciado</EtiquetaCampo><textarea value={pregunta.enunciado} onChange={(e) => alCambiar({ enunciado: e.target.value })} required minLength={2} rows={2} placeholder="Escribe la pregunta" className="w-full border border-regla-fuerte px-3 py-2 text-[13px] focus:border-pizarra focus:outline-none" /></label>
        {(pregunta.tipo === 'seleccion_unica' || pregunta.tipo === 'seleccion_multiple') && <div><EtiquetaCampo>Opciones · marca la respuesta correcta</EtiquetaCampo><div className="space-y-2">{pregunta.opciones.map((opcion) => <div key={opcion.id} className="flex items-center gap-2"><input type={pregunta.tipo === 'seleccion_unica' ? 'radio' : 'checkbox'} name={`correcta-${pregunta.id}`} checked={opcion.correcta} onChange={(e) => cambiarOpcion(opcion.id, { correcta: e.target.checked })} className="h-4 w-4 accent-pizarra" /><input value={opcion.texto} onChange={(e) => cambiarOpcion(opcion.id, { texto: e.target.value })} required placeholder="Texto de la opción" className={cn(claseCampo, 'h-9 flex-1')} /><button type="button" disabled={pregunta.opciones.length <= 2} onClick={() => alCambiar({ opciones: pregunta.opciones.filter((item) => item.id !== opcion.id) })} className="flex h-8 w-8 items-center justify-center text-tinta-suave hover:text-correccion disabled:opacity-25"><X size={14} /></button></div>)}</div><button type="button" onClick={() => alCambiar({ opciones: [...pregunta.opciones, { id: clave(), texto: '', correcta: false }] })} className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-pizarra"><Plus size={13} />Añadir opción</button></div>}
        {pregunta.tipo === 'verdadero_falso' && <div><EtiquetaCampo>Respuesta correcta</EtiquetaCampo><div className="flex gap-2">{[true, false].map((valor) => <button key={String(valor)} type="button" onClick={() => alCambiar({ respuestaVerdadera: valor })} className={cn('flex h-9 items-center gap-2 border px-4 text-[12px] font-semibold', pregunta.respuestaVerdadera === valor ? 'border-pizarra bg-pizarra-tenue text-pizarra' : 'border-regla-fuerte text-tinta-media')}><span className={cn('h-3 w-3 rounded-full border', pregunta.respuestaVerdadera === valor && 'border-pizarra bg-pizarra')} />{valor ? 'Verdadero' : 'Falso'}</button>)}</div></div>}
        <label><EtiquetaCampo>Explicación al terminar (opcional)</EtiquetaCampo><textarea value={pregunta.explicacion} onChange={(e) => alCambiar({ explicacion: e.target.value })} rows={2} placeholder="Aclara por qué esa es la respuesta" className="w-full border border-regla-fuerte px-3 py-2 text-[12.5px] focus:border-pizarra focus:outline-none" /></label>
      </div>
    </article>
  )
}

function ResolverEvaluacion({ intentoInicial, alCerrar, alActualizar }: { intentoInicial: IntentoEvaluacion; alCerrar: () => void; alActualizar: (i: IntentoEvaluacion) => void }) {
  const [intento, setIntento] = useState(intentoInicial)
  const [indice, setIndice] = useState(0)
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaPregunta>>(() => Object.fromEntries(intentoInicial.preguntas.map((pregunta) => [pregunta.id, pregunta.respuesta ?? {}])))
  const [restante, setRestante] = useState(() => Math.max(0, Math.floor((new Date(intentoInicial.expiraEn).getTime() - Date.now()) / 1000)))
  const guardado = useGuardar()
  const pregunta = intento.preguntas[indice]
  const terminado = intento.estado !== 'en_progreso'
  const enviarRef = useRef(enviar)
  enviarRef.current = enviar

  useEffect(() => {
    if (terminado) return
    const reloj = window.setInterval(() => setRestante(Math.max(0, Math.floor((new Date(intento.expiraEn).getTime() - Date.now()) / 1000))), 1000)
    return () => window.clearInterval(reloj)
  }, [intento.expiraEn, terminado])

  useEffect(() => {
    if (terminado) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [terminado])

  useEffect(() => {
    if (restante !== 0 || terminado || guardado.guardando) return
    void enviarRef.current(false)
  }, [restante, terminado, guardado.guardando])

  async function guardarRespuesta(ids?: string[]) {
    const preguntas = ids ?? [pregunta.id]
    const resultado = await guardado.guardar(() => pedir<RespuestaIntento>(`/evaluaciones/intentos/${intento.id}/respuestas`, { metodo: 'PATCH', cuerpo: { respuestas: preguntas.map((preguntaId) => ({ preguntaId, respuesta: respuestas[preguntaId] ?? {} })) } }))
    if (resultado) { setIntento(resultado.intento); alActualizar(resultado.intento) }
    return Boolean(resultado)
  }

  async function siguiente() {
    if (await guardarRespuesta()) setIndice((actual) => Math.min(intento.preguntas.length - 1, actual + 1))
  }

  async function enviar(confirmar = true) {
    if (confirmar && !window.confirm('¿Enviar el examen? Después no podrás cambiar este intento.')) return
    const ids = intento.preguntas.map((item) => item.id)
    if (!(await guardarRespuesta(ids))) return
    const resultado = await guardado.guardar(() => pedir<RespuestaIntento>(`/evaluaciones/intentos/${intento.id}/enviar`, { metodo: 'POST' }))
    if (resultado) { setIntento(resultado.intento); alActualizar(resultado.intento) }
  }

  function cambiar(respuesta: RespuestaPregunta) {
    setRespuestas((actuales) => ({ ...actuales, [pregunta.id]: respuesta }))
  }

  return (
    <Dialogo abierto alCerrar={() => { if (terminado || window.confirm('Tu respuesta actual se guardará al continuar. ¿Salir del examen?')) alCerrar() }} titulo={intento.titulo} descripcion={`Intento ${intento.numero} · ${Number(intento.puntosTotal)} puntos`} ancho="lg">
      {terminado ? <ResultadoIntento intento={intento} /> : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border border-regla bg-lienzo px-4 py-3"><div className="flex items-center gap-2 text-[12px] text-tinta-media"><ListChecks size={15} className="text-pizarra" />Pregunta {indice + 1} de {intento.preguntas.length}</div><span className={cn('flex items-center gap-2 font-dato text-[14px] font-semibold', restante < 300 ? 'text-correccion' : 'text-tinta')}><AlarmClock size={16} />{reloj(restante)}</span></div>
          <div className="h-1.5 overflow-hidden bg-regla"><div className="h-full bg-pizarra transition-all" style={{ width: `${((indice + 1) / intento.preguntas.length) * 100}%` }} /></div>
          <PreguntaEstudiante pregunta={pregunta} respuesta={respuestas[pregunta.id] ?? {}} alCambiar={cambiar} />
          {guardado.error && <p className="border border-correccion/30 bg-correccion-tenue px-3 py-2 text-[12px] text-correccion">{guardado.error}</p>}
          <div className="flex flex-wrap items-center gap-2 border-t border-regla pt-4"><Boton variante="fantasma" tamano="sm" iconoIzq={<ArrowLeft size={14} />} disabled={indice === 0 || guardado.guardando} onClick={() => setIndice((actual) => actual - 1)}>Anterior</Boton><span className="mx-auto text-[11px] text-tinta-suave">Las respuestas se guardan al avanzar</span>{indice < intento.preguntas.length - 1 ? <Boton variante="primario" tamano="sm" iconoDer={<ArrowRight size={14} />} disabled={guardado.guardando} onClick={() => void siguiente()}>{guardado.guardando ? 'Guardando…' : 'Guardar y seguir'}</Boton> : <Boton variante="primario" tamano="sm" iconoDer={<Send size={14} />} disabled={guardado.guardando} onClick={() => void enviar()}>{guardado.guardando ? 'Enviando…' : 'Enviar examen'}</Boton>}</div>
        </div>
      )}
    </Dialogo>
  )
}

function PreguntaEstudiante({ pregunta, respuesta, alCambiar }: { pregunta: PreguntaIntento; respuesta: RespuestaPregunta; alCambiar: (r: RespuestaPregunta) => void }) {
  const seleccionadas = respuesta.opciones ?? []
  return <section><div className="flex items-start justify-between gap-4"><div><p className="etiqueta-dato text-pizarra">{nombresTipo[pregunta.tipo]}</p><h3 className="mt-2 text-[17px] font-semibold leading-7 text-tinta">{pregunta.enunciado}</h3></div><span className="shrink-0 font-dato text-[11px] text-tinta-suave">{Number(pregunta.puntos)} pts</span></div>
    {(pregunta.tipo === 'seleccion_unica' || pregunta.tipo === 'seleccion_multiple') && <div className="mt-5 space-y-2">{pregunta.opciones.map((opcion) => { const activa = seleccionadas.includes(opcion.id); return <label key={opcion.id} className={cn('flex cursor-pointer items-center gap-3 border px-4 py-3 text-[13px]', activa ? 'border-pizarra bg-pizarra-tenue text-tinta' : 'border-regla-fuerte hover:border-pizarra/50')}><input type={pregunta.tipo === 'seleccion_unica' ? 'radio' : 'checkbox'} name={`pregunta-${pregunta.id}`} checked={activa} onChange={(e) => { const opciones = pregunta.tipo === 'seleccion_unica' ? [opcion.id] : e.target.checked ? [...seleccionadas, opcion.id] : seleccionadas.filter((id) => id !== opcion.id); alCambiar({ opciones }) }} className="h-4 w-4 accent-pizarra" />{opcion.texto}</label> })}</div>}
    {pregunta.tipo === 'verdadero_falso' && <div className="mt-5 grid grid-cols-2 gap-3">{[true, false].map((valor) => <button key={String(valor)} type="button" onClick={() => alCambiar({ valor })} className={cn('flex h-14 items-center justify-center gap-2 border text-[13px] font-semibold', respuesta.valor === valor ? 'border-pizarra bg-pizarra-tenue text-pizarra' : 'border-regla-fuerte text-tinta-media')}><span className={cn('h-3 w-3 rounded-full border', respuesta.valor === valor && 'border-pizarra bg-pizarra')} />{valor ? 'Verdadero' : 'Falso'}</button>)}</div>}
    {pregunta.tipo === 'respuesta_libre' && <textarea value={respuesta.texto ?? ''} onChange={(e) => alCambiar({ texto: e.target.value })} rows={9} maxLength={20000} placeholder="Escribe tu respuesta" className="mt-5 w-full border border-regla-fuerte px-4 py-3 text-[13px] leading-6 focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15" />}
  </section>
}

function ResultadoIntento({ intento }: { intento: IntentoEvaluacion }) {
  const pendiente = intento.estado === 'enviado'
  return <div className="space-y-5"><div className={cn('border p-5', pendiente ? 'border-aviso/25 bg-aviso-tenue' : 'border-exito/25 bg-exito-tenue')}><div className="flex items-center gap-3">{pendiente ? <Clock3 className="text-aviso" /> : <CheckCircle2 className="text-exito" />}<div><h3 className="text-[16px] font-bold text-tinta">{pendiente ? 'Enviado para revisión' : 'Examen calificado'}</h3><p className="mt-1 text-[12.5px] text-tinta-media">{pendiente ? 'El docente debe revisar tus respuestas abiertas.' : `Resultado: ${Number(intento.calificacion)} de ${Number(intento.puntosTotal)} puntos.`}</p></div></div></div>
    {intento.preguntas.some((pregunta) => pregunta.puntosObtenidos !== undefined) && <div className="divide-y divide-regla border-y border-regla">{intento.preguntas.map((pregunta, indice) => <div key={pregunta.id} className="flex items-start gap-3 py-3"><span className="font-dato text-[11px] text-tinta-suave">{indice + 1}</span><div className="min-w-0 flex-1"><p className="text-[12.5px] font-medium text-tinta">{pregunta.enunciado}</p>{pregunta.comentarioDocente && <p className="mt-1 text-[11.5px] text-tinta-media">{pregunta.comentarioDocente}</p>}</div><span className="font-dato text-[11.5px] font-semibold text-tinta">{pregunta.puntosObtenidos === null || pregunta.puntosObtenidos === undefined ? 'Pendiente' : `${Number(pregunta.puntosObtenidos)} / ${Number(pregunta.puntos)}`}</span></div>)}</div>}
  </div>
}

function RevisionIntentos({ evaluacionId }: { evaluacionId: string }) {
  const consulta = useConsulta<RespuestaIntentosDocente>(`/evaluaciones/${evaluacionId}/intentos`)
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  if (consulta.cargando) return <div className="h-48 animate-pulse bg-lienzo" />
  if (consulta.error) return <p className="text-[13px] text-correccion">{consulta.error}</p>
  if (!consulta.datos?.intentos.length) return <EstadoVacio icono={UsersRound} titulo="Aún no hay intentos" texto="Los envíos de estudiantes aparecerán aquí." />
  if (seleccionado) return <DetalleIntentoDocente intentoId={seleccionado} alVolver={() => setSeleccionado(null)} />
  return <div className="divide-y divide-regla border-y border-regla">{consulta.datos.intentos.map((intento) => <button key={intento.id} type="button" onClick={() => setSeleccionado(intento.id)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-lienzo"><span className="flex h-8 w-8 items-center justify-center bg-pizarra-tenue font-dato text-[11px] text-pizarra">{intento.numero}</span><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-tinta">{intento.estudiante}</p><p className="mt-0.5 text-[11px] text-tinta-suave">{intento.matricula ?? 'Sin matrícula'} · {intento.enviadoEn ? fechaEvaluacion(intento.enviadoEn) : 'En progreso'}</p></div>{intento.estado === 'calificado' ? <span className="font-dato text-[12px] font-semibold text-exito">{Number(intento.calificacion)} / {Number(consulta.datos!.evaluacion.puntosTotal)}</span> : <Etiqueta tono="aviso">{intento.estado === 'enviado' ? 'Revisar' : 'En progreso'}</Etiqueta>}<ArrowRight size={14} className="text-tinta-suave" /></button>)}</div>
}

function DetalleIntentoDocente({ intentoId, alVolver }: { intentoId: string; alVolver: () => void }) {
  const consulta = useConsulta<RespuestaIntento>(`/evaluaciones/intentos/${intentoId}`)
  if (consulta.cargando) return <div className="h-56 animate-pulse bg-lienzo" />
  if (consulta.error || !consulta.datos) return <p className="text-[13px] text-correccion">{consulta.error ?? 'No se pudo abrir el intento.'}</p>
  const intento = consulta.datos.intento
  return <div className="space-y-4"><button type="button" onClick={alVolver} className="flex items-center gap-2 text-[12px] font-semibold text-pizarra"><ArrowLeft size={14} />Volver a intentos</button><div className="flex items-center justify-between border-y border-regla py-3"><div><p className="text-[13px] font-semibold text-tinta">Intento {intento.numero}</p><p className="text-[11px] text-tinta-suave">{intento.estado === 'calificado' ? 'Calificado' : 'Pendiente de revisión'}</p></div>{intento.calificacion !== null && <span className="font-dato text-[15px] font-semibold text-exito">{Number(intento.calificacion)} / {Number(intento.puntosTotal)}</span>}</div><div className="space-y-3">{intento.preguntas.map((pregunta, indice) => <RespuestaRevision key={pregunta.id} pregunta={pregunta} indice={indice} alActualizar={consulta.fijar} />)}</div></div>
}

function RespuestaRevision({ pregunta, indice, alActualizar }: { pregunta: PreguntaIntento; indice: number; alActualizar: (r: RespuestaIntento) => void }) {
  const [puntos, setPuntos] = useState(Number(pregunta.puntosObtenidos ?? 0))
  const [comentario, setComentario] = useState(pregunta.comentarioDocente ?? '')
  const guardado = useGuardar()
  const abierta = pregunta.tipo === 'respuesta_libre'
  async function calificar() {
    if (!pregunta.respuestaId) return
    const respuesta = await guardado.guardar(() => pedir<RespuestaIntento>(`/evaluaciones/respuestas/${pregunta.respuestaId}/calificacion`, { metodo: 'PATCH', cuerpo: { puntos, comentario } }))
    if (respuesta) alActualizar(respuesta)
  }
  return <article className="border border-regla p-4"><div className="flex items-start gap-3"><span className="font-dato text-[11px] text-pizarra">{indice + 1}</span><div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-tinta">{pregunta.enunciado}</p><p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-6 text-tinta-media">{textoRespuesta(pregunta)}</p></div><span className="font-dato text-[11px] text-tinta-suave">{Number(pregunta.puntos)} pts</span></div>{abierta && pregunta.respuestaId && <div className="mt-4 grid gap-3 border-t border-regla pt-3 sm:grid-cols-[110px_1fr_auto]"><label><EtiquetaCampo>Puntos</EtiquetaCampo><input type="number" min={0} max={Number(pregunta.puntos)} step="0.01" value={puntos} onChange={(e) => setPuntos(Number(e.target.value))} className={claseCampo} /></label><label><EtiquetaCampo>Comentario</EtiquetaCampo><input value={comentario} onChange={(e) => setComentario(e.target.value)} className={claseCampo} placeholder="Retroalimentación" /></label><Boton className="self-end" tamano="sm" variante="primario" disabled={guardado.guardando} onClick={() => void calificar()}>{guardado.guardando ? 'Guardando…' : 'Calificar'}</Boton></div>}{guardado.error && <p className="mt-2 text-[11.5px] text-correccion">{guardado.error}</p>}</article>
}

function textoRespuesta(pregunta: PreguntaIntento) {
  if (pregunta.tipo === 'respuesta_libre') return pregunta.respuesta.texto || 'Sin respuesta'
  if (pregunta.tipo === 'verdadero_falso') return pregunta.respuesta.valor === undefined ? 'Sin respuesta' : pregunta.respuesta.valor ? 'Verdadero' : 'Falso'
  const ids = pregunta.respuesta.opciones ?? []
  return pregunta.opciones.filter((opcion) => ids.includes(opcion.id)).map((opcion) => opcion.texto).join(', ') || 'Sin respuesta'
}

function OpcionConfiguracion({ texto, activa, alCambiar }: { texto: string; activa: boolean; alCambiar: (v: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-tinta"><input type="checkbox" checked={activa} onChange={(e) => alCambiar(e.target.checked)} className="h-4 w-4 accent-pizarra" />{texto}</label>
}

function EtiquetaCampo({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wide text-tinta-media">{children}</span>
}

function Dato({ icono, texto }: { icono: React.ReactNode; texto: string }) {
  return <span className="flex items-center gap-1.5">{icono}{texto}</span>
}

function reloj(segundos: number) {
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  const resto = segundos % 60
  return `${horas ? `${String(horas).padStart(2, '0')}:` : ''}${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
}
