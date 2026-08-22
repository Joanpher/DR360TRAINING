import { useMemo, useState } from 'react'
import { BookOpen, Search } from 'lucide-react'
import { usePortal } from './contexto'
import { TarjetaCursoDocente } from './TarjetaCursoDocente'
import { Boton } from '../ui/Boton'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Ficha } from '../ui/Ficha'

export function CursosDocente() {
  const { cursos, cargando, error, recargar } = usePortal()
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('todos')
  const inscripciones = cursos.reduce((total, curso) => total + curso.inscritos, 0)

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es')
    return cursos.filter((curso) => {
      const coincideEstado = estado === 'todos' || curso.estado === estado
      const coincideTexto = !termino || [curso.codigo, curso.nombre, curso.categoria ?? ''].some((valor) => valor.toLocaleLowerCase('es').includes(termino))
      return coincideEstado && coincideTexto
    })
  }, [busqueda, cursos, estado])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-regla pb-5">
        <div><p className="etiqueta-dato text-pizarra">Asignación docente</p><h1 className="mt-1 font-display text-[30px] font-bold text-tinta">Mis cursos</h1><p className="mt-2 text-[13px] text-tinta-media">Cursos donde figuras como instructor.</p></div>
        <p className="font-dato text-[12px] text-tinta-suave">{cursos.length} cursos · {inscripciones} inscripciones</p>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-regla bg-superficie p-3">
        <label className="relative min-w-64 flex-1"><span className="sr-only">Buscar cursos</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave" /><input type="search" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar por código o nombre" className="h-10 w-full rounded-sm border border-regla-fuerte bg-superficie pl-9 pr-3 text-[13px] focus:border-pizarra focus:outline-none" /></label>
        <label className="flex items-center gap-2"><span className="etiqueta-dato text-tinta-media">Estado</span><select value={estado} onChange={(evento) => setEstado(evento.target.value)} className="h-10 rounded-sm border border-regla-fuerte bg-superficie px-3 text-[13px] text-tinta focus:border-pizarra focus:outline-none"><option value="todos">Todos</option><option value="promocion">En promoción</option><option value="activo">Activos</option><option value="graduado">Graduados</option></select></label>
      </div>

      {error ? <Ficha><EstadoVacio icono={BookOpen} titulo="No se pudieron cargar tus cursos" texto={error} accion={<Boton tamano="sm" onClick={() => void recargar()}>Reintentar</Boton>} /></Ficha> : cargando ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-96 animate-pulse rounded-md bg-superficie" />)}</div> : cursos.length === 0 ? <Ficha><EstadoVacio icono={BookOpen} titulo="No tienes cursos asignados" texto="Cuando te asignen como instructor, aparecerán aquí." /></Ficha> : filtrados.length === 0 ? <Ficha><EstadoVacio icono={BookOpen} titulo="Ningún curso coincide" texto="Prueba con otro término o estado." /></Ficha> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filtrados.map((curso) => <TarjetaCursoDocente key={curso.id} curso={curso} />)}</div>}
    </div>
  )
}
