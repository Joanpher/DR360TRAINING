import { Activity, BookOpen, Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRol } from '../app/rol'
import { useSesion } from '../app/sesion'
import { usePortal } from '../portal/contexto'
import { TarjetaCursoPortal } from '../portal/TarjetaCursoPortal'
import { Boton } from '../ui/Boton'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Ficha, FichaCabecera } from '../ui/Ficha'

export function Inicio() {
  const { rol } = useRol()
  const { usuario, institucion } = useSesion()
  const { cursos, cargando, error, recargar } = usePortal()
  const esDocente = rol === 'docente'
  const activos = cursos.filter((curso) => curso.estado === 'activo').length
  const graduados = cursos.filter((curso) => curso.estado === 'graduado').length
  const bloquesSemanales = cursos.reduce((total, curso) => total + curso.horarios.length, 0)
  const inscripciones = cursos.reduce((total, curso) => total + curso.inscritos, 0)

  const resumen = esDocente
    ? [
        { etiqueta: 'Cursos asignados', valor: cursos.length, pie: institucion?.nombre ?? '' },
        { etiqueta: 'En docencia', valor: activos, pie: 'Cursos activos' },
        { etiqueta: 'Clases por semana', valor: bloquesSemanales, pie: 'Bloques programados' },
        { etiqueta: 'Inscripciones', valor: inscripciones, pie: 'Registros vigentes' },
      ]
    : [
        { etiqueta: 'Mis cursos', valor: cursos.length, pie: institucion?.nombre ?? '' },
        { etiqueta: 'En curso', valor: activos, pie: 'Cursos activos' },
        { etiqueta: 'Clases por semana', valor: bloquesSemanales, pie: 'Bloques programados' },
        { etiqueta: 'Completados', valor: graduados, pie: 'Cursos finalizados' },
      ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight text-tinta">
            Buen día, {usuario?.nombres.split(' ')[0] ?? ''}
          </h1>
          <p className="etiqueta-dato mt-1.5 text-tinta-suave">{institucion?.nombre}</p>
        </div>
        <Link to="/calendario" className="text-[13px] font-medium text-pizarra hover:underline underline-offset-4">
          Ver mi horario
        </Link>
      </header>

      <Ficha>
        <dl className="grid grid-cols-2 divide-regla md:grid-cols-4 md:divide-x">
          {resumen.map((dato, indice) => (
            <div key={dato.etiqueta} className={`px-5 py-4 ${indice < 2 ? 'border-b border-regla md:border-b-0' : ''}`}>
              <dt className="etiqueta-dato text-tinta-suave">{dato.etiqueta}</dt>
              <dd className="mt-2 font-dato text-[28px] font-medium leading-none tabular-nums text-tinta">
                {cargando ? '—' : dato.valor}
              </dd>
              <p className="mt-1.5 truncate text-[12px] text-tinta-suave">{dato.pie}</p>
            </div>
          ))}
        </dl>
      </Ficha>

      <Ficha className="overflow-hidden">
        <FichaCabecera
          titulo={esDocente ? 'Cursos que impartes' : 'Mis cursos'}
          descripcion={cargando ? 'Cargando asignaciones…' : `${cursos.length} ${cursos.length === 1 ? 'curso' : 'cursos'}`}
          accion={<Link to="/cursos" className="text-[13px] font-medium text-pizarra hover:underline underline-offset-4">Ver todos</Link>}
        />
        {error ? (
          <EstadoVacio icono={BookOpen} titulo="No se pudieron cargar los cursos" texto={error} accion={<Boton tamano="sm" onClick={() => void recargar()}>Reintentar</Boton>} />
        ) : cargando ? (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-72 animate-pulse rounded-md bg-lienzo" />)}
          </div>
        ) : cursos.length === 0 ? (
          <EstadoVacio icono={BookOpen} titulo={esDocente ? 'No tienes cursos asignados' : 'No tienes cursos inscritos'} texto={esDocente ? 'Cuando te asignen como instructor, el curso aparecerá aquí.' : 'Tus cursos aparecerán aquí después de la inscripción.'} />
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {cursos.slice(0, 3).map((curso) => <TarjetaCursoPortal key={curso.id} curso={curso} />)}
          </div>
        )}
      </Ficha>

      <div className="grid gap-6 lg:grid-cols-2">
        <Ficha>
          <FichaCabecera titulo="Anuncios" />
          <EstadoVacio icono={Megaphone} titulo="No hay anuncios" texto="La institución todavía no ha publicado anuncios." />
        </Ficha>
        <Ficha>
          <FichaCabecera titulo="Actividad reciente" />
          <EstadoVacio icono={Activity} titulo="Sin actividad reciente" texto="Los cambios de tus cursos aparecerán aquí." />
        </Ficha>
      </div>
    </div>
  )
}
