import { useEffect, useState, type FormEvent } from 'react'
import {
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  FileText,
  FileUp,
  Send,
  X,
} from 'lucide-react'
import type { Curso } from '../admin/catalogo'
import { pedir, pedirArchivo } from '../datos/api'
import { useConsulta, useGuardar } from '../datos/consulta'
import { Boton } from '../ui/Boton'
import { cn } from '../ui/cn'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Ficha } from '../ui/Ficha'
import {
  fechaTarea,
  tamanoArchivo,
  type MaterialAula,
  type RespuestaAula,
  type TareaAula,
} from './aula'

export function AulaEstudiante({ curso }: { curso: Curso }) {
  const consulta = useConsulta<RespuestaAula>(`/aulas/curso/${curso.id}`)
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  useEffect(() => {
    const primera = consulta.datos?.aula?.semanas[0]?.id
    if (primera) {
      setAbiertas((actuales) =>
        actuales.size ? actuales : new Set([primera]),
      )
    }
  }, [consulta.datos?.aula?.semanas])

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
    } catch (error) {
      setErrorDescarga(
        error instanceof Error
          ? error.message
          : 'No se pudo descargar el archivo.',
      )
    }
  }

  if (consulta.cargando) {
    return <div className="h-80 animate-pulse rounded-md bg-superficie" />
  }

  if (consulta.error) {
    return (
      <Ficha>
        <EstadoVacio
          icono={BookOpen}
          titulo="No se pudo cargar el aula"
          texto={consulta.error}
          accion={
            <Boton tamano="sm" onClick={() => void consulta.recargar()}>
              Reintentar
            </Boton>
          }
        />
      </Ficha>
    )
  }

  const aula = consulta.datos?.aula
  if (!aula || aula.semanas.length === 0) {
    return (
      <Ficha>
        <EstadoVacio
          icono={BookOpen}
          titulo="El aula todavía no tiene contenido"
          texto="Las semanas, materiales y tareas aparecerán cuando el instructor los publique."
        />
      </Ficha>
    )
  }

  return (
    <div className="space-y-5">
      <header className="border-b border-regla pb-4">
        <p className="etiqueta-dato text-pizarra">Aula virtual</p>
        <h2 className="mt-1 font-display text-[22px] font-bold text-tinta">
          {aula.titulo}
        </h2>
        <p className="mt-1.5 text-[13px] text-tinta-media">
          Consulta los recursos y tareas publicados en cada semana.
        </p>
      </header>

      {errorDescarga && (
        <p className="border border-correccion/30 bg-correccion-tenue px-4 py-3 text-[13px] text-correccion">
          {errorDescarga}
        </p>
      )}

      <div className="space-y-3">
        {aula.semanas.map((semana) => {
          const abierta = abiertas.has(semana.id)
          return (
            <section
              key={semana.id}
              className="overflow-hidden rounded-md border border-regla bg-superficie"
            >
              <button
                type="button"
                onClick={() =>
                  setAbiertas((actuales) => cambiarSet(actuales, semana.id))
                }
                className="flex w-full items-center gap-3 px-4 py-4 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-pizarra-tenue font-dato text-[12px] font-semibold text-pizarra">
                  {semana.numero}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-tinta">
                    {semana.titulo}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-tinta-suave">
                    {semana.materiales.length} materiales · {semana.tareas.length}{' '}
                    tareas
                  </span>
                </span>
                <ChevronDown
                  size={17}
                  className={cn(
                    'shrink-0 text-tinta-suave transition-transform',
                    abierta && 'rotate-180',
                  )}
                />
              </button>

              {abierta && (
                <div className="border-t border-regla">
                  {semana.descripcion && (
                    <p className="border-b border-regla bg-lienzo/60 px-5 py-3 text-[13px] leading-relaxed text-tinta-media">
                      {semana.descripcion}
                    </p>
                  )}

                  <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-regla">
                    <div className="min-w-0 p-4">
                      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-tinta">
                        <FileText size={15} className="text-pizarra" /> Materiales
                      </h3>
                      {semana.materiales.length === 0 ? (
                        <p className="py-8 text-center text-[12.5px] text-tinta-suave">
                          No hay materiales publicados.
                        </p>
                      ) : (
                        <ul className="mt-3">
                          {semana.materiales.map((material) => (
                            <li
                              key={material.id}
                              className="flex items-start gap-3 border-t border-regla py-3"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-lienzo text-pizarra">
                                <FileText size={15} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[12.5px] font-semibold text-tinta">
                                  {material.titulo}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] text-tinta-suave">
                                  {material.archivoNombre} ·{' '}
                                  {tamanoArchivo(material.archivoTamano)}
                                </p>
                                {material.descripcion && (
                                  <p className="mt-1 text-[11.5px] leading-relaxed text-tinta-media">
                                    {material.descripcion}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                title="Descargar material"
                                aria-label={`Descargar ${material.titulo}`}
                                onClick={() => void descargar(material)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-tinta-suave hover:bg-lienzo hover:text-pizarra"
                              >
                                <Download size={15} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="min-w-0 border-t border-regla p-4 lg:border-t-0">
                      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-tinta">
                        <ClipboardList size={15} className="text-entrega" /> Tareas
                      </h3>
                      {semana.tareas.length === 0 ? (
                        <p className="py-8 text-center text-[12.5px] text-tinta-suave">
                          No hay tareas publicadas.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-3">
                          {semana.tareas.map((tarea) => (
                            <TareaEstudiante
                              key={tarea.id}
                              tarea={tarea}
                              alActualizar={consulta.fijar}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
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

function TareaEstudiante({
  tarea,
  alActualizar,
}: {
  tarea: TareaAula
  alActualizar: (respuesta: RespuestaAula) => void
}) {
  const [entregando, setEntregando] = useState(!tarea.entrega)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [comentario, setComentario] = useState(tarea.entrega?.comentario ?? '')
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)
  const guardado = useGuardar()
  const entrega = tarea.entrega
  const calificada = entrega?.calificacion !== null && entrega?.calificacion !== undefined

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
      alActualizar(resultado)
      setArchivo(null)
      setEntregando(false)
    }
  }

  async function descargarEntrega() {
    if (!entrega?.archivoNombre) return
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
      setErrorDescarga(
        error instanceof Error
          ? error.message
          : 'No se pudo descargar el archivo de la tarea.',
      )
    }
  }

  return (
    <li className="border-l-2 border-entrega bg-entrega-tenue px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-tinta">{tarea.titulo}</p>
          {tarea.instrucciones && (
            <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-tinta-media">
              {tarea.instrucciones}
            </p>
          )}
          {tarea.archivoNombre && (
            <button
              type="button"
              onClick={() => void descargarArchivoTarea()}
              className="mt-2 flex max-w-full items-center gap-2 text-[12px] font-medium text-pizarra hover:underline"
            >
              <Download size={14} />
              <span className="min-w-0 truncate">{tarea.archivoNombre}</span>
              {tarea.archivoTamano !== null && (
                <span className="shrink-0 font-normal text-tinta-suave">
                  {tamanoArchivo(tarea.archivoTamano)}
                </span>
              )}
            </button>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-dato text-[10.5px] text-tinta-suave">
            <span className="flex items-center gap-1.5 text-entrega">
              <CalendarClock size={13} /> {fechaTarea(tarea.venceEn)}
            </span>
            <span>{Number(tarea.puntos)} puntos</span>
          </div>
        </div>
        {calificada ? (
          <div className="shrink-0 border border-pizarra/20 bg-superficie px-3 py-2 text-right">
            <p className="etiqueta-dato text-pizarra">Calificación</p>
            <p className="mt-1 font-dato text-[18px] font-semibold text-tinta">
              {Number(entrega.calificacion)} / {Number(tarea.puntos)}
            </p>
          </div>
        ) : entrega ? (
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-pizarra">
            <CheckCircle2 size={14} /> Enviada
          </span>
        ) : null}
      </div>

      {entrega && (
        <div className="mt-3 border-t border-entrega/20 pt-3">
          <p className="text-[11px] text-tinta-suave">
            Enviada el {fechaEntrega(entrega.entregadoEn)}
          </p>
          {entrega.archivoNombre && (
            <button
              type="button"
              onClick={() => void descargarEntrega()}
              className="mt-2 flex items-center gap-2 text-[12px] font-medium text-pizarra hover:underline"
            >
              <Download size={14} /> {entrega.archivoNombre}
              {entrega.archivoTamano !== null && (
                <span className="font-normal text-tinta-suave">
                  {tamanoArchivo(entrega.archivoTamano)}
                </span>
              )}
            </button>
          )}
          {calificada && entrega.retroalimentacion && (
            <div className="mt-3 border-l-2 border-pizarra bg-superficie px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-pizarra">
                <Award size={14} /> Retroalimentación del instructor
              </p>
              <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-tinta-media">
                {entrega.retroalimentacion}
              </p>
            </div>
          )}
        </div>
      )}

      {errorDescarga && (
        <p className="mt-2 text-[11.5px] text-correccion">{errorDescarga}</p>
      )}

      {!calificada && !entregando && (
        <button
          type="button"
          onClick={() => setEntregando(true)}
          className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-pizarra hover:underline"
        >
          <FileUp size={14} /> Actualizar entrega
        </button>
      )}

      {!calificada && entregando && (
        <form
          onSubmit={(evento) => void enviar(evento)}
          className="mt-3 space-y-3 border-t border-entrega/20 pt-3"
        >
          <label>
            <span className="mb-1 block text-[10.5px] font-semibold text-tinta-media">
              COMENTARIO
            </span>
            <textarea
              value={comentario}
              onChange={(evento) => setComentario(evento.target.value)}
              rows={3}
              maxLength={8000}
              placeholder="Escribe una respuesta o una nota para el instructor"
              className="w-full rounded-sm border border-regla-fuerte bg-superficie px-3 py-2 text-[12.5px] focus:border-pizarra focus:outline-none"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-sm border border-dashed border-regla-fuerte bg-superficie px-3 py-3 hover:border-pizarra">
            <FileUp size={18} className="text-pizarra" />
            <span className="min-w-0 flex-1 truncate text-[12px] text-tinta-media">
              {archivo
                ? `${archivo.name} · ${tamanoArchivo(archivo.size)}`
                : entrega?.archivoNombre ?? 'Seleccionar archivo (máx. 20 MB)'}
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.zip"
              onChange={(evento) => setArchivo(evento.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
          {guardado.error && (
            <p className="text-[12px] text-correccion">{guardado.error}</p>
          )}
          <div className="flex justify-end gap-2">
            {entrega && (
              <Boton
                type="button"
                tamano="sm"
                variante="fantasma"
                iconoIzq={<X size={14} />}
                onClick={() => setEntregando(false)}
              >
                Cancelar
              </Boton>
            )}
            <Boton
              type="submit"
              tamano="sm"
              variante="primario"
              iconoIzq={<Send size={14} />}
              disabled={guardado.guardando || (!archivo && !comentario.trim())}
            >
              {guardado.guardando ? 'Enviando…' : entrega ? 'Reenviar tarea' : 'Enviar tarea'}
            </Boton>
          </div>
        </form>
      )}
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

function cambiarSet(actuales: Set<string>, id: string): Set<string> {
  const siguiente = new Set(actuales)
  if (siguiente.has(id)) siguiente.delete(id)
  else siguiente.add(id)
  return siguiente
}
