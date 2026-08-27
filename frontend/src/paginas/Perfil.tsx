import { useRef, useState, type FormEvent } from 'react'
import {
  BadgeCheck,
  Building2,
  ImagePlus,
  KeyRound,
  LogOut,
  Monitor,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { iniciales, useSesion } from '../app/sesion'
import { pedir } from '../datos/api'
import { useConsulta, useGuardar } from '../datos/consulta'
import { prepararAvatar } from '../datos/portada'
import { Boton } from '../ui/Boton'
import { Campo } from '../ui/Campo'
import { cn } from '../ui/cn'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Etiqueta } from '../ui/Etiqueta'
import { Ficha, FichaCabecera } from '../ui/Ficha'

/*
  La cuenta: lo unico de esta plataforma que no pertenece a una institucion sino
  a la persona.

  Es la misma pantalla para los tres paneles, y esta en paginas/ y no en admin/
  ni en portal/ justamente por eso. Un administrador que ademas da clase en otro
  centro tiene una sola contrasena y una sola lista de sesiones abiertas; darle
  dos perfiles distintos segun por donde entre seria describir mal lo que hay.
*/

type Perfil = {
  id: string
  correo: string
  nombres: string
  apellidos: string
  nombreCompleto: string
  telefono: string | null
  avatarUrl: string | null
  correoVerificado: boolean
  tieneContrasena: boolean
  creadoEn: string
  ultimoAccesoEn: string | null
}

type SesionAbierta = {
  id: string
  ip: string | null
  agente: string | null
  creadoEn: string
  ultimoUsoEn: string
  expiraEn: string
  esActual: boolean
}

type Respuesta = { perfil: Perfil; sesiones: SesionAbierta[] }

