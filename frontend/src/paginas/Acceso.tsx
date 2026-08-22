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
      titulo="Bienvenido de nuevo"
      descripcion="Usa tu correo institucional o tu matrícula para continuar."
      pie={
        <p className="text-[13px] leading-relaxed text-tinta-media">
          ¿Administras una institución?{' '}
          <Link
            to="/crear-cuenta"
            className="text-pizarra underline-offset-4 hover:underline"
          >
            Crea una cuenta para comenzar
          </Link>
          .
        </p>
      }
    >
      <form onSubmit={alEnviar} className="flex flex-col gap-4">
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

        <Campo
          etiqueta="Contraseña"
          name="contrasena"
          icono={Lock}
          type="password"
          autoComplete="current-password"
          placeholder="Tu contraseña"
          required
        />

        <Boton
          type="submit"
          variante="primario"
          tamano="lg"
          ancho
          disabled={enviando}
          iconoDer={<ArrowRight size={16} strokeWidth={1.75} />}
        >
          {enviando ? 'Entrando…' : 'Iniciar sesión'}
        </Boton>

      </form>
    </MarcoAcceso>
  )
}
