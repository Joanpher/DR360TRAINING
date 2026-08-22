import { useEffect, useState, type FormEvent } from 'react'
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import type { Curso } from '../admin/catalogo'
import { pedir, pedirArchivo } from '../datos/api'
import { useConsulta, useGuardar } from '../datos/consulta'
import { Boton } from '../ui/Boton'
import { cn } from '../ui/cn'
import { Dialogo } from '../ui/Dialogo'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Etiqueta } from '../ui/Etiqueta'
import { Ficha } from '../ui/Ficha'
import {
  fechaTarea,
  tamanoArchivo,
  type MaterialAula,
  type RespuestaAula,
  type RespuestaEntregas,
  type SemanaAula,
  type TareaAula,
  type EntregaDetalle,
} from './aula'

type Editor = { semanaId: string; tipo: 'material' | 'tarea' } | null

export function AulaCurso({ curso }: { curso: Curso }) {
  const consulta = useConsulta<RespuestaAula>(`/aulas/curso/${curso.id}`)
  const accion = useGuardar()
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())
  const [editor, setEditor] = useState<Editor>(null)
  const [editandoSemana, setEditandoSemana] = useState<string | null>(null)

  useEffect(() => {
    const primera = consulta.datos?.aula?.semanas[0]?.id
    if (primera) setAbiertas((actuales) => actuales.size ? actuales : new Set([primera]))
  }, [consulta.datos?.aula?.semanas])

  async function operar(operacion: () => Promise<RespuestaAula>) {
    const resultado = await accion.guardar(operacion)
    if (resultado) consulta.fijar(resultado)
    return resultado
  }

  if (consulta.cargando) return <div className="h-80 animate-pulse rounded-md bg-superficie" />

  if (consulta.error) {
    return <Ficha><EstadoVacio icono={BookOpen} titulo="No se pudo cargar el aula" texto={consulta.error} accion={<Boton tamano="sm" onClick={() => void consulta.recargar()}>Reintentar</Boton>} /></Ficha>
  }

  const aula = consulta.datos?.aula
  if (!aula) {
    return (
      <Ficha>
        <EstadoVacio
          icono={BookOpen}
          titulo="Este curso todavía no tiene aula virtual"
          texto={`Al crearla se organizará automáticamente en ${curso.duracionSemanas ?? 1} ${curso.duracionSemanas === 1 ? 'semana' : 'semanas'}.`}
          accion={<Boton variante="primario" iconoIzq={<Plus size={15} />} disabled={accion.guardando} onClick={() => void operar(() => pedir<RespuestaAula>(`/aulas/curso/${curso.id}`, { metodo: 'POST', cuerpo: {} }))}>{accion.guardando ? 'Creando…' : 'Crear aula virtual'}</Boton>}
        />
        {accion.error && <p className="border-t border-regla px-5 py-3 text-[13px] text-correccion">{accion.error}</p>}
      </Ficha>
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-regla pb-4">
        <div>
          <p className="etiqueta-dato text-pizarra">Aula virtual</p>
          <h2 className="mt-1 font-display text-[22px] font-bold text-tinta">{aula.titulo}</h2>
          <p className="mt-1.5 text-[13px] text-tinta-media">{aula.semanas.length} secciones · organiza materiales y tareas por semana</p>
        </div>
        <Boton tamano="sm" iconoIzq={<Plus size={14} />} disabled={accion.guardando} onClick={() => void operar(() => pedir<RespuestaAula>(`/aulas/${aula.id}/semanas`, { metodo: 'POST', cuerpo: {} }))}>Añadir semana</Boton>
      </header>

      {accion.error && <p className="rounded-sm border border-correccion/30 bg-correccion-tenue px-4 py-3 text-[13px] text-correccion">{accion.error}</p>}

      <div className="space-y-3">
        {aula.semanas.map((semana) => {
          const abierta = abiertas.has(semana.id)
          return (
            <section key={semana.id} className="overflow-hidden rounded-md border border-regla bg-superficie">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <button type="button" onClick={() => setAbiertas((actuales) => cambiarSet(actuales, semana.id))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-pizarra-tenue font-dato text-[12px] font-semibold text-pizarra">{semana.numero}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-tinta">{semana.titulo}</span><span className="mt-0.5 block text-[11.5px] text-tinta-suave">{semana.materiales.length} materiales · {semana.tareas.length} tareas</span></span>
                  {!semana.publicada && <Etiqueta tono="neutro">Oculta</Etiqueta>}
                  <ChevronDown size={17} className={cn('shrink-0 text-tinta-suave transition-transform', abierta && 'rotate-180')} />
                </button>
                <div className="flex items-center gap-1 border-l border-regla pl-2">
                  <button type="button" title="Editar semana" aria-label="Editar semana" onClick={() => { setAbiertas((a) => new Set(a).add(semana.id)); setEditandoSemana(semana.id) }} className="flex h-8 w-8 items-center justify-center rounded-sm text-tinta-suave hover:bg-lienzo hover:text-tinta"><Pencil size={14} /></button>
                  <button type="button" title={semana.publicada ? 'Ocultar semana' : 'Publicar semana'} aria-label={semana.publicada ? 'Ocultar semana' : 'Publicar semana'} disabled={accion.guardando} onClick={() => void operar(() => pedir<RespuestaAula>(`/aulas/semanas/${semana.id}`, { metodo: 'PATCH', cuerpo: { publicada: !semana.publicada } }))} className="flex h-8 w-8 items-center justify-center rounded-sm text-tinta-suave hover:bg-lienzo hover:text-tinta">{semana.publicada ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                </div>
              </div>

              {abierta && (
                <div className="border-t border-regla">
                  {editandoSemana === semana.id && <EditorSemana semana={semana} alCancelar={() => setEditandoSemana(null)} alGuardar={async (cuerpo) => { const resultado = await operar(() => pedir<RespuestaAula>(`/aulas/semanas/${semana.id}`, { metodo: 'PATCH', cuerpo })); if (resultado) setEditandoSemana(null) }} />}

                  {semana.descripcion && editandoSemana !== semana.id && <p className="border-b border-regla bg-lienzo/60 px-5 py-3 text-[13px] leading-relaxed text-tinta-media">{semana.descripcion}</p>}

                  <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-regla">
                    <BloqueMateriales semana={semana} editando={editor?.semanaId === semana.id && editor.tipo === 'material'} alAbrir={() => setEditor({ semanaId: semana.id, tipo: 'material' })} alCerrar={() => setEditor(null)} alActualizar={(respuesta) => consulta.fijar(respuesta)} alEliminar={(id) => void operar(() => pedir<RespuestaAula>(`/aulas/materiales/${id}`, { metodo: 'DELETE' }))} />
                    <BloqueTareas semana={semana} editando={editor?.semanaId === semana.id && editor.tipo === 'tarea'} alAbrir={() => setEditor({ semanaId: semana.id, tipo: 'tarea' })} alCerrar={() => setEditor(null)} alActualizar={(respuesta) => consulta.fijar(respuesta)} alEliminar={(id) => void operar(() => pedir<RespuestaAula>(`/aulas/tareas/${id}`, { metodo: 'DELETE' }))} />
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function BloqueMateriales({ semana, editando, alAbrir, alCerrar, alActualizar, alEliminar }: { semana: SemanaAula; editando: boolean; alAbrir: () => void; alCerrar: () => void; alActualizar: (r: RespuestaAula) => void; alEliminar: (id: string) => void }) {
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  async function descargar(material: MaterialAula) {
    setErrorDescarga(null)
    try {
      const blob = await pedirArchivo(`/aulas/materiales/${material.id}/archivo`)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = material.archivoNombre
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErrorDescarga(e instanceof Error ? e.message : 'No se pudo descargar el archivo.')
    }
  }

  return (
    <div className="min-w-0 p-4">
      <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-[13px] font-semibold text-tinta"><FileText size={15} className="text-pizarra" /> Materiales</h3><button type="button" onClick={editando ? alCerrar : alAbrir} className="flex h-8 items-center gap-1.5 rounded-sm px-2 text-[12px] font-medium text-pizarra hover:bg-pizarra-tenue">{editando ? <X size={14} /> : <Plus size={14} />}{editando ? 'Cancelar' : 'Subir'}</button></div>
      {editando && <FormularioMaterial semanaId={semana.id} alCancelar={alCerrar} alListo={(r) => { alActualizar(r); alCerrar() }} />}
      {errorDescarga && <p className="mt-3 text-[12px] text-correccion">{errorDescarga}</p>}
      {semana.materiales.length === 0 && !editando ? <p className="py-8 text-center text-[12.5px] text-tinta-suave">Sin materiales todavía.</p> : <ul className="mt-3">{semana.materiales.map((material) => <li key={material.id} className="flex items-start gap-3 border-t border-regla py-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-lienzo text-pizarra"><FileText size={15} /></span><div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-semibold text-tinta">{material.titulo}</p><p className="mt-0.5 truncate text-[11px] text-tinta-suave">{material.archivoNombre} · {tamanoArchivo(material.archivoTamano)}</p></div><button type="button" title="Descargar" aria-label={`Descargar ${material.titulo}`} onClick={() => void descargar(material)} className="flex h-7 w-7 items-center justify-center rounded-sm text-tinta-suave hover:bg-lienzo hover:text-pizarra"><Download size={14} /></button><button type="button" title="Eliminar" aria-label={`Eliminar ${material.titulo}`} onClick={() => { if (window.confirm(`¿Eliminar ${material.titulo}?`)) alEliminar(material.id) }} className="flex h-7 w-7 items-center justify-center rounded-sm text-tinta-suave hover:bg-correccion-tenue hover:text-correccion"><Trash2 size={14} /></button></li>)}</ul>}
    </div>
  )
}

function BloqueTareas({ semana, editando, alAbrir, alCerrar, alActualizar, alEliminar }: { semana: SemanaAula; editando: boolean; alAbrir: () => void; alCerrar: () => void; alActualizar: (r: RespuestaAula) => void; alEliminar: (id: string) => void }) {
  return (
    <div className="min-w-0 border-t border-regla p-4 lg:border-t-0">
      <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-[13px] font-semibold text-tinta"><ClipboardList size={15} className="text-pizarra" /> Tareas</h3><button type="button" onClick={alAbrir} className="flex h-8 items-center gap-1.5 rounded-sm px-2 text-[12px] font-medium text-pizarra hover:bg-pizarra-tenue"><Plus size={14} />Crear</button></div>
      <Dialogo abierto={editando} alCerrar={alCerrar} titulo="Crear tarea" descripcion={`Semana ${semana.numero}: ${semana.titulo}`} ancho="lg">
        <FormularioTareaDedicada semanaId={semana.id} alCancelar={alCerrar} alListo={(r) => { alActualizar(r); alCerrar() }} />
      </Dialogo>
      {semana.tareas.length === 0 && !editando ? <p className="py-8 text-center text-[12.5px] text-tinta-suave">Sin tareas todavía.</p> : <ul className="mt-3">{semana.tareas.map((tarea) => <TareaItem key={tarea.id} tarea={tarea} alEliminar={() => { if (window.confirm(`¿Eliminar ${tarea.titulo}?`)) alEliminar(tarea.id) }} />)}</ul>}
    </div>
  )
}

function TareaItem({ tarea, alEliminar }: { tarea: TareaAula; alEliminar: () => void }) {
  const [viendoEntregas, setViendoEntregas] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  async function descargarArchivoTarea() {
    if (!tarea.archivoNombre) return
    setErrorDescarga(null)
    try {
      const blob = await pedirArchivo(`/aulas/tareas/${tarea.id}/archivo`)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = tarea.archivoNombre
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setErrorDescarga(error instanceof Error ? error.message : 'No se pudo descargar el archivo de la tarea.')
    }
  }

  return (
    <li className="border-t border-regla py-3">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-aviso-tenue text-aviso">
          <ClipboardList size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-tinta">{tarea.titulo}</p>
          <p className="mt-0.5 text-[11px] text-tinta-suave">
            {fechaTarea(tarea.venceEn)} · {Number(tarea.puntos)} pts
          </p>
          {tarea.archivoNombre && (
            <button
              type="button"
              onClick={() => void descargarArchivoTarea()}
              className="mt-2 flex max-w-full items-center gap-2 text-[11.5px] font-medium text-pizarra hover:underline"
            >
              <Download size={14} />
              <span className="min-w-0 truncate">{tarea.archivoNombre}</span>
              {tarea.archivoTamano !== null && (
                <span className="shrink-0 font-normal text-tinta-suave">{tamanoArchivo(tarea.archivoTamano)}</span>
              )}
            </button>
          )}
          {errorDescarga && <p className="mt-2 text-[11.5px] text-correccion">{errorDescarga}</p>}
          <button
            type="button"
            onClick={() => setViendoEntregas((actual) => !actual)}
            className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-pizarra hover:underline"
          >
            <UsersRound size={14} />
            {tarea.cantidadEntregas} {tarea.cantidadEntregas === 1 ? 'entrega' : 'entregas'}
            <ChevronDown
              size={13}
              className={cn('transition-transform', viendoEntregas && 'rotate-180')}
            />
          </button>
        </div>
        <button
          type="button"
          title="Eliminar"
          aria-label={`Eliminar ${tarea.titulo}`}
          onClick={alEliminar}
          className="flex h-7 w-7 items-center justify-center rounded-sm text-tinta-suave hover:bg-correccion-tenue hover:text-correccion"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {viendoEntregas && <EntregasTarea tareaId={tarea.id} />}
    </li>
  )
}

export function EntregasTarea({ tareaId }: { tareaId: string }) {
  const consulta = useConsulta<RespuestaEntregas>(`/aulas/tareas/${tareaId}/entregas`)

  if (consulta.cargando) {
    return <div className="mt-3 h-24 animate-pulse rounded-sm bg-lienzo" />
  }
  if (consulta.error) {
    return (
      <p className="mt-3 border border-correccion/30 bg-correccion-tenue px-3 py-2 text-[11.5px] text-correccion">
        {consulta.error}
      </p>
    )
  }
  if (!consulta.datos || consulta.datos.entregas.length === 0) {
    return (
      <p className="mt-3 border border-regla bg-lienzo px-3 py-4 text-center text-[11.5px] text-tinta-suave">
        Ningún estudiante ha enviado esta tarea todavía.
      </p>
    )
  }

  return (
    <div className="mt-3 overflow-hidden border border-regla bg-lienzo/40">
      <div className="flex items-center justify-between gap-3 border-b border-regla px-3 py-2">
        <p className="etiqueta-dato text-tinta-media">Entregas recibidas</p>
        <span className="font-dato text-[10.5px] text-tinta-suave">
          {consulta.datos.entregas.length}
        </span>
      </div>
      <ul className="divide-y divide-regla">
        {consulta.datos.entregas.map((entrega) => (
          <EntregaInstructor
            key={entrega.id}
            entrega={entrega}
            puntos={Number(consulta.datos!.tarea.puntos)}
            alActualizar={consulta.fijar}
          />
        ))}
      </ul>
    </div>
  )
}

function EntregaInstructor({
  entrega,
  puntos,
  alActualizar,
}: {
  entrega: EntregaDetalle
  puntos: number
  alActualizar: (respuesta: RespuestaEntregas) => void
}) {
  const guardado = useGuardar()
  const [calificacion, setCalificacion] = useState(entrega.calificacion ?? '')
  const [retroalimentacion, setRetroalimentacion] = useState(
    entrega.retroalimentacion ?? '',
  )
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    const resultado = await guardado.guardar(() =>
      pedir<RespuestaEntregas>(`/aulas/entregas/${entrega.id}/calificacion`, {
        metodo: 'PATCH',
        cuerpo: {
          calificacion: Number(calificacion),
          retroalimentacion: retroalimentacion.trim() || null,
        },
      }),
    )
    if (resultado) alActualizar(resultado)
  }

  async function descargar() {
    if (!entrega.archivoNombre) return
    setErrorDescarga(null)
    try {
      const blob = await pedirArchivo(`/aulas/entregas/${entrega.id}/archivo`)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = entrega.archivoNombre
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setErrorDescarga(
        error instanceof Error
          ? error.message
          : 'No se pudo descargar la entrega.',
      )
    }
  }

  return (
    <li className="bg-superficie p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-tinta">{entrega.estudiante}</p>
          <p className="mt-0.5 font-dato text-[10.5px] text-tinta-suave">
            {entrega.matricula ?? 'Sin matrícula'} · {fechaEntrega(entrega.entregadoEn)}
          </p>
        </div>
        {entrega.calificacion !== null && (
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-pizarra">
            <CheckCircle2 size={14} /> {Number(entrega.calificacion)} / {puntos}
          </span>
        )}
      </div>

      {entrega.comentario && (
        <p className="mt-3 whitespace-pre-line border-l-2 border-regla-fuerte pl-3 text-[11.5px] leading-relaxed text-tinta-media">
          {entrega.comentario}
        </p>
      )}
      {entrega.archivoNombre && (
        <button
          type="button"
          onClick={() => void descargar()}
          className="mt-3 flex items-center gap-2 text-[11.5px] font-medium text-pizarra hover:underline"
        >
          <Download size={14} /> {entrega.archivoNombre}
          {entrega.archivoTamano !== null && (
            <span className="font-normal text-tinta-suave">
              {tamanoArchivo(entrega.archivoTamano)}
            </span>
          )}
        </button>
      )}
      {errorDescarga && (
        <p className="mt-2 text-[11.5px] text-correccion">{errorDescarga}</p>
      )}

      <form onSubmit={(evento) => void guardar(evento)} className="mt-3 grid gap-3">
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <label>
            <span className="mb-1 block text-[10px] font-semibold text-tinta-media">
              NOTA / {puntos}
            </span>
            <input
              required
              type="number"
              min="0"
              max={puntos}
              step="0.01"
              value={calificacion}
              onChange={(evento) => setCalificacion(evento.target.value)}
              className="h-9 w-full rounded-sm border border-regla-fuerte px-2 text-[12px] focus:border-pizarra focus:outline-none"
            />
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-semibold text-tinta-media">
              RETROALIMENTACIÓN
            </span>
            <input
              value={retroalimentacion}
              onChange={(evento) => setRetroalimentacion(evento.target.value)}
              maxLength={8000}
              placeholder="Comentario para el estudiante"
              className="h-9 w-full rounded-sm border border-regla-fuerte px-3 text-[12px] focus:border-pizarra focus:outline-none"
            />
          </label>
        </div>
        {guardado.error && (
          <p className="text-[11.5px] text-correccion">{guardado.error}</p>
        )}
        <div className="flex justify-end">
          <Boton
            type="submit"
            tamano="sm"
            variante="primario"
            iconoIzq={<Award size={14} />}
            disabled={guardado.guardando || calificacion === ''}
          >
            {guardado.guardando
              ? 'Guardando…'
              : entrega.calificacion === null
                ? 'Calificar'
                : 'Actualizar nota'}
          </Boton>
        </div>
      </form>
    </li>
  )
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

function FormularioMaterial({ semanaId, alCancelar, alListo }: { semanaId: string; alCancelar: () => void; alListo: (r: RespuestaAula) => void }) {
  const guardado = useGuardar()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!archivo) return
    const cuerpo = new FormData()
    cuerpo.append('archivo', archivo)
    if (titulo.trim()) cuerpo.append('titulo', titulo.trim())
    if (descripcion.trim()) cuerpo.append('descripcion', descripcion.trim())
    const resultado = await guardado.guardar(() => pedir<RespuestaAula>(`/aulas/semanas/${semanaId}/materiales`, { metodo: 'POST', cuerpo }))
    if (resultado) alListo(resultado)
  }

  return <form onSubmit={(e) => void enviar(e)} className="mt-3 space-y-3 border-t border-regla pt-3"><label className="flex cursor-pointer items-center gap-3 rounded-sm border border-dashed border-regla-fuerte bg-lienzo px-3 py-4 hover:border-pizarra"><FileUp size={20} className="text-pizarra" /><span className="min-w-0 flex-1 truncate text-[12px] text-tinta-media">{archivo ? `${archivo.name} · ${tamanoArchivo(archivo.size)}` : 'Seleccionar PDF, documento, imagen o ZIP (máx. 20 MB)'}</span><input type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.zip" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="sr-only" /></label><input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título del material (opcional)" maxLength={180} className="h-9 w-full rounded-sm border border-regla-fuerte px-3 text-[12.5px] focus:border-pizarra focus:outline-none" /><textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción breve (opcional)" rows={2} maxLength={2000} className="w-full rounded-sm border border-regla-fuerte px-3 py-2 text-[12.5px] focus:border-pizarra focus:outline-none" />{guardado.error && <p className="text-[12px] text-correccion">{guardado.error}</p>}<div className="flex justify-end gap-2"><Boton type="button" tamano="sm" variante="fantasma" onClick={alCancelar}>Cancelar</Boton><Boton type="submit" tamano="sm" variante="primario" disabled={!archivo || guardado.guardando}>{guardado.guardando ? 'Subiendo…' : 'Subir material'}</Boton></div></form>
}

function FormularioTareaDedicada({ semanaId, alCancelar, alListo }: { semanaId: string; alCancelar: () => void; alListo: (r: RespuestaAula) => void }) {
  const guardado = useGuardar()
  const [titulo, setTitulo] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [venceEn, setVenceEn] = useState('')
  const [puntos, setPuntos] = useState('100')
  const [archivo, setArchivo] = useState<File | null>(null)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const cuerpo = new FormData()
    cuerpo.append('titulo', titulo.trim())
    cuerpo.append('puntos', puntos)
    if (instrucciones.trim()) cuerpo.append('instrucciones', instrucciones.trim())
    if (venceEn) cuerpo.append('venceEn', new Date(venceEn).toISOString())
    if (archivo) cuerpo.append('archivo', archivo)
    const resultado = await guardado.guardar(() => pedir<RespuestaAula>(`/aulas/semanas/${semanaId}/tareas`, { metodo: 'POST', cuerpo }))
    if (resultado) alListo(resultado)
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="space-y-6">
      <section className="grid gap-4 md:grid-cols-[190px_minmax(0,1fr)]">
        <div>
          <h3 className="text-[14px] font-semibold text-tinta">Datos de la tarea</h3>
          <p className="mt-1 text-[12px] leading-5 text-tinta-suave">Define el nombre, la fecha limite y el valor de la actividad.</p>
        </div>
        <div className="space-y-3">
          <input required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Titulo de la tarea" minLength={2} maxLength={180} className="h-11 w-full rounded-sm border border-regla-fuerte px-3 text-[14px] font-semibold focus:border-pizarra focus:outline-none" />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <label>
              <span className="mb-1 block text-[10.5px] font-semibold text-tinta-media">FECHA LIMITE</span>
              <input type="datetime-local" value={venceEn} onChange={(e) => setVenceEn(e.target.value)} className="h-10 w-full rounded-sm border border-regla-fuerte px-2 text-[12.5px] focus:border-pizarra focus:outline-none" />
            </label>
            <label>
              <span className="mb-1 block text-[10.5px] font-semibold text-tinta-media">PUNTOS</span>
              <input required type="number" min="0" max="10000" step="0.01" value={puntos} onChange={(e) => setPuntos(e.target.value)} className="h-10 w-full rounded-sm border border-regla-fuerte px-2 text-[12.5px] focus:border-pizarra focus:outline-none" />
            </label>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[190px_minmax(0,1fr)]">
        <div>
          <h3 className="text-[14px] font-semibold text-tinta">Instrucciones</h3>
          <p className="mt-1 text-[12px] leading-5 text-tinta-suave">Texto simple para explicar que debe entregar el estudiante.</p>
        </div>
        <textarea value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} placeholder="Escribe las instrucciones de la tarea" rows={8} maxLength={8000} className="min-h-[210px] w-full rounded-sm border border-regla-fuerte px-3 py-3 text-[13.5px] leading-7 focus:border-pizarra focus:outline-none" />
      </section>

      <section className="grid gap-4 md:grid-cols-[190px_minmax(0,1fr)]">
        <div>
          <h3 className="text-[14px] font-semibold text-tinta">Archivo adjunto</h3>
          <p className="mt-1 text-[12px] leading-5 text-tinta-suave">PDF, documento, imagen o ZIP. Maximo 20 MB.</p>
        </div>
        <label className="flex min-h-[130px] cursor-pointer flex-col items-center justify-center border border-dashed border-regla-fuerte bg-lienzo px-4 py-5 text-center hover:border-pizarra hover:bg-pizarra-tenue">
          <FileUp size={34} strokeWidth={1.5} className="text-pizarra" />
          <span className="mt-3 max-w-full truncate text-[13.5px] font-semibold text-tinta">{archivo ? archivo.name : 'Seleccionar archivo de apoyo'}</span>
          <span className="mt-1 font-dato text-[11px] text-tinta-suave">{archivo ? tamanoArchivo(archivo.size) : 'Opcional'}</span>
          <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.zip" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="sr-only" />
        </label>
      </section>

      {guardado.error && <p className="border border-correccion/30 bg-correccion-tenue px-3 py-2 text-[12px] text-correccion">{guardado.error}</p>}
      <div className="flex justify-end gap-2 border-t border-regla pt-4"><Boton type="button" tamano="sm" variante="fantasma" onClick={alCancelar}>Cancelar</Boton><Boton type="submit" tamano="sm" variante="primario" disabled={guardado.guardando}>{guardado.guardando ? 'Creando...' : 'Crear tarea'}</Boton></div>
    </form>
  )
}

function FormularioTarea({ semanaId, alCancelar, alListo }: { semanaId: string; alCancelar: () => void; alListo: (r: RespuestaAula) => void }) {
  const guardado = useGuardar()
  const [titulo, setTitulo] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [venceEn, setVenceEn] = useState('')
  const [puntos, setPuntos] = useState('100')
  const [archivo] = useState<File | null>(null)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const cuerpo = new FormData()
    cuerpo.append('titulo', titulo.trim())
    cuerpo.append('puntos', puntos)
    if (instrucciones.trim()) cuerpo.append('instrucciones', instrucciones.trim())
    if (venceEn) cuerpo.append('venceEn', new Date(venceEn).toISOString())
    if (archivo) cuerpo.append('archivo', archivo)
    const resultado = await guardado.guardar(() => pedir<RespuestaAula>(`/aulas/semanas/${semanaId}/tareas`, { metodo: 'POST', cuerpo }))
    if (resultado) alListo(resultado)
  }

  return <form onSubmit={(e) => void enviar(e)} className="mt-3 space-y-3 border-t border-regla pt-3"><input required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la tarea" minLength={2} maxLength={180} className="h-9 w-full rounded-sm border border-regla-fuerte px-3 text-[12.5px] focus:border-pizarra focus:outline-none" /><textarea value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} placeholder="Instrucciones" rows={3} maxLength={8000} className="w-full rounded-sm border border-regla-fuerte px-3 py-2 text-[12.5px] focus:border-pizarra focus:outline-none" /><div className="grid grid-cols-[1fr_100px] gap-3"><label><span className="mb-1 block text-[10.5px] font-semibold text-tinta-media">FECHA LÍMITE</span><input type="datetime-local" value={venceEn} onChange={(e) => setVenceEn(e.target.value)} className="h-9 w-full rounded-sm border border-regla-fuerte px-2 text-[12px] focus:border-pizarra focus:outline-none" /></label><label><span className="mb-1 block text-[10.5px] font-semibold text-tinta-media">PUNTOS</span><input required type="number" min="0" max="10000" step="0.01" value={puntos} onChange={(e) => setPuntos(e.target.value)} className="h-9 w-full rounded-sm border border-regla-fuerte px-2 text-[12px] focus:border-pizarra focus:outline-none" /></label></div>{guardado.error && <p className="text-[12px] text-correccion">{guardado.error}</p>}<div className="flex justify-end gap-2"><Boton type="button" tamano="sm" variante="fantasma" onClick={alCancelar}>Cancelar</Boton><Boton type="submit" tamano="sm" variante="primario" disabled={guardado.guardando}>{guardado.guardando ? 'Creando…' : 'Crear tarea'}</Boton></div></form>
}

void FormularioTarea

function EditorSemana({ semana, alCancelar, alGuardar }: { semana: SemanaAula; alCancelar: () => void; alGuardar: (cuerpo: { titulo: string; descripcion: string | null }) => Promise<void> }) {
  const [titulo, setTitulo] = useState(semana.titulo)
  const [descripcion, setDescripcion] = useState(semana.descripcion ?? '')
  return <form onSubmit={(e) => { e.preventDefault(); void alGuardar({ titulo: titulo.trim(), descripcion: descripcion.trim() || null }) }} className="space-y-3 border-b border-regla bg-lienzo px-5 py-4"><input required value={titulo} onChange={(e) => setTitulo(e.target.value)} minLength={2} maxLength={160} className="h-9 w-full rounded-sm border border-regla-fuerte bg-superficie px-3 text-[13px] font-semibold focus:border-pizarra focus:outline-none" /><textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción de la semana" rows={2} maxLength={3000} className="w-full rounded-sm border border-regla-fuerte bg-superficie px-3 py-2 text-[12.5px] focus:border-pizarra focus:outline-none" /><div className="flex justify-end gap-2"><Boton type="button" tamano="sm" variante="fantasma" onClick={alCancelar}>Cancelar</Boton><Boton type="submit" tamano="sm" variante="primario">Guardar semana</Boton></div></form>
}

function cambiarSet(actuales: Set<string>, id: string): Set<string> {
  const siguiente = new Set(actuales)
  if (siguiente.has(id)) siguiente.delete(id)
  else siguiente.add(id)
  return siguiente
}
