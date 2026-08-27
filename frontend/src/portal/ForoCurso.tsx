import { useState, type FormEvent } from 'react'
import {
  CornerDownRight,
  Lock,
  MessagesSquare,
  Pencil,
  Pin,
  Plus,
  Send,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import type { Curso } from '../admin/catalogo'
import { iniciales } from '../app/sesion'
import { useConsulta, useGuardar } from '../datos/consulta'
import { Boton } from '../ui/Boton'
import { cn } from '../ui/cn'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Etiqueta } from '../ui/Etiqueta'
import { Ficha } from '../ui/Ficha'
import {
  borrarMensaje,
  borrarTema,
  crearTema,
  editarMensaje,
  fechaMensaje,
  haceCuanto,
  moderarTema,
  responderTema,
  type MensajeForo,
  type RespuestaForo,
  type RespuestaTema,
  type TemaForo,
} from './foro'

/*
  El foro del curso, en dos pantallas dentro de una: la lista de temas y el hilo
  abierto. No son dos rutas porque el foro vive dentro de una pestaña del curso,
  y darle direccion propia obligaria a repetir ahi la cabecera del curso entera
  para volver a decir lo que ya se esta mirando.
*/
export function ForoCurso({ curso }: { curso: Curso }) {
  const [temaAbierto, setTemaAbierto] = useState<string | null>(null)

  return temaAbierto ? (
    <Hilo temaId={temaAbierto} alVolver={() => setTemaAbierto(null)} />
  ) : (
    <ListaTemas curso={curso} alAbrir={setTemaAbierto} />
  )
}

// ---------------------------------------------------------------------------
// Lista de temas
// ---------------------------------------------------------------------------
function ListaTemas({
  curso,
  alAbrir,
}: {
  curso: Curso
  alAbrir: (temaId: string) => void
}) {
  const consulta = useConsulta<RespuestaForo>(`/foro/curso/${curso.id}`)
  const [abriendo, setAbriendo] = useState(false)

  if (consulta.cargando) {
    return <div className="h-72 animate-pulse rounded-md bg-superficie" />
  }

  if (consulta.error) {
    return (
      <Ficha>
        <EstadoVacio
          icono={MessagesSquare}
          titulo="No se pudo cargar el foro"
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

  const temas = consulta.datos?.temas ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-tinta-media">
          {temas.length === 0
            ? 'Todavía no hay conversaciones en este curso.'
            : `${temas.length} ${temas.length === 1 ? 'tema' : 'temas'} · ${temas.reduce((total, tema) => total + tema.respuestas, 0)} respuestas`}
        </p>
        <Boton
          tamano="sm"
          variante="primario"
          iconoIzq={<Plus size={15} />}
          onClick={() => setAbriendo(true)}
        >
          Abrir un tema
        </Boton>
      </div>

      {abriendo && (
        <NuevoTema
          cursoId={curso.id}
          alCerrar={() => setAbriendo(false)}
          alCrear={(tema) => {
            setAbriendo(false)
            void consulta.recargar()
            alAbrir(tema.id)
          }}
        />
      )}

      {temas.length === 0 && !abriendo ? (
        <Ficha>
          <EstadoVacio
            icono={MessagesSquare}
            titulo="No hay conversaciones"
            texto="Abre el primer tema: una duda del temario, un aviso o una pregunta sobre la próxima entrega."
            accion={
              <Boton tamano="sm" variante="primario" onClick={() => setAbriendo(true)}>
                Abrir un tema
              </Boton>
            }
          />
        </Ficha>
      ) : (
        <Ficha className="divide-y divide-regla">
          {temas.map((tema) => (
            <FilaTema key={tema.id} tema={tema} alAbrir={() => alAbrir(tema.id)} />
          ))}
        </Ficha>
      )}
    </div>
  )
}

function FilaTema({ tema, alAbrir }: { tema: TemaForo; alAbrir: () => void }) {
  return (
    <button
      onClick={alAbrir}
      className="flex w-full items-start gap-3.5 px-5 py-4 text-left transition-colors hover:bg-lienzo"
    >
      <Avatar nombre={tema.autor} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {tema.fijado && (
            <Etiqueta tono="info" icono={<Pin size={11} />}>
              Fijado
            </Etiqueta>
          )}
          {tema.cerrado && (
            <Etiqueta tono="neutro" icono={<Lock size={11} />}>
              Cerrado
            </Etiqueta>
          )}
          <h3 className="truncate font-display text-[14.5px] font-semibold text-tinta">
            {tema.titulo}
          </h3>
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-tinta-media">
          {tema.cuerpo}
        </p>
        <p className="mt-1.5 font-dato text-[12px] text-tinta-suave">
          {tema.autor} · {haceCuanto(tema.creadoEn)}
          {tema.respuestas > 0 && tema.ultimoAutor && (
            <> · última respuesta de {tema.ultimoAutor} {haceCuanto(tema.ultimaActividadEn)}</>
          )}
        </p>
      </div>
      <span className="shrink-0 self-center text-center">
        <span className="block font-dato text-[15px] tabular-nums text-tinta">
          {tema.respuestas}
        </span>
        <span className="etiqueta-dato text-tinta-suave">
          {tema.respuestas === 1 ? 'respuesta' : 'respuestas'}
        </span>
      </span>
    </button>
  )
}

function NuevoTema({
  cursoId,
  alCerrar,
  alCrear,
}: {
  cursoId: string
  alCerrar: () => void
  alCrear: (tema: TemaForo) => void
}) {
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const guardado = useGuardar()

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const respuesta = await guardado.guardar(() =>
      crearTema(cursoId, { titulo: titulo.trim(), cuerpo: cuerpo.trim() }),
    )
    if (respuesta) alCrear(respuesta.tema)
  }

  return (
    <Ficha>
      <form onSubmit={enviar} className="space-y-3 p-5">
        <input
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          placeholder="¿De qué quieres hablar?"
          maxLength={160}
          required
          className="h-11 w-full rounded-sm border border-regla-fuerte bg-superficie px-3 font-display text-[15px] font-semibold text-tinta placeholder:font-sans placeholder:font-normal placeholder:text-tinta-suave focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15"
        />
        <textarea
          value={cuerpo}
          onChange={(evento) => setCuerpo(evento.target.value)}
          rows={5}
          placeholder="Escribe el mensaje que abre el tema."
          maxLength={8000}
          required
          className="w-full resize-y rounded-sm border border-regla-fuerte bg-superficie px-3 py-2.5 text-sm leading-relaxed text-tinta placeholder:text-tinta-suave focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15"
        />
        {guardado.error && <p className="text-[12.5px] text-correccion">{guardado.error}</p>}
        <div className="flex justify-end gap-2">
          <Boton type="button" tamano="sm" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            tamano="sm"
            variante="primario"
            disabled={guardado.guardando || !titulo.trim() || !cuerpo.trim()}
            iconoIzq={<Send size={14} />}
          >
            {guardado.guardando ? 'Publicando…' : 'Publicar tema'}
          </Boton>
        </div>
      </form>
    </Ficha>
  )
}