export function Perfil() {
  const consulta = useConsulta<Respuesta>('/perfil')

  if (consulta.cargando) {
    return (
      <div className="space-y-5">
        <div className="h-32 animate-pulse rounded-md bg-superficie" />
        <div className="h-96 animate-pulse rounded-md bg-superficie" />
      </div>
    )
  }

  if (consulta.error || !consulta.datos) {
    return (
      <Ficha>
        <EstadoVacio
          icono={UserRound}
          titulo="No se pudo cargar tu perfil"
          texto={consulta.error ?? 'Vuelve a intentarlo en un momento.'}
          accion={
            <Boton tamano="sm" onClick={() => void consulta.recargar()}>
              Reintentar
            </Boton>
          }
        />
      </Ficha>
    )
  }

  const { perfil, sesiones } = consulta.datos

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border-b border-regla pb-5">
        <p className="etiqueta-dato text-pizarra">Tu cuenta</p>
        <h1 className="mt-1 font-display text-[30px] font-bold leading-tight text-tinta">
          Mi perfil
        </h1>
        <p className="mt-2 text-[13px] text-tinta-media">
          Tus datos, tu contraseña y las sesiones abiertas con tu nombre. Es lo único
          de esta plataforma que no pertenece a una institución sino a ti.
        </p>
      </header>

      <DatosPersonales perfil={perfil} alGuardar={() => void consulta.recargar()} />
      <Membresias />
      <Contrasena perfil={perfil} alCambiar={() => void consulta.recargar()} />
      <Sesiones sesiones={sesiones} alCambiar={() => void consulta.recargar()} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Datos personales
// ---------------------------------------------------------------------------
function DatosPersonales({
  perfil,
  alGuardar,
}: {
  perfil: Perfil
  alGuardar: () => void
}) {
  const { refrescarContexto } = useSesion()
  const [nombres, setNombres] = useState(perfil.nombres)
  const [apellidos, setApellidos] = useState(perfil.apellidos)
  const [telefono, setTelefono] = useState(perfil.telefono ?? '')
  const [avatar, setAvatar] = useState(perfil.avatarUrl)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  const archivo = useRef<HTMLInputElement>(null)
  const guardado = useGuardar()

  const cambiado =
    nombres !== perfil.nombres ||
    apellidos !== perfil.apellidos ||
    telefono !== (perfil.telefono ?? '') ||
    avatar !== perfil.avatarUrl

  async function elegirFoto(lista: FileList | null) {
    const elegido = lista?.[0]
    if (!elegido) return
    setErrorFoto(null)
    try {
      setAvatar(await prepararAvatar(elegido))
    } catch (error) {
      setErrorFoto(error instanceof Error ? error.message : 'No se pudo leer la imagen.')
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const hecho = await guardado.guardar(() =>
      pedir<{ perfil: Perfil }>('/perfil', {
        metodo: 'PATCH',
        cuerpo: {
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          telefono: telefono.trim(),
          avatarUrl: avatar ?? '',
        },
      }),
    )
    if (hecho) {
      alGuardar()
      // La barra superior y el menu llevan el nombre y la foto: sin esto
      // seguirian mostrando los viejos hasta la proxima recarga de la pagina.
      await refrescarContexto()
    }
  }

  return (
    <Ficha>
      <FichaCabecera
        titulo="Datos personales"
        descripcion="Así te ve el resto de la plataforma."
      />
      <form onSubmit={enviar} className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-regla bg-lienzo font-display text-[19px] font-semibold text-tinta-media">
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              iniciales(perfil.nombreCompleto)
            )}
          </span>
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <Boton
                type="button"
                tamano="sm"
                iconoIzq={<ImagePlus size={14} />}
                onClick={() => archivo.current?.click()}
              >
                {avatar ? 'Cambiar foto' : 'Subir foto'}
              </Boton>
              {avatar && (
                <Boton type="button" tamano="sm" variante="fantasma" onClick={() => setAvatar(null)}>
                  Quitar
                </Boton>
              )}
            </div>
            <p className={cn('text-[12px]', errorFoto ? 'text-correccion' : 'text-tinta-suave')}>
              {errorFoto ?? 'JPEG, PNG o WebP. Se recorta cuadrada y se optimiza sola.'}
            </p>
          </div>
          <input
            ref={archivo}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(evento) => {
              void elegirFoto(evento.target.files)
              evento.target.value = ''
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Nombres"
            value={nombres}
            onChange={(evento) => setNombres(evento.target.value)}
            maxLength={80}
            required
          />
          <Campo
            etiqueta="Apellidos"
            value={apellidos}
            onChange={(evento) => setApellidos(evento.target.value)}
            maxLength={80}
            required
          />
          <Campo
            etiqueta="Teléfono"
            value={telefono}
            onChange={(evento) => setTelefono(evento.target.value)}
            maxLength={40}
            ayuda="Opcional."
          />
          <div className="flex flex-col gap-1.5">
            <span className="etiqueta-dato text-[11.5px] font-semibold text-tinta">
              Correo
            </span>
            <div className="flex h-11 items-center gap-2 rounded-sm border border-regla bg-lienzo px-3 text-sm text-tinta-media">
              <span className="truncate">{perfil.correo}</span>
              {perfil.correoVerificado && (
                <BadgeCheck size={15} className="shrink-0 text-exito" />
              )}
            </div>
            {/*
              El correo no se edita aqui. Cambiarlo es cambiar de identidad para
              entrar, y eso pide verificar el nuevo antes de soltar el viejo: un
              flujo con su propio envio de correo, que todavia no existe.
            */}
            <p className="text-[12px] text-tinta-suave">
              El correo con el que entras no se cambia desde aquí.
            </p>
          </div>
        </div>

        {guardado.error && <p className="text-[12.5px] text-correccion">{guardado.error}</p>}

        <div className="flex items-center justify-end gap-3">
          {guardado.listo && !cambiado && (
            <span className="text-[12.5px] text-exito">Guardado.</span>
          )}
          <Boton
            type="submit"
            variante="primario"
            disabled={guardado.guardando || !cambiado || !nombres.trim() || !apellidos.trim()}
          >
            {guardado.guardando ? 'Guardando…' : 'Guardar cambios'}
          </Boton>
        </div>
      </form>
    </Ficha>
  )
}

// ---------------------------------------------------------------------------
// Donde perteneces
// ---------------------------------------------------------------------------
function Membresias() {
  const { instituciones, institucion } = useSesion()

  return (
    <Ficha>
      <FichaCabecera
        titulo="Tus instituciones"
        descripcion="Dónde perteneces y con qué papel."
      />
      <div className="divide-y divide-regla">
        {instituciones.map((una) => (
          <div key={una.id} className="flex items-center gap-3 px-5 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-regla bg-lienzo text-tinta-suave">
              <Building2 size={16} strokeWidth={1.5} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-tinta">{una.nombre}</p>
              <p className="font-dato text-[12px] text-tinta-suave">
                {una.roles.length ? una.roles.join(' · ') : 'Sin rol asignado'}
              </p>
            </div>
            {una.id === institucion?.id && <Etiqueta tono="aprobado">Estás aquí</Etiqueta>}
          </div>
        ))}
      </div>
    </Ficha>
  )
}

// ---------------------------------------------------------------------------
// Contrasena
// ---------------------------------------------------------------------------
function Contrasena({ perfil, alCambiar }: { perfil: Perfil; alCambiar: () => void }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const guardado = useGuardar()
  const [cerradas, setCerradas] = useState<number | null>(null)

  const noCoinciden = repetida.length > 0 && nueva !== repetida

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const hecho = await guardado.guardar(() =>
      pedir<{ sesionesCerradas: number }>('/perfil/contrasena', {
        metodo: 'POST',
        cuerpo: { actual, nueva },
      }),
    )
    if (hecho) {
      setActual('')
      setNueva('')
      setRepetida('')
      setCerradas(hecho.sesionesCerradas)
      alCambiar()
    }
  }

  if (!perfil.tieneContrasena) {
    return (
      <Ficha>
        <FichaCabecera titulo="Contraseña" />
        <p className="px-5 py-6 text-[13px] text-tinta-media">
          Esta cuenta no entra con contraseña, así que no hay ninguna que cambiar.
        </p>
      </Ficha>
    )
  }

  return (
    <Ficha>
      <FichaCabecera
        titulo="Contraseña"
        descripcion="Cambiarla cierra las demás sesiones abiertas con tu cuenta."
      />
      <form onSubmit={enviar} className="space-y-4 p-5">
        <Campo
          etiqueta="Contraseña actual"
          type="password"
          icono={KeyRound}
          value={actual}
          onChange={(evento) => setActual(evento.target.value)}
          autoComplete="current-password"
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Contraseña nueva"
            type="password"
            value={nueva}
            onChange={(evento) => setNueva(evento.target.value)}
            autoComplete="new-password"
            minLength={10}
            ayuda="Al menos 10 caracteres. Una frase larga vale más que símbolos."
            required
          />
          <Campo
            etiqueta="Repítela"
            type="password"
            value={repetida}
            onChange={(evento) => setRepetida(evento.target.value)}
            autoComplete="new-password"
            error={noCoinciden ? 'Las dos contraseñas no coinciden.' : undefined}
            required
          />
        </div>

        {guardado.error && <p className="text-[12.5px] text-correccion">{guardado.error}</p>}
        {cerradas !== null && !guardado.error && (
          <p className="flex items-center gap-2 text-[12.5px] text-exito">
            <ShieldCheck size={14} />
            Contraseña cambiada.
            {cerradas > 0
              ? ` Se cerraron ${cerradas} ${cerradas === 1 ? 'sesión' : 'sesiones'} más.`
              : ' No había otras sesiones abiertas.'}
          </p>
        )}

        <div className="flex justify-end">
          <Boton
            type="submit"
            variante="primario"
            disabled={
              guardado.guardando || !actual || nueva.length < 10 || nueva !== repetida
            }
          >
            {guardado.guardando ? 'Cambiando…' : 'Cambiar contraseña'}
          </Boton>
        </div>
      </form>
    </Ficha>
  )
}

