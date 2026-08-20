import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Lock, UserRound } from 'lucide-react'
import { Boton } from '../ui/Boton'
import { Campo } from '../ui/Campo'
import { Aviso, MarcoAcceso } from '../layout/MarcoAcceso'
import { useSesion } from '../app/sesion'
import { ErrorApi } from '../datos/api'

export function Acceso() {
  const { entrar } = useSesion()
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    const datos = new FormData(e.currentTarget)
    try {
      await entrar(
        String(datos.get('identidad') ?? ''),
        String(datos.get('contrasena') ?? ''),
      )
      // La redireccion la decide App segun el estado de la sesion: si la
      // cuenta no tiene instituciones va al onboarding, si tiene una entra
      // directo y si tiene varias las muestra para elegir.
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo iniciar sesión.')
      setEnviando(false)
    }
  }

  return (
    <MarcoAcceso
      entrada="Iniciar sesión"
      titulo="Entra a Educa"
      descripcion="Si trabajas en la institución, entra con tu correo. Si eres estudiante, con la matrícula que te dio el colegio."
      pie={
        <p className="text-[13px] leading-relaxed text-tinta-media">
          ¿Vas a montar tu institución en Educa?{' '}
          <Link
            to="/crear-cuenta"
            className="text-pizarra underline-offset-4 hover:underline"
          >
            Crea una cuenta
          </Link>
          . Si tu universidad ya está aquí, las cuentas las crea ella y te
          llegan por invitación.
        </p>
      }
    >
      <form onSubmit={alEnviar} className="flex flex-col gap-5">
        {error && <Aviso>{error}</Aviso>}

        {/*
          Un solo campo para las dos credenciales. Preguntar antes "¿eres
          estudiante o personal?" obligaría a saber la respuesta a alguien que
          solo quiere entrar; el servidor lo deduce de la arroba.
        */}
        <Campo
          etiqueta="Correo o matrícula"
          name="identidad"
          icono={UserRound}
          autoComplete="username"
          placeholder="nombre@colegio.edu.do  ·  LGL-2026-0001"
          required
          autoFocus
        />

        <div>
          <Campo
            etiqueta="Contraseña o clave"
            name="contrasena"
            icono={Lock}
            type="password"
            autoComplete="current-password"
            placeholder="La que usas para entrar"
            required
          />
          <a
            href="#recuperar"
            className="mt-2 inline-block text-[13px] text-pizarra underline-offset-4 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        <Boton
          type="submit"
          variante="primario"
          tamano="lg"
          ancho
          disabled={enviando}
          iconoDer={<ArrowRight size={16} strokeWidth={1.75} />}
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </Boton>

      </form>
    </MarcoAcceso>
  )
}
