import { useEffect, useRef, useState } from 'react'
import type { AccesoReunion } from './reuniones'

/*
  El cliente de Jitsi, empotrado.

  Jitsi Meet no se instala como paquete de npm: se carga el external_api.js del
  propio servidor de videollamadas y ese archivo monta un iframe con la sala
  dentro. Eso tiene una consecuencia que conviene tener presente al leer esto:
  el audio, el video, el compartir pantalla, el chat y la mano levantada NO son
  codigo de este repositorio. Aqui solo se decide quien entra, con que nombre,
  con cuanto poder y que botones ve.

  Por eso el componente es corto y casi todo el son efectos de ciclo de vida:
  cargar el script una sola vez por dominio, crear la instancia, escuchar cuatro
  eventos y -esto es lo que se olvida y deja la camara encendida- destruirla al
  desmontar.
*/

type ApiJitsi = {
  dispose: () => void
  executeCommand: (comando: string, ...argumentos: unknown[]) => void
  addListener: (evento: string, oyente: (datos: unknown) => void) => void
}

type ConstructorJitsi = new (
  dominio: string,
  opciones: Record<string, unknown>,
) => ApiJitsi

declare global {
  interface Window {
    JitsiMeetExternalAPI?: ConstructorJitsi
  }
}

/*
  Una promesa por dominio. Sin esto, entrar y salir de dos clases seguidas
  insertaria dos veces la misma etiqueta <script>, y la segunda carga machaca la
  instancia global mientras la primera sala todavia la esta usando.
*/
const cargas = new Map<string, Promise<ConstructorJitsi>>()

function cargarJitsi(dominio: string): Promise<ConstructorJitsi> {
  if (window.JitsiMeetExternalAPI) return Promise.resolve(window.JitsiMeetExternalAPI)

  const yaEnCurso = cargas.get(dominio)
  if (yaEnCurso) return yaEnCurso

  const carga = new Promise<ConstructorJitsi>((resolver, rechazar) => {
    const etiqueta = document.createElement('script')
    etiqueta.src = `https://${dominio}/external_api.js`
    etiqueta.async = true
    etiqueta.onload = () => {
      const api = window.JitsiMeetExternalAPI
      if (api) resolver(api)
      else rechazar(new Error('El servidor de videollamadas respondió algo inesperado.'))
    }
    etiqueta.onerror = () => {
      // Un fallo aqui se reintenta la proxima vez: casi siempre es la red.
      cargas.delete(dominio)
      rechazar(new Error(`No se pudo contactar con ${dominio}.`))
    }
    document.head.append(etiqueta)
  })

  cargas.set(dominio, carga)
  return carga
}

/*
  La barra de herramientas. Es una lista explicita y no la de fábrica porque la
  de fábrica trae cosas que aqui no aplican -invitar por enlace a gente de
  fuera, marcar por telefono- y esconde las que en una clase se usan cada dia.

  Grabar y expulsar solo aparecen para quien modera. Es una comodidad, no un
  control: quien manda es el token, que ya viene firmado sin esos permisos.
*/
function botones(esModerador: boolean, permiteGrabacion: boolean): string[] {
  return [
    'microphone',
    'camera',
    'desktop',
    'chat',
    'raisehand',
    'participants-pane',
    'tileview',
    'toggle-camera',
    'select-background',
    'fullscreen',
    'settings',
    'videoquality',
    'filmstrip',
    'shortcuts',
    ...(esModerador ? ['mute-everyone', 'mute-video-everyone', 'security'] : []),
    ...(esModerador && permiteGrabacion ? ['recording'] : []),
    'hangup',
  ]
}