// ---------------------------------------------------------------------------
// Sesiones abiertas
// ---------------------------------------------------------------------------
function Sesiones({
  sesiones,
  alCambiar,
}: {
  sesiones: SesionAbierta[]
  alCambiar: () => void
}) {
  const guardado = useGuardar()
  const otras = sesiones.filter((una) => !una.esActual)

  async function cerrar(id: string) {
    const hecho = await guardado.guardar(() =>
      pedir<void>(`/perfil/sesiones/${id}`, { metodo: 'DELETE' }),
    )
    if (hecho !== null) alCambiar()
  }

  async function cerrarTodas() {
    const hecho = await guardado.guardar(() =>
      pedir<{ sesionesCerradas: number }>('/perfil/sesiones/cerrar-las-demas', {
        metodo: 'POST',
      }),
    )
    if (hecho) alCambiar()
  }

  return (
    <Ficha>
      <FichaCabecera
        titulo="Sesiones abiertas"
        descripcion="Desde dónde se puede entrar ahora mismo con tu cuenta."
        accion={
          otras.length > 0 ? (
            <Boton
              tamano="sm"
              variante="peligro"
              iconoIzq={<LogOut size={14} />}
              disabled={guardado.guardando}
              onClick={() => void cerrarTodas()}
            >
              Cerrar las demás
            </Boton>
          ) : undefined
        }
      />

      {guardado.error && (
        <p className="border-b border-regla px-5 py-2.5 text-[12.5px] text-correccion">
          {guardado.error}
        </p>
      )}

      <div className="divide-y divide-regla">
        {sesiones.map((una) => (
          <div key={una.id} className="flex items-start gap-3 px-5 py-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-regla bg-lienzo text-tinta-suave">
              <Monitor size={16} strokeWidth={1.5} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-[13.5px] font-medium text-tinta">
                  {navegador(una.agente)}
                </p>
                {una.esActual && <Etiqueta tono="aprobado">Esta sesión</Etiqueta>}
              </div>
              <p className="font-dato text-[12px] text-tinta-suave">
                {una.ip ?? 'Sin dirección'} · activa {haceCuanto(una.ultimoUsoEn)}
              </p>
            </div>
            {!una.esActual && (
              <button
                onClick={() => void cerrar(una.id)}
                disabled={guardado.guardando}
                aria-label="Cerrar esta sesión"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xs text-tinta-suave hover:bg-correccion-tenue hover:text-correccion disabled:opacity-40"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </Ficha>
  )
}

// ---------------------------------------------------------------------------
/*
  Del user-agent solo interesa reconocer el dispositivo propio de un vistazo.
  Sin biblioteca de deteccion: una cadena de agente es un pantano, y aqui basta
  con acertar el navegador y el sistema para que quien mira sepa cual es el suyo.
*/
function navegador(agente: string | null): string {
  if (!agente) return 'Dispositivo desconocido'
  const navegadores: Array<[RegExp, string]> = [
    [/Edg\//, 'Edge'],
    [/OPR\/|Opera/, 'Opera'],
    [/Chrome\//, 'Chrome'],
    [/Safari\//, 'Safari'],
    [/Firefox\//, 'Firefox'],
  ]
  const sistemas: Array<[RegExp, string]> = [
    [/Windows/, 'Windows'],
    [/Android/, 'Android'],
    [/iPhone|iPad/, 'iOS'],
    [/Mac OS X/, 'macOS'],
    [/Linux/, 'Linux'],
  ]
  const nombre = navegadores.find(([patron]) => patron.test(agente))?.[1]
  const sistema = sistemas.find(([patron]) => patron.test(agente))?.[1]
  if (!nombre && !sistema) return 'Dispositivo desconocido'
  return [nombre, sistema].filter(Boolean).join(' · ')
}

function haceCuanto(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 2) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  return dias === 1 ? 'ayer' : `hace ${dias} días`
}
