import { useMemo, useState } from 'react'
import { BookOpen, Search } from 'lucide-react'
import { usePortal } from './contexto'
import { TarjetaCursoEstudiante } from './TarjetaCursoEstudiante'
import { Boton } from '../ui/Boton'
import { cn } from '../ui/cn'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Ficha } from '../ui/Ficha'

const vistas = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'activo', etiqueta: 'En curso' },
  { valor: 'promocion', etiqueta: 'Próximamente' },
  { valor: 'graduado', etiqueta: 'Completados' },
] as const

export function CursosEstudiante() {
  const { cursos, cargando, error, recargar } = usePortal()
  const [vista, setVista] = useState<(typeof vistas)[number]['valor']>('todos')
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es')
    return cursos.filter((curso) => {
      const coincideVista = vista === 'todos' || curso.estado === vista
      const coincideBusqueda = !termino || [curso.codigo, curso.nombre, curso.instructor ?? '', curso.categoria ?? ''].some((valor) => valor.toLocaleLowerCase('es').includes(termino))
      return coincideVista && coincideBusqueda
    })
  }, [busqueda, cursos, vista])

  return (
    <div className="space-y-6">
      <header className="border-b border-regla pb-5">
        <p className="etiqueta-dato text-pizarra">Tu aprendizaje</p>
        <h1 className="mt-1 font-display text-[30px] font-bold leading-tight text-tinta">Mis cursos</h1>
        <p className="mt-2 text-[13px] text-tinta-media">Todo lo que estás cursando y tu historial en la institución.</p>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-full overflow-x-auto border-b border-regla">
          {vistas.map((item) => {
            const cantidad = item.valor === 'todos' ? cursos.length : cursos.filter((curso) => curso.estado === item.valor).length
            return <button key={item.valor} onClick={() => setVista(item.valor)} className={cn('relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-[13px] font-medium after:absolute after:inset-x-2 after:-bottom-px after:h-[2px]', vista === item.valor ? 'text-pizarra after:bg-pizarra' : 'text-tinta-media after:bg-transparent hover:text-tinta')}><span>{item.etiqueta}</span><span className="font-dato text-[10.5px] text-tinta-suave">{cantidad}</span></button>
          })}
        </div>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Buscar en mis cursos</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave" />
          <input type="search" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar curso" className="h-10 w-full rounded-sm border border-regla-fuerte bg-superficie pl-9 pr-3 text-[13px] focus:border-pizarra focus:outline-none" />
        </label>
      </div>

      {error ? (
        <Ficha><EstadoVacio icono={BookOpen} titulo="No se pudieron cargar tus cursos" texto={error} accion={<Boton tamano="sm" onClick={() => void recargar()}>Reintentar</Boton>} /></Ficha>
      ) : cargando ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-96 animate-pulse rounded-md bg-superficie" />)}</div>
      ) : cursos.length === 0 ? (
        <Ficha><EstadoVacio icono={BookOpen} titulo="Todavía no tienes cursos" texto="Tus cursos aparecerán aquí después de la inscripción." /></Ficha>
      ) : filtrados.length === 0 ? (
        <Ficha><EstadoVacio icono={BookOpen} titulo="No encontramos cursos" texto="Prueba con otro filtro o término de búsqueda." /></Ficha>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filtrados.map((curso) => <TarjetaCursoEstudiante key={curso.id} curso={curso} />)}</div>
      )}
    </div>
  )
}
