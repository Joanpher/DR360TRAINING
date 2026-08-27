import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Users } from 'lucide-react'
import { iniciales } from '../../app/sesion'
import { useConsulta } from '../../datos/consulta'
import { Boton } from '../../ui/Boton'
import { Buscador } from '../../ui/Buscador'
import { EstadoVacio } from '../../ui/EstadoVacio'
import { Ficha } from '../../ui/Ficha'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../../ui/Tabla'
import { cn } from '../../ui/cn'
import { Pantalla } from '../Pantalla'
import {
  BarraFiltros,
  EstadoDeMembresia,
  FiltroSelect,
  PieDeTabla,
  RolesDePersona,
} from '../piezas'
import { haceCuanto, type ListaPersonas } from '../personas'

const OPCIONES_ROL = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'administracion', texto: 'Administración' },
  { valor: 'docente', texto: 'Instructores' },
  { valor: 'coordinador', texto: 'Coordinadores' },
  { valor: 'estudiante', texto: 'Estudiantes' },
  { valor: 'invitado', texto: 'Invitados' },
]

const OPCIONES_ESTADO = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'activa', texto: 'Activas' },
  { valor: 'suspendida', texto: 'Suspendidas' },
  { valor: 'retirada', texto: 'Retiradas' },
  { valor: 'egresada', texto: 'Egresadas' },
]

export function Personas() {
  const navegar = useNavigate()
  const [texto, setTexto] = useState('')
  const [rol, setRol] = useState('todos')
  const [estado, setEstado] = useState('todos')
  const [pagina, setPagina] = useState(1)

  const ruta = useMemo(() => {
    const parametros = new URLSearchParams({ pagina: String(pagina), porPagina: '25' })
    if (texto.trim()) parametros.set('busqueda', texto.trim())
    if (rol !== 'todos') parametros.set('rol', rol)
    if (estado !== 'todos') parametros.set('estado', estado)
    return `/personas?${parametros}`
  }, [texto, rol, estado, pagina])

  const { datos, cargando, error, recargar } = useConsulta<ListaPersonas>(ruta)

  function cambiarFiltro(cambio: () => void) {
    setPagina(1)
    cambio()
  }

  return (
    <Pantalla
      icono={Users}
      color="azul"
      titulo="Usuarios"
      descripcion="Personas vinculadas a la institución y el rol que cumplen aquí. Los estudiantes aparecen automáticamente cuando se inscriben en un curso."
      datos={datos}
      cargando={cargando}
      error={error}
      recargar={recargar}
      accion={
        <Boton
          variante="primario"
          iconoIzq={<UserPlus size={15} strokeWidth={1.5} />}
          onClick={() => navegar('/admin/personas/nueva')}
        >
          Registrar usuario
        </Boton>
      }
    >
      {(lista) => (
        <Ficha>
          <BarraFiltros>
            <Buscador
              valor={texto}
              alCambiar={(valor) => cambiarFiltro(() => setTexto(valor))}
              placeholder="Buscar por nombre, correo o código"
              className="min-w-[240px] flex-1"
            />
            <FiltroSelect
              etiqueta="Rol"
              valor={rol}
              alCambiar={(valor) => cambiarFiltro(() => setRol(valor))}
              opciones={OPCIONES_ROL}
            />
            <FiltroSelect
              etiqueta="Estado"
              valor={estado}
              alCambiar={(valor) => cambiarFiltro(() => setEstado(valor))}
              opciones={OPCIONES_ESTADO}
            />
          </BarraFiltros>

          {lista.personas.length === 0 ? (
            <EstadoVacio
              icono={Users}
              titulo={texto || rol !== 'todos' || estado !== 'todos' ? 'Nadie coincide' : 'Aún no hay usuarios'}
              texto={
                texto || rol !== 'todos' || estado !== 'todos'
                  ? 'Prueba con otro término o quita los filtros.'
                  : 'Registra al personal de la institución. Los estudiantes llegarán desde las inscripciones.'
              }
              accion={
                !texto && rol === 'todos' && estado === 'todos' ? (
                  <Boton variante="primario" onClick={() => navegar('/admin/personas/nueva')}>
                    Registrar usuario
                  </Boton>
                ) : undefined
              }
            />
          ) : (
            <>
              <Tabla>
                <Encabezado>
                  <Th>Usuario</Th>
                  <Th className="w-32">Código</Th>
                  <Th className="w-56">Roles</Th>
                  <Th className="w-28">Estado</Th>
                  <Th className="hidden w-32 lg:table-cell">Último acceso</Th>
                </Encabezado>
                <tbody>
                  {lista.personas.map((persona) => (
                    <Fila key={persona.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-xs font-dato text-[12px] font-semibold',
                              persona.estado === 'activa'
                                ? 'bg-pizarra-tenue text-pizarra'
                                : 'bg-lienzo text-tinta-suave',
                            )}
                          >
                            {iniciales(persona.nombre)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-medium text-tinta">
                              {persona.nombre}
                            </p>
                            <p className="truncate font-dato text-[11.5px] text-tinta-suave">
                              {persona.correo ?? 'Sin correo'}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <TdDato className="text-tinta-media">{persona.codigo ?? '—'}</TdDato>
                      <Td><RolesDePersona roles={persona.roles} /></Td>
                      <Td><EstadoDeMembresia estado={persona.estado} /></Td>
                      <TdDato className="hidden text-tinta-suave lg:table-cell">
                        {haceCuanto(persona.ultimoAcceso)}
                      </TdDato>
                    </Fila>
                  ))}
                </tbody>
              </Tabla>
              <PieDeTabla mostradas={lista.personas.length} total={lista.total} sustantivo="usuarios" />

              {lista.total > lista.porPagina && (
                <div className="flex items-center justify-end gap-2 border-t border-regla px-5 py-2.5">
                  <Boton variante="secundario" tamano="sm" disabled={pagina <= 1} onClick={() => setPagina((valor) => valor - 1)}>
                    Anterior
                  </Boton>
                  <span className="font-dato text-[12px] text-tinta-suave">
                    {pagina} de {Math.ceil(lista.total / lista.porPagina)}
                  </span>
                  <Boton variante="secundario" tamano="sm" disabled={pagina >= Math.ceil(lista.total / lista.porPagina)} onClick={() => setPagina((valor) => valor + 1)}>
                    Siguiente
                  </Boton>
                </div>
              )}
            </>
          )}
        </Ficha>
      )}
    </Pantalla>
  )
}