// ---------------------------------------------------------------------------
// Un hilo
// ---------------------------------------------------------------------------
function Hilo({ temaId, alVolver }: { temaId: string; alVolver: () => void }) {
  const consulta = useConsulta<RespuestaTema>(`/foro/temas/${temaId}`)
  const guardado = useGuardar()
  const [respuesta, setRespuesta] = useState('')

  if (consulta.cargando) {
    return <div className="h-72 animate-pulse rounded-md bg-superficie" />
  }

  if (consulta.error || !consulta.datos) {
    return (
      <Ficha>
        <EstadoVacio
          icono={MessagesSquare}
          titulo="No se pudo abrir el tema"
          texto={consulta.error ?? 'El tema ya no está disponible.'}
          accion={
            <Boton tamano="sm" onClick={alVolver}>
              Volver al foro
            </Boton>
          }
        />
      </Ficha>
    )
  }

  const { tema, mensajes, puedeModerar } = consulta.datos
  const puedeBorrarTema = tema.esMio || puedeModerar
  const cerradoParaMi = tema.cerrado && !puedeModerar

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const hecho = await guardado.guardar(() => responderTema(temaId, respuesta.trim()))
    if (hecho) {
      setRespuesta('')
      void consulta.recargar()
    }
  }

  async function moderar(cambio: { fijado?: boolean; cerrado?: boolean }) {
    const hecho = await guardado.guardar(() => moderarTema(temaId, cambio))
    if (hecho) void consulta.recargar()
  }

  async function eliminar() {
    const hecho = await guardado.guardar(() => borrarTema(temaId))
    if (hecho !== null) alVolver()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={alVolver}
          className="inline-flex items-center gap-1.5 text-[13px] text-pizarra hover:underline"
        >
          <X size={14} /> Volver al foro
        </button>

        {/* Moderar es de quien imparte; borrar, tambien del autor. */}
        <div className="flex items-center gap-2">
          {puedeModerar && (
            <>
              <Boton
                tamano="sm"
                iconoIzq={<Pin size={14} />}
                onClick={() => void moderar({ fijado: !tema.fijado })}
              >
                {tema.fijado ? 'Quitar de fijados' : 'Fijar'}
              </Boton>
              <Boton
                tamano="sm"
                iconoIzq={tema.cerrado ? <Unlock size={14} /> : <Lock size={14} />}
                onClick={() => void moderar({ cerrado: !tema.cerrado })}
              >
                {tema.cerrado ? 'Reabrir' : 'Cerrar'}
              </Boton>
            </>
          )}
          {puedeBorrarTema && (
            <Boton
              tamano="sm"
              variante="peligro"
              iconoIzq={<Trash2 size={14} />}
              onClick={() => void eliminar()}
            >
              Borrar tema
            </Boton>
          )}
        </div>
      </div>

      <Ficha>
        <div className="flex items-start gap-3.5 p-5">
          <Avatar nombre={tema.autor} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {tema.fijado && (
                <Etiqueta tono="info" icono={<Pin size={11} />}>
                  Fijado
                </Etiqueta>
              )}
              {tema.cerrado && (
                <Etiqueta tono="neutro" icono={<Lock size={11} />}>
                  Cerrado
                </Etiqueta>
              )}
              <h2 className="font-display text-[19px] font-bold leading-tight text-tinta">
                {tema.titulo}
              </h2>
            </div>
            <p className="mt-1 font-dato text-[12px] text-tinta-suave">
              {tema.autor} · {fechaMensaje(tema.creadoEn)}
              {tema.editadoEn && ' · editado'}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-tinta">
              {tema.cuerpo}
            </p>
          </div>
        </div>
      </Ficha>

      {mensajes.length > 0 && (
        <Ficha className="divide-y divide-regla">
          {mensajes.map((mensaje) => (
            <Respuesta
              key={mensaje.id}
              mensaje={mensaje}
              puedeModerar={puedeModerar}
              alCambiar={() => void consulta.recargar()}
            />
          ))}
        </Ficha>
      )}

      {cerradoParaMi ? (
        <Ficha>
          <p className="flex items-center justify-center gap-2 px-5 py-6 text-[13px] text-tinta-media">
            <Lock size={14} className="text-tinta-suave" />
            Este tema está cerrado. Se puede leer, pero ya no admite respuestas.
          </p>
        </Ficha>
      ) : (
        <Ficha>
          <form onSubmit={enviar} className="space-y-3 p-5">
            <textarea
              value={respuesta}
              onChange={(evento) => setRespuesta(evento.target.value)}
              rows={4}
              maxLength={8000}
              placeholder="Escribe tu respuesta…"
              className="w-full resize-y rounded-sm border border-regla-fuerte bg-superficie px-3 py-2.5 text-sm leading-relaxed text-tinta placeholder:text-tinta-suave focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15"
            />
            {guardado.error && (
              <p className="text-[12.5px] text-correccion">{guardado.error}</p>
            )}
            <div className="flex justify-end">
              <Boton
                type="submit"
                tamano="sm"
                variante="primario"
                disabled={guardado.guardando || !respuesta.trim()}
                iconoIzq={<CornerDownRight size={14} />}
              >
                {guardado.guardando ? 'Enviando…' : 'Responder'}
              </Boton>
            </div>
          </form>
        </Ficha>
      )}
    </div>
  )
}

