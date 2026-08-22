import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Check, Loader2, X } from 'lucide-react'
import { Boton } from '../ui/Boton'
import { Campo } from '../ui/Campo'
import { Aviso, MarcoAcceso } from '../layout/MarcoAcceso'
import { useSesion } from '../app/sesion'
import { ErrorApi, pedir } from '../datos/api'

const TIPOS = [
  ['universidad', 'Universidad'],
  ['instituto', 'Instituto'],
  ['colegio', 'Colegio'],
  ['academia', 'Academia'],
  ['corporativa', 'Formación corporativa'],
]

const PAISES = [
  ['DO', 'República Dominicana'],
  ['MX', 'México'],
  ['CO', 'Colombia'],
  ['AR', 'Argentina'],
  ['CL', 'Chile'],
  ['PE', 'Perú'],
  ['ES', 'España'],
  ['US', 'Estados Unidos'],
]

const ZONAS_POR_PAIS: Record<string, string> = {
  DO: 'America/Santo_Domingo',
  MX: 'America/Mexico_City',
  CO: 'America/Bogota',
  AR: 'America/Argentina/Buenos_Aires',
  CL: 'America/Santiago',
  PE: 'America/Lima',
  ES: 'Europe/Madrid',
  US: 'America/New_York',
}

/* itc.dr360training.com sale del nombre, pero se puede corregir: después es permanente. */
function slugDesde(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function siglasDesde(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter((p) => p.length > 3)
    .slice(0, 5)
    .map((p) => p[0].toUpperCase())
    .join('')
}

type EstadoSlug = 'vacio' | 'formato' | 'comprobando' | 'libre' | 'tomado'

export function Onboarding() {
  const { crearInstitucion, usuario, salir } = useSesion()
  const navegar = useNavigate()

  const [nombre, setNombre] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTocado, setSlugTocado] = useState(false)
  const [siglas, setSiglas] = useState('')
  const [siglasTocadas, setSiglasTocadas] = useState(false)
  const [pais, setPais] = useState('DO')
  const [tipo, setTipo] = useState('universidad')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [estadoSlug, setEstadoSlug] = useState<EstadoSlug>('vacio')

  const slugEfectivo = slugTocado ? slug : slugDesde(nombre)
  const siglasEfectivas = siglasTocadas ? siglas : siglasDesde(nombre)

  /*
    La comprobación del identificador espera a que se deje de escribir. Sin esa
    pausa se dispara una petición por tecla, y la respuesta de la penúltima
    puede llegar después de la última, dejando en pantalla un resultado que ya
    no corresponde a lo que hay en el campo.
  */
  useEffect(() => {
    if (!slugEfectivo) {
      setEstadoSlug('vacio')
      return
    }
    if (!/^[a-z0-9]([a-z0-9-]{1,38})?[a-z0-9]$/.test(slugEfectivo)) {
      setEstadoSlug('formato')
      return
    }

    setEstadoSlug('comprobando')
    let vigente = true

    const temporizador = setTimeout(async () => {
      try {
        const { disponible } = await pedir<{ disponible: boolean }>(
          `/instituciones/disponible?slug=${encodeURIComponent(slugEfectivo)}`,
        )
        if (vigente) setEstadoSlug(disponible ? 'libre' : 'tomado')
      } catch {
        if (vigente) setEstadoSlug('vacio')
      }
    }, 400)

    return () => {
      vigente = false
      clearTimeout(temporizador)
    }
  }, [slugEfectivo])

  const pista = useMemo(() => {
    switch (estadoSlug) {
      case 'formato':
        return { texto: 'Solo minúsculas, números y guiones (3 a 40).', malo: true }
      case 'tomado':
        return { texto: 'Ese identificador ya está tomado.', malo: true }
      case 'libre':
        return { texto: `Disponible · ${slugEfectivo}.dr360training.com`, malo: false }
      case 'comprobando':
        return { texto: 'Comprobando…', malo: false }
      default:
        return { texto: 'Será la dirección pública de tu institución.', malo: false }
    }
  }, [estadoSlug, slugEfectivo])

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await crearInstitucion({
        nombre: nombre.trim(),
        slug: slugEfectivo,
        siglas: siglasEfectivas,
        tipo,
        pais,
        zonaHoraria: ZONAS_POR_PAIS[pais] ?? 'America/Santo_Domingo',
      })
      /*
        Hay que navegar a mano. Esta ruta sigue existiendo con la sesion ya
        dentro —para crear una segunda institucion—, asi que al terminar con
        exito la URL no cambia por si sola y esta misma pantalla se volveria a
        montar como si no hubiera pasado nada.
      */
      navegar('/inicio', { replace: true })
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo crear la institución.')
      setEnviando(false)
    }
  }

  const listo =
    nombre.trim().length >= 3 &&
    siglasEfectivas.length >= 2 &&
    estadoSlug === 'libre' &&
    !enviando

  return (
    <MarcoAcceso
      entrada={`Hola, ${usuario?.nombres ?? ''}`}
      titulo="Crea tu institución"
      descripcion="Serás su propietario. Después podrás invitar al equipo, abrir el período académico y cargar los programas."
      pie={
        <p className="text-[13px] leading-relaxed text-tinta-media">
          ¿Entraste con la cuenta equivocada?{' '}
          <button
            onClick={() => void salir()}
            className="text-pizarra underline-offset-4 hover:underline"
          >
            Cerrar sesión
          </button>
          .
        </p>
      }
    >
      <form onSubmit={alEnviar} className="flex flex-col gap-5">
        {error && <Aviso>{error}</Aviso>}

        <Campo
          etiqueta="Nombre de la institución"
          icono={Building2}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Instituto Tecnico del Caribe"
          required
          autoFocus
        />

        <div>
          <Campo
            etiqueta="Identificador público"
            value={slugEfectivo}
            onChange={(e) => {
              setSlugTocado(true)
              setSlug(e.target.value.toLowerCase())
            }}
            placeholder="uce"
            error={pista.malo ? pista.texto : undefined}
            ayuda={pista.malo ? undefined : pista.texto}
            required
          />
          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-tinta-suave">
            {estadoSlug === 'comprobando' && (
              <Loader2 size={13} strokeWidth={1.75} className="animate-spin" />
            )}
            {estadoSlug === 'libre' && (
              <Check size={13} strokeWidth={2} className="text-pizarra" />
            )}
            {estadoSlug === 'tomado' && (
              <X size={13} strokeWidth={2} className="text-correccion" />
            )}
            <span>No se puede cambiar después.</span>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Siglas"
            value={siglasEfectivas}
            onChange={(e) => {
              setSiglasTocadas(true)
              setSiglas(e.target.value.toUpperCase())
            }}
            placeholder="ITC"
            maxLength={12}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="tipo"
              className="etiqueta-dato text-[11.5px] font-semibold text-tinta"
            >
              Tipo
            </label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="h-11 w-full rounded-sm border border-regla-fuerte bg-superficie px-3 text-sm text-tinta focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15"
            >
              {TIPOS.map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="pais"
            className="etiqueta-dato text-[11.5px] font-semibold text-tinta"
          >
            País
          </label>
          <select
            id="pais"
            value={pais}
            onChange={(e) => setPais(e.target.value)}
            className="h-11 w-full rounded-sm border border-regla-fuerte bg-superficie px-3 text-sm text-tinta focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15"
          >
            {PAISES.map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
          <p className="text-[12px] text-tinta-suave">
            Fija la zona horaria de las clases y las fechas límite:{' '}
            <span className="font-dato">{ZONAS_POR_PAIS[pais]}</span>
          </p>
        </div>

        <Boton
          type="submit"
          variante="primario"
          tamano="lg"
          ancho
          disabled={!listo}
          iconoDer={<ArrowRight size={16} strokeWidth={1.75} />}
        >
          {enviando ? 'Creando…' : 'Crear institución'}
        </Boton>
      </form>
    </MarcoAcceso>
  )
}
