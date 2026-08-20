import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Lock, Mail, User } from 'lucide-react'
import { Boton } from '../ui/Boton'
import { Campo } from '../ui/Campo'
import { Aviso, MarcoAcceso } from '../layout/MarcoAcceso'
import { useSesion } from '../app/sesion'
import { ErrorApi } from '../datos/api'

/*
  La cuenta nace sin institucion. Es a proposito: la misma persona puede acabar
  siendo docente en una universidad y estudiante en otra, y la identidad vive
  por encima de las dos. El siguiente paso decide si crea la suya o espera una
  invitacion.
*/
export function CrearCuenta() {
  const { registrar } = useSesion()
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    const datos = new FormData(e.currentTarget)
    try {
      await registrar({
        nombres: String(datos.get('nombres') ?? '').trim(),
        apellidos: String(datos.get('apellidos') ?? '').trim(),
        correo: String(datos.get('correo') ?? '').trim(),
        contrasena: String(datos.get('contrasena') ?? ''),
      })
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo crear la cuenta.')
      setEnviando(false)
    }
  }

  return (
    <MarcoAcceso
      entrada="Crear cuenta"
      titulo="Empieza en Educa"
      descripcion="Primero la cuenta, después la institución. Son dos cosas distintas y en ese orden."
      pie={
        <p className="text-[13px] leading-relaxed text-tinta-media">
          ¿Ya tienes cuenta?{' '}
          <Link to="/acceso" className="text-pizarra underline-offset-4 hover:underline">
            Inicia sesión
          </Link>
          .
        </p>
      }
    >
      <form onSubmit={alEnviar} className="flex flex-col gap-5">
        {error && <Aviso>{error}</Aviso>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Nombres"
            name="nombres"
            icono={User}
            autoComplete="given-name"
            placeholder="Joanpher"
            required
            autoFocus
          />
          <Campo
            etiqueta="Apellidos"
            name="apellidos"
            autoComplete="family-name"
            placeholder="Jiménez"
            required
          />
        </div>

        <Campo
          etiqueta="Correo"
          name="correo"
          icono={Mail}
          type="email"
          autoComplete="email"
          placeholder="nombre@institucion.edu.do"
          required
        />

        <Campo
          etiqueta="Contraseña"
          name="contrasena"
          icono={Lock}
          type="password"
          autoComplete="new-password"
          placeholder="Al menos 10 caracteres"
          minLength={10}
          ayuda="Una frase que recuerdes resiste más que ocho caracteres con símbolos."
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
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </Boton>
      </form>
    </MarcoAcceso>
  )
}
