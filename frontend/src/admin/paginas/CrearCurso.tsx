import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { pedir } from '../../datos/api'
import { useConsulta, useGuardar } from '../../datos/consulta'
import { Boton } from '../../ui/Boton'
import type { Categoria, Curso, Instructor, Sede } from '../catalogo'
import { Esqueleto, Nota } from '../piezas'
import { FormularioCurso } from './Cursos'

type RespuestaCursos = { cursos: Curso[] }

export function CrearCurso() {
  const navegar = useNavigate()
  const categorias = useConsulta<{ categorias: Categoria[] }>('/catalogo/categorias')
  const sedes = useConsulta<{ sedes: Sede[] }>('/catalogo/sedes')
  const instructores = useConsulta<{ instructores: Instructor[] }>('/catalogo/cursos/instructores')
  const { guardar, guardando, error: errorGuardar } = useGuardar()

  const cargando = categorias.cargando || sedes.cargando || instructores.cargando
  const error = categorias.error || sedes.error || instructores.error
  const listo = categorias.datos && sedes.datos && instructores.datos

  function recargar() {
    void Promise.all([categorias.recargar(), sedes.recargar(), instructores.recargar()])
  }

  return (
    <div className="w-full space-y-6">
      <Link
        to="/admin/cursos"
        className="inline-flex items-center gap-2 text-[13px] text-tinta-media hover:text-pizarra"
      >
        <ArrowLeft size={15} strokeWidth={1.75} />
        Volver a cursos
      </Link>

      <header>
        <h1 className="font-display text-[26px] font-bold leading-tight text-tinta">Crear curso</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-tinta-media">
          Define lo que se ofrecerá, quién lo impartirá, el horario, el cupo y el precio.
        </p>
      </header>

      {error && !listo ? (
        <div className="space-y-3">
          <Nota tono="error">{error}</Nota>
          <Boton variante="secundario" onClick={recargar}>Reintentar</Boton>
        </div>
      ) : cargando && !listo ? (
        <Esqueleto filas={5} />
      ) : listo ? (
        <>
          {errorGuardar && <Nota tono="error">{errorGuardar}</Nota>}
          <FormularioCurso
            abierto
            enPagina
            curso={null}
            categorias={categorias.datos!.categorias}
            sedes={sedes.datos!.sedes}
            instructores={instructores.datos!.instructores}
            guardando={guardando}
            alCerrar={() => navegar('/admin/cursos')}
            alEnviar={async (cuerpo) => {
              const respuesta = await guardar(() =>
                pedir<RespuestaCursos>('/catalogo/cursos', { metodo: 'POST', cuerpo }),
              )
              if (respuesta) navegar('/admin/cursos')
            }}
          />
        </>
      ) : null}
    </div>
  )
}