export function SalaJitsi({
  acceso,
  alSalir,
}: {
  acceso: AccesoReunion
  alSalir: () => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  /*
    Un fallo de la videollamada puede ser el fin de la sala o un tropiezo del
    que se sale solo -una camara que otra aplicacion tenia cogida, un corte de
    red de dos segundos-. Distinguirlos es la diferencia entre avisar y tirar
    la clase abajo.
  */
  const [error, setError] = useState<{ mensaje: string; fatal: boolean } | null>(null)
  const [conectando, setConectando] = useState(true)

  /*
    alSalir en una referencia y no en las dependencias del efecto: si el padre
    lo redefine en cada render -y lo hace, es una funcion flecha-, el efecto se
    volveria a ejecutar y la llamada se cortaria sola cada pocos segundos.
  */
  const salir = useRef(alSalir)
  salir.current = alSalir

  const { dominio, sala, token, esModerador } = acceso
  const { reunion, nombre, correo, avatarUrl } = acceso

  useEffect(() => {
    let vigente = true
    let api: ApiJitsi | null = null

    void cargarJitsi(dominio)
      .then((JitsiMeetExternalAPI) => {
        if (!vigente || !contenedor.current) return

        api = new JitsiMeetExternalAPI(dominio, {
          roomName: sala,
          parentNode: contenedor.current,
          width: '100%',
          height: '100%',
          // Solo va si el despliegue exige token. Mandarselo a un servidor
          // publico -que no lo espera- hace que rechace la conexion entera.
          ...(token ? { jwt: token } : {}),
          userInfo: { displayName: nombre, email: correo },
          configOverwrite: {
            startWithAudioMuted: reunion.silenciarAlEntrar && !esModerador,
            startWithVideoMuted: reunion.camaraApagadaAlEntrar && !esModerador,
            /*
              La pantalla previa sobra: el permiso ya se comprobo antes de
              llegar aqui y el nombre no se elige, lo pone la matricula -que es
              justo lo que esa pantalla deja reescribir-.

              Van las dos claves porque Jitsi renombro la opcion: las versiones
              nuevas leen prejoinConfig y las viejas prejoinPageEnabled. Poner
              solo una hace que la pantalla aparezca o no segun la version del
              servidor, que es la clase de diferencia que nadie relaciona con
              esta linea.
            */
            prejoinConfig: { enabled: false },
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            // Sin esto el cliente pide avatares a Gravatar y analitica a
            // terceros con el correo de cada alumno.
            disableThirdPartyRequests: true,
            enableWelcomePage: false,
            enableClosePage: false,
            defaultLanguage: 'es',
            subject: reunion.titulo,
            toolbarButtons: botones(esModerador, reunion.permiteGrabacion),
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            MOBILE_APP_PROMO: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
            HIDE_INVITE_MORE_HEADER: true,
            DEFAULT_REMOTE_DISPLAY_NAME: 'Participante',
            TOOLBAR_BUTTONS: botones(esModerador, reunion.permiteGrabacion),
          },
        })

        /*
          El iframe ya existe, asi que a partir de aqui manda el cliente de
          Jitsi, que pinta su propia espera. Esperar a videoConferenceJoined
          para retirar la nuestra seria taparle la pantalla previa -donde se
          elige camara y microfono- hasta que la persona entrara, y para entrar
          hay que verla.
        */
        if (vigente) setConectando(false)

        api.addListener('videoConferenceJoined', () => {
          if (!vigente) return
          api?.executeCommand('displayName', nombre)
          if (avatarUrl) api?.executeCommand('avatarUrl', avatarUrl)
        })

        // Colgar y cerrar son dos eventos distintos y hay clientes que solo
        // emiten uno. Escuchar los dos evita quedarse mirando un iframe muerto.
        api.addListener('videoConferenceLeft', () => salir.current())
        api.addListener('readyToClose', () => salir.current())

        /*
          Jitsi emite errorOccurred para casi todo, y la mayoria no termina la
          llamada: permisos de camara, un dispositivo ocupado, una reconexion.
          Solo isFatal significa que la sala se acabo. Tratarlos todos igual
          hacia que un permiso denegado desmontara el iframe y matara una clase
          que seguia perfectamente viva.
        */
        api.addListener('errorOccurred', (datos: unknown) => {
          if (!vigente) return
          const detalle = (datos as {
            error?: { message?: string; name?: string; isFatal?: boolean }
          })?.error
          setError({
            mensaje:
              detalle?.message ||
              detalle?.name ||
              'La videollamada informó de un problema.',
            fatal: detalle?.isFatal === true,
          })
        })
      })
      .catch((fallo: Error) => {
        if (vigente) {
          setConectando(false)
          // Aqui no hay iframe que salvar: el script ni se cargo.
          setError({ mensaje: fallo.message, fatal: true })
        }
      })

    return () => {
      vigente = false
      // Lo importante de esta linea: sin dispose, el iframe sobrevive al
      // cambio de pantalla y la camara sigue encendida.
      api?.dispose()
    }
  }, [
    dominio,
    sala,
    token,
    esModerador,
    nombre,
    correo,
    avatarUrl,
    reunion.titulo,
    reunion.silenciarAlEntrar,
    reunion.camaraApagadaAlEntrar,
    reunion.permiteGrabacion,
  ])

  return (
    <div className="relative h-full w-full bg-tinta">
      {/*
        El contenedor del iframe se dibuja siempre, pase lo que pase. Cuando el
        error reemplazaba a este div, React desmontaba el iframe entero: un aviso
        de camara ocupada cerraba la videollamada y no habia forma de volver sin
        recargar. Los avisos van encima, no en su lugar.
      */}
      <div ref={contenedor} className="h-full w-full" />

      {/*
        pointer-events-none no es un detalle de estilo: sin el, esta capa cubre
        el iframe entero y se traga los clics de la sala -incluido el boton de
        entrar de la pantalla previa de Jitsi-. Se veia la videollamada perfecta
        y no respondia a nada.
      */}
      {conectando && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-tinta">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          <p className="text-[13px] text-white/70">Cargando la sala…</p>
        </div>
      )}

      {error?.fatal && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-tinta px-6 text-center">
          <p className="font-display text-[16px] font-semibold text-white">
            No se pudo abrir la sala
          </p>
          <p className="max-w-md text-[13px] leading-relaxed text-white/70">
            {error.mensaje}
          </p>
          <p className="text-[12px] text-white/45">
            Servidor de videollamadas: {dominio}
          </p>
          {/*
            La salida de emergencia. Es la misma sala en el mismo servidor, solo
            que sin empotrar, y sirve para dos cosas: que la clase no se pierda
            por un fallo del iframe, y para saber de que lado esta el problema.
            Si aqui tampoco entra, no es de esta aplicacion.
          */}
          <a
            href={`https://${dominio}/${sala}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 rounded-sm border border-white/25 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-white/10"
          >
            Abrir la sala en una pestaña nueva
          </a>
        </div>
      )}

      {error && !error.fatal && (
        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-center px-4 py-3">
          <p className="flex max-w-lg items-start gap-3 rounded-sm border border-aviso/40 bg-aviso-tenue px-3 py-2 text-[12.5px] leading-relaxed text-aviso shadow-lg">
            <span className="min-w-0">{error.mensaje}</span>
            <button
              onClick={() => setError(null)}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              Cerrar
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