function Respuesta({
  mensaje,
  puedeModerar,
  alCambiar,
}: {
  mensaje: MensajeForo
  puedeModerar: boolean
  alCambiar: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(mensaje.cuerpo)
  const guardado = useGuardar()

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    const hecho = await guardado.guardar(() => editarMensaje(mensaje.id, texto.trim()))
    if (hecho) {
      setEditando(false)
      alCambiar()
    }
  }

  async function eliminar() {
    const hecho = await guardado.guardar(() => borrarMensaje(mensaje.id))
    if (hecho !== null) alCambiar()
  }

  return (
    <div className="flex items-start gap-3.5 px-5 py-4">
      <Avatar nombre={mensaje.autor} destacado={mensaje.esDocente} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-semibold text-tinta">{mensaje.autor}</span>
          {mensaje.esDocente && <Etiqueta tono="aprobado">Instructor</Etiqueta>}
          <span className="font-dato text-[12px] text-tinta-suave">
            {haceCuanto(mensaje.creadoEn)}
            {mensaje.editadoEn && ' · editado'}
          </span>
        </div>

        {editando ? (
          <form onSubmit={guardar} className="mt-2 space-y-2">
            <textarea
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              rows={4}
              maxLength={8000}
              className="w-full resize-y rounded-sm border border-regla-fuerte bg-superficie px-3 py-2.5 text-sm leading-relaxed text-tinta focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15"
            />
            {guardado.error && (
              <p className="text-[12.5px] text-correccion">{guardado.error}</p>
            )}
            <div className="flex gap-2">
              <Boton
                type="submit"
                tamano="sm"
                variante="primario"
                disabled={guardado.guardando || !texto.trim()}
              >
                Guardar
              </Boton>
              <Boton
                type="button"
                tamano="sm"
                onClick={() => {
                  setTexto(mensaje.cuerpo)
                  setEditando(false)
                }}
              >
                Cancelar
              </Boton>
            </div>
          </form>
        ) : (
          <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-tinta">
            {mensaje.cuerpo}
          </p>
        )}
      </div>

      {!editando && (mensaje.esMio || puedeModerar) && (
        <div className="flex shrink-0 gap-1">
          {mensaje.esMio && (
            <button
              onClick={() => setEditando(true)}
              aria-label="Editar mensaje"
              className="flex h-7 w-7 items-center justify-center rounded-xs text-tinta-suave hover:bg-lienzo hover:text-tinta"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            onClick={() => void eliminar()}
            aria-label="Borrar mensaje"
            className="flex h-7 w-7 items-center justify-center rounded-xs text-tinta-suave hover:bg-correccion-tenue hover:text-correccion"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function Avatar({ nombre, destacado }: { nombre: string; destacado?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold',
        destacado
          ? 'border-pizarra/25 bg-pizarra-tenue text-pizarra'
          : 'border-regla bg-lienzo text-tinta-media',
      )}
      aria-hidden
    >
      {iniciales(nombre)}
    </span>
  )
}
