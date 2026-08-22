import { useState, type FormEvent } from 'react'
import { ArrowLeft, Check, Clipboard, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { pedir } from '../../datos/api'
import { useGuardar } from '../../datos/consulta'
import { Boton } from '../../ui/Boton'
import { Campo } from '../../ui/Campo'
import { Ficha } from '../../ui/Ficha'
import { cn } from '../../ui/cn'
import { Nota } from '../piezas'
import type { Persona, RolDeAlta } from '../personas'

type ResultadoAlta = { persona: Persona; clave: string | null; esUsuarioNuevo: boolean }

const ROLES: Array<{ valor: RolDeAlta; nombre: string; descripcion: string }> = [
  { valor: 'docente', nombre: 'Instructor', descripcion: 'Imparte cursos, publica material y califica entregas.' },
  { valor: 'coordinador', nombre: 'Coordinador', descripcion: 'Organiza el catálogo y coordina los cursos de su área.' },
  { valor: 'administrador', nombre: 'Administrador', descripcion: 'Gestiona usuarios, cursos y la configuración institucional.' },
  { valor: 'invitado', nombre: 'Invitado', descripcion: 'Tiene acceso de consulta limitado dentro de la institución.' },
]

export function CrearUsuario() {
  const [rol, setRol] = useState<RolDeAlta>('docente')
  const [resultado, setResultado] = useState<ResultadoAlta | null>(null)
  const [copiado, setCopiado] = useState(false)
  const { guardar, guardando, error } = useGuardar()

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const formulario = new FormData(evento.currentTarget)
    const respuesta = await guardar(() => pedir<ResultadoAlta>('/personas', {
      metodo: 'POST',
      cuerpo: {
        nombres: formulario.get('nombres'),
        apellidos: formulario.get('apellidos'),
        correo: formulario.get('correo'),
        telefono: formulario.get('telefono'),
        codigo: formulario.get('codigo'),
        rol,
      },
    }))
    if (respuesta) {
      setCopiado(false)
      setResultado(respuesta)
    }
  }

  async function copiarCredenciales() {
    if (!resultado?.clave) return
    await navigator.clipboard.writeText(`Correo: ${resultado.persona.correo}\nContraseña inicial: ${resultado.clave}`)
    setCopiado(true)
  }

  if (resultado) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <EnlaceVolver />
        <Ficha className="overflow-hidden">
          <div className="border-b border-regla bg-pizarra-tenue px-6 py-5">
            <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-sm bg-pizarra text-white">
              <Check size={19} strokeWidth={2} />
            </span>
            <h1 className="font-display text-[24px] font-bold text-tinta">Usuario registrado</h1>
            <p className="mt-1 text-[13.5px] text-tinta-media">
              {resultado.persona.nombre} ya pertenece a la institución.
            </p>
          </div>

          <div className="space-y-5 px-6 py-6">
            {resultado.clave ? (
              <>
                <div>
                  <p className="text-[13.5px] font-medium text-tinta">Credenciales de acceso</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-tinta-suave">
                    Esta contraseña solo se muestra ahora. Entrégasela al usuario por un medio seguro.
                  </p>
                </div>
                <dl className="divide-y divide-regla rounded-sm border border-regla bg-lienzo">
                  <DatoCredencial etiqueta="Correo" valor={resultado.persona.correo ?? ''} />
                  <DatoCredencial etiqueta="Contraseña inicial" valor={resultado.clave} destacado />
                </dl>
                <Boton variante="secundario" iconoIzq={copiado ? <Check size={15} /> : <Clipboard size={15} />} onClick={() => void copiarCredenciales()}>
                  {copiado ? 'Credenciales copiadas' : 'Copiar credenciales'}
                </Boton>
              </>
            ) : (
              <Nota tono="exito">
                El correo ya tenía una cuenta en DR360TRAINING. Conserva su contraseña actual y ahora también puede entrar a esta institución.
              </Nota>
            )}

            <div className="flex flex-wrap gap-2 border-t border-regla pt-5">
              <Boton variante="primario" onClick={() => setResultado(null)}>Registrar otro usuario</Boton>
              <Link to="/admin/personas" className="inline-flex h-10 items-center justify-center rounded-sm border border-regla-fuerte bg-superficie px-4 text-sm font-medium text-tinta hover:bg-lienzo">
                Ir a usuarios
              </Link>
            </div>
          </div>
        </Ficha>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <EnlaceVolver />
      <header>
        <h1 className="font-display text-[26px] font-bold leading-tight text-tinta">Registrar usuario</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-tinta-media">
          Crea el acceso de una persona y define su función inicial en la institución. Los estudiantes se crean desde la inscripción a un curso.
        </p>
      </header>

      <form onSubmit={alEnviar}>
        <Ficha className="overflow-hidden">
          <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="text-[14px] font-semibold text-tinta">Datos personales</h2>
              <p className="mt-1 text-[12.5px] text-tinta-suave">El correo será el identificador que usará para iniciar sesión.</p>
            </div>
            <Campo etiqueta="Nombres" name="nombres" autoComplete="given-name" required autoFocus />
            <Campo etiqueta="Apellidos" name="apellidos" autoComplete="family-name" required />
            <Campo etiqueta="Correo electrónico" name="correo" type="email" autoComplete="email" required />
            <Campo etiqueta="Teléfono" name="telefono" type="tel" autoComplete="tel" />
            <Campo etiqueta="Código interno" name="codigo" ayuda="Opcional: código de empleado u otra referencia de la institución." />
          </div>

          <fieldset className="border-t border-regla px-6 py-6">
            <legend className="sr-only">Rol inicial</legend>
            <h2 className="text-[14px] font-semibold text-tinta">Rol inicial</h2>
            <p className="mt-1 text-[12.5px] text-tinta-suave">Podrás añadir otros roles institucionales después.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {ROLES.map((opcion) => (
                <label key={opcion.valor} className={cn('flex min-h-24 cursor-pointer gap-3 rounded-sm border px-4 py-3 transition-colors', rol === opcion.valor ? 'border-pizarra bg-pizarra-tenue' : 'border-regla-fuerte bg-superficie hover:bg-lienzo')}>
                  <input type="radio" name="rol" value={opcion.valor} checked={rol === opcion.valor} onChange={() => setRol(opcion.valor)} className="mt-1 accent-pizarra" />
                  <span>
                    <span className="block text-[13.5px] font-medium text-tinta">{opcion.nombre}</span>
                    <span className="mt-1 block text-[12px] leading-relaxed text-tinta-suave">{opcion.descripcion}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-regla bg-lienzo px-6 py-4">
            <p className="text-[12px] text-tinta-suave">Se generará una contraseña inicial para las cuentas nuevas.</p>
            <div className="flex gap-2">
              <Link to="/admin/personas" className="inline-flex h-10 items-center justify-center rounded-sm px-4 text-sm font-medium text-tinta-media hover:bg-pizarra-tenue hover:text-pizarra">Cancelar</Link>
              <Boton type="submit" variante="primario" disabled={guardando} iconoIzq={<UserPlus size={15} strokeWidth={1.5} />}>
                {guardando ? 'Registrando…' : 'Registrar usuario'}
              </Boton>
            </div>
          </div>
        </Ficha>
        {error && <div className="mt-4"><Nota tono="error">{error}</Nota></div>}
      </form>
    </div>
  )
}

function EnlaceVolver() {
  return (
    <Link to="/admin/personas" className="inline-flex items-center gap-2 text-[13px] text-tinta-media hover:text-pizarra">
      <ArrowLeft size={15} strokeWidth={1.75} /> Volver a usuarios
    </Link>
  )
}

function DatoCredencial({ etiqueta, valor, destacado = false }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_1fr] sm:items-center">
      <dt className="etiqueta-dato text-tinta-suave">{etiqueta}</dt>
      <dd className={cn('font-dato text-[13px] text-tinta', destacado && 'text-[15px] font-semibold')}>{valor}</dd>
    </div>
  )
}
