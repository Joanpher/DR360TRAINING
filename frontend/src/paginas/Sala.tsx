import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleDot, ShieldCheck, Users, Video } from 'lucide-react'
import { ErrorApi } from '../datos/api'
import { SalaJitsi } from '../portal/SalaJitsi'
import {
  entrarAReunion,
  finalizarReunion,
  salirDeReunion,
  type AccesoReunion,
} from '../portal/reuniones'
import { Boton } from '../ui/Boton'

/*
  La pantalla de la clase en vivo.

  Va fuera del Shell -sin barra de navegacion ni menu de cursos- y ocupa el alto
  entero de la ventana. Una videollamada dentro de una columna de contenido, con
  la navegacion del sitio alrededor, es una videollamada que nadie mira: la
  atencion tiene que estar en la sala y en nada mas.

  El permiso no se decide aqui. Se pide al backend con /entrar y se dibuja lo
  que conteste; si dice que no, esta pantalla solo sabe repetir el motivo.
*/
export function Sala() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const [acceso, setAcceso] = useState<AccesoReunion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cerrando, setCerrando] = useState(false)

  /*
    En desarrollo React monta cada componente dos veces a proposito, y entrar a
    la clase dos veces contaria dos entradas en la hoja de asistencia. Lo que se
    guarda es la PETICION, no una marca de "ya pedida": el segundo montaje se
    engancha a la misma promesa en vez de saltarse el efecto.

    Guardar solo la marca era el error obvio y no lo parece: el primer montaje
    la ponia, su limpieza invalidaba su propia respuesta, y el segundo se iba
    por el atajo sin volver a escuchar. La peticion salia, volvia, y no la
    recogia nadie: la sala se quedaba "preparandose" para siempre.
  */
  const peticion = useRef<{ id: string; promesa: Promise<AccesoReunion> } | null>(null)

  useEffect(() => {
    if (!id) return
    if (peticion.current?.id !== id) {
      peticion.current = { id, promesa: entrarAReunion(id) }
    }

    let vigente = true
    peticion.current.promesa
      .then((respuesta) => {
        if (vigente) setAcceso(respuesta)
      })
      .catch((fallo: unknown) => {
        if (vigente) {
          setError(
            fallo instanceof ErrorApi ? fallo.message : 'No se pudo entrar a la clase.',
          )
        }
      })

    return () => {
      vigente = false
    }
  }, [id])

  /*
    Cerrar la pestana con la clase abierta es lo mas normal del mundo, y sin
    esto la asistencia se quedaria contando minutos hasta que el instructor
    terminara la reunion.
  */
  useEffect(() => {
    if (!acceso) return
    const avisar = () => salirDeReunion(id)
    window.addEventListener('pagehide', avisar)
    return () => {
      window.removeEventListener('pagehide', avisar)
      salirDeReunion(id)
    }
  }, [acceso, id])

  const salir = useCallback(() => {
    navegar('/clases')
  }, [navegar])

  async function terminarClase() {
    setCerrando(true)
    try {
      await finalizarReunion(id)
      navegar('/clases')
    } catch (fallo) {
      setError(fallo instanceof ErrorApi ? fallo.message : 'No se pudo terminar la clase.')
      setCerrando(false)
    }
  }

  if (error && !acceso) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-lienzo px-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-sm border border-regla-fuerte bg-superficie">
          <Video size={20} strokeWidth={1.5} className="text-tinta-suave" />
        </div>
        <div>
          <h1 className="font-display text-[17px] font-bold text-tinta">
            No puedes entrar a esta clase
          </h1>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-tinta-media">
            {error}
          </p>
        </div>
        <Link to="/clases">
          <Boton tamano="sm" iconoIzq={<ArrowLeft size={15} />}>
            Volver a mis clases
          </Boton>
        </Link>
      </div>
    )
  }

  if (!acceso) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-tinta">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-white" />
        <p className="text-[13px] text-white/70">Preparando la sala…</p>
      </div>
    )
  }

  const { reunion } = acceso

  return (
    <div className="flex h-screen flex-col bg-tinta">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-2.5">
        <button
          onClick={salir}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Volver a mis clases"
          title="Volver a mis clases"
        >
          <ArrowLeft size={17} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-white">
            {reunion.titulo}
          </p>
          <p className="truncate font-dato text-[11px] text-white/50">
            {reunion.cursoCodigo} · {reunion.cursoNombre}
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-xs border border-correccion/50 bg-correccion/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          <CircleDot size={12} className="animate-pulse" /> En vivo
        </span>

        <span className="hidden items-center gap-1.5 text-[12px] text-white/60 sm:inline-flex">
          <Users size={14} /> {reunion.presentes} en la sala
        </span>

        {acceso.esModerador && (
          <span
            className="hidden items-center gap-1.5 text-[12px] text-white/60 md:inline-flex"
            title={
              acceso.token
                ? 'Tu entrada va firmada por el servidor: nadie más puede moderar.'
                : 'El servidor de videollamadas no exige token. La sala la protege su nombre.'
            }
          >
            <ShieldCheck size={14} /> Moderas {acceso.token ? '· verificado' : ''}
          </span>
        )}

        <div className="flex items-center gap-2">
          {acceso.esModerador && (
            <Boton
              tamano="sm"
              variante="peligro"
              disabled={cerrando}
              onClick={() => void terminarClase()}
              className="border-white/25 bg-transparent text-white hover:bg-white/10"
            >
              {cerrando ? 'Terminando…' : 'Terminar clase'}
            </Boton>
          )}
          <Boton
            tamano="sm"
            onClick={salir}
            className="border-white/25 bg-transparent text-white hover:bg-white/10"
          >
            Salir
          </Boton>
        </div>
      </header>

      {error && (
        <p className="shrink-0 bg-correccion/20 px-4 py-2 text-center text-[12.5px] text-white">
          {error}
        </p>
      )}

      <main className="min-h-0 flex-1">
        <SalaJitsi acceso={acceso} alSalir={salir} />
      </main>
    </div>
  )
}
