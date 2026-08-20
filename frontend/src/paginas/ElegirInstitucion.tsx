import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Plus } from 'lucide-react'
import { Etiqueta } from '../ui/Etiqueta'
import { Aviso, MarcoAcceso } from '../layout/MarcoAcceso'
import { nombreRolInstitucional } from '../app/rol'
import { useSesion } from '../app/sesion'
import { ErrorApi } from '../datos/api'

const ROL_LEGIBLE = nombreRolInstitucional

/*
  Solo aparece cuando la cuenta pertenece a más de una institución. Con una
  sola, el backend ya devuelve la sesión con el contexto puesto y esta pantalla
  no llega a verse: preguntar cuando hay una única respuesta posible es hacerle
  perder un clic a casi todo el mundo.
*/
export function ElegirInstitucion() {
  const { instituciones, elegirInstitucion, usuario, salir } = useSesion()
  const navegar = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [entrando, setEntrando] = useState<string | null>(null)

  async function elegir(id: string) {
    setError(null)
    setEntrando(id)
    try {
      await elegirInstitucion(id)
      // Igual que en el alta: esta ruta sigue disponible desde dentro para
      // cambiar de institucion, asi que el destino se navega explicitamente.
      navegar('/inicio', { replace: true })
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo entrar.')
      setEntrando(null)
    }
  }

  return (
    <MarcoAcceso
      entrada={`Hola, ${usuario?.nombres ?? ''}`}
      titulo="¿Dónde vas a trabajar hoy?"
      descripcion="Tu cuenta pertenece a varias instituciones. Los datos de cada una están separados: lo que veas dentro depende de la que elijas."
      pie={
        <p className="text-[13px] leading-relaxed text-tinta-media">
          ¿No es tu cuenta?{' '}
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
      <div className="flex flex-col gap-3">
        {error && <Aviso>{error}</Aviso>}

        <ul className="flex flex-col gap-2">
          {instituciones.map((institucion) => (
            <li key={institucion.id}>
              <button
                onClick={() => void elegir(institucion.id)}
                disabled={entrando !== null}
                className="group flex w-full items-center gap-3 rounded-sm border border-regla-fuerte bg-superficie px-3.5 py-3 text-left transition-colors hover:border-pizarra hover:bg-pizarra-tenue disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xs bg-pizarra font-dato text-[12px] font-semibold text-white">
                  {institucion.siglas ?? <Building2 size={16} strokeWidth={1.5} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-tinta">
                    {institucion.nombre}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {institucion.roles.map((rol) => (
                      <Etiqueta key={rol} tono={rol === 'propietario' ? 'aprobado' : 'neutro'}>
                        {ROL_LEGIBLE[rol] ?? rol}
                      </Etiqueta>
                    ))}
                    {institucion.estado === 'en_onboarding' && (
                      <Etiqueta tono="aviso">Sin configurar</Etiqueta>
                    )}
                  </span>
                </span>

                <ArrowRight
                  size={16}
                  strokeWidth={1.75}
                  className="shrink-0 text-tinta-suave transition-colors group-hover:text-pizarra"
                />
              </button>
            </li>
          ))}
        </ul>

        <Link
          to="/crear-institucion"
          className="flex items-center gap-2 rounded-sm border border-dashed border-regla-fuerte px-3.5 py-3 text-[13px] text-tinta-media hover:border-pizarra hover:text-pizarra"
        >
          <Plus size={15} strokeWidth={1.75} />
          Crear otra institución
        </Link>
      </div>
    </MarcoAcceso>
  )
}
