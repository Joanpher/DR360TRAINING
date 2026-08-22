import { useMemo, useState } from 'react'
import { BookOpen, Search } from 'lucide-react'
import { useRol } from '../app/rol'
import { usePortal } from '../portal/contexto'
import { TarjetaCursoPortal } from '../portal/TarjetaCursoPortal'
import { Boton } from '../ui/Boton'
import { EstadoVacio } from '../ui/EstadoVacio'

export function Cursos() {
  const { rol } = useRol()
  const { cursos, cargando, error, recargar } = usePortal()
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('todos')

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es')
    return cursos.filter((curso) => {
      const coincideEstado = estado === 'todos' || curso.estado === estado
      const coincideTexto = !termino || [curso.codigo, curso.nombre, curso.categoria ?? '', curso.instructor ?? '']
        .some((valor) => valor.toLocaleLowerCase('es').includes(termino))
      return coincideEstado && coincideTexto
    })
  }, [busqueda, cursos, estado])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[28px] font-bold leading-tight text-tinta">Cursos</h1>
        <p className="mt-1.5 text-[13px] text-tinta-media">
          {rol === 'docente' ? 'Cursos asignados como instructor.' : 'Cursos en los que estás inscrito.'}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 border border-regla bg-superficie p-3 rounded-md">
        <label className="relative min-w-64 flex-1">
          <span className="sr-only">Buscar cursos</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave" />
          <input type="search" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar por código, curso o instructor" className="h-10 w-full rounded-sm border border-regla-fuerte bg-superficie pl-9 pr-3 text-[13px] placeholder:text-tinta-suave focus:border-pizarra focus:outline-none" />
        </label>
        <label className="flex items-center gap-2">
          <span className="etiqueta-dato text-tinta-media">Estado</span>
          <select value={estado} onChange={(evento) => setEstado(evento.target.value)} className="h-10 rounded-sm border border-regla-fuerte bg-superficie px-3 text-[13px] text-tinta focus:border-pizarra focus:outline-none">
            <option value="todos">Todos</option>
            <option value="promocion">En promoción</option>
            <option value="activo">Activos</option>
            <option value="graduado">Graduados</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="border border-regla bg-superficie rounded-md">
          <EstadoVacio icono={BookOpen} titulo="No se pudieron cargar los cursos" texto={error} accion={<Boton tamano="sm" onClick={() => void recargar()}>Reintentar</Boton>} />
        </div>
      ) : cargando ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-96 animate-pulse rounded-md bg-superficie" />)}
        </div>
      ) : cursos.length === 0 ? (
        <div className="border border-regla bg-superficie rounded-md">
          <EstadoVacio icono={BookOpen} titulo={rol === 'docente' ? 'No tienes cursos asignados' : 'No tienes cursos inscritos'} texto={rol === 'docente' ? 'Cuando la administración te asigne un curso, aparecerá aquí.' : 'Tus cursos aparecerán aquí después de la inscripción.'} />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="border border-regla bg-superficie rounded-md">
          <EstadoVacio icono={BookOpen} titulo="Ningún curso coincide" texto="Prueba con otro término o estado." />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((curso) => <TarjetaCursoPortal key={curso.id} curso={curso} />)}
        </div>
      )}
    </div>
  )
}
