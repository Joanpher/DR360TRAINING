import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useConsulta } from '../../datos/consulta'
import { Boton } from '../../ui/Boton'
import type { Curso } from '../catalogo'
import type { ResultadoInscripcion } from '../inscripciones'
import { Esqueleto, Nota } from '../piezas'
import { DialogoCredenciales, FormularioInscripcion } from './Inscripciones'

export function CrearInscripcion() {
  const { cursoId = '' } = useParams()
  const navegar = useNavigate()
  const cursos = useConsulta<{ cursos: Curso[] }>('/catalogo/cursos')
  const [resultado, setResultado] = useState<ResultadoInscripcion | null>(null)

  const curso = cursos.datos?.cursos.find((item) => item.id === cursoId) ?? null

  return (
    <div className="w-full space-y-6">
      <Link
        to="/admin/inscripciones"
        className="inline-flex items-center gap-2 text-[13px] text-tinta-media hover:text-pizarra"
      >
        <ArrowLeft size={15} strokeWidth={1.75} />
        Volver a inscripciones
      </Link>

      <header>
        <h1 className="font-display text-[26px] font-bold leading-tight text-tinta">
          {curso ? `Inscribir en ${curso.nombre}` : 'Nueva inscripción'}
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-tinta-media">
          Registra a una persona nueva o elige a alguien que ya tenga matrícula.
        </p>
      </header>

      {cursos.cargando && !cursos.datos ? (
        <Esqueleto filas={6} />
      ) : cursos.error && !cursos.datos ? (
        <div className="space-y-3">
          <Nota tono="error">{cursos.error}</Nota>
          <Boton variante="secundario" onClick={() => void cursos.recargar()}>
            Reintentar
          </Boton>
        </div>
      ) : !curso ? (
        <Nota tono="error">Ese curso no existe.</Nota>
      ) : curso.estado === 'graduado' ? (
        <Nota tono="aviso">Ese curso ya terminó y no admite nuevas inscripciones.</Nota>
      ) : (
        <FormularioInscripcion
          cursos={cursos.datos!.cursos}
          cursoInicialId={curso.id}
          alCerrar={() => navegar('/admin/inscripciones')}
          alListo={(nuevoResultado) => {
            if (nuevoResultado.clave) setResultado(nuevoResultado)
            else navegar('/admin/inscripciones')
          }}
        />
      )}

      <DialogoCredenciales
        resultado={resultado}
        alCerrar={() => navegar('/admin/inscripciones')}
      />
    </div>
  )
}
