import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Tags } from 'lucide-react'
import { Boton } from '../../ui/Boton'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import { Etiqueta } from '../../ui/Etiqueta'
import { EstadoVacio } from '../../ui/EstadoVacio'
import { Ficha } from '../../ui/Ficha'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../../ui/Tabla'
import { pedir } from '../../datos/api'
import { useConsulta, useGuardar } from '../../datos/consulta'
import { Pantalla } from '../Pantalla'
import { MenuFila, Nota, PieDeTabla } from '../piezas'
import type { Categoria } from '../catalogo'

type Respuesta = { categorias: Categoria[] }

/*
  Cómo agrupa el centro su catálogo: Idiomas, Informática, Oficios. Es una lista
  corta y estable que se define una vez y casi no cambia.

  El orden lo decide el centro y no el alfabeto. Un centro que vive de los cursos
  de inglés quiere Idiomas arriba, y ordenar por nombre pondría Administración
  primero por una razón que no le importa a nadie.
*/
export function Categorias() {
  const { datos, cargando, error, recargar, fijar } =
    useConsulta<Respuesta>('/catalogo/categorias')
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Categoria | null>(null)
  const { guardar, guardando, error: errorGuardar } = useGuardar()

  async function operar(operacion: () => Promise<Respuesta>) {
    const r = await guardar(operacion)
    if (r) fijar(r)
    return r
  }

  return (
    <Pantalla
      titulo="Categorías"
      descripcion="Cómo se agrupa el catálogo para que se pueda filtrar. Un curso pertenece a una sola categoría, y puede no tener ninguna."
      datos={datos}
      cargando={cargando}
      error={error}
      recargar={recargar}
      accion={
        <Boton
          variante="primario"
          iconoIzq={<Plus size={15} strokeWidth={1.75} />}
          onClick={() => {
            setEditando(null)
            setCreando(true)
          }}
        >
          Crear categoría
        </Boton>
      }
    >
      {({ categorias }) => (
        <>
          {errorGuardar && <Nota tono="error">{errorGuardar}</Nota>}

          <Ficha>
            {categorias.length === 0 ? (
              <EstadoVacio
                icono={Tags}
                titulo="Todavía no hay categorías"
                texto="Sin categorías el catálogo funciona igual, pero se vuelve una lista plana en cuanto pasa de quince cursos."
                accion={
                  <Boton variante="primario" onClick={() => setCreando(true)}>
                    Crear la primera categoría
                  </Boton>
                }
              />
            ) : (
              <>
                <Tabla>
                  <Encabezado>
                    <Th className="w-14">Orden</Th>
                    <Th>Categoría</Th>
                    <Th className="hidden lg:table-cell">Descripción</Th>
                    <Th className="w-28">Cursos</Th>
                    <Th className="w-10" />
                  </Encabezado>
                  <tbody>
                    {categorias.map((categoria) => (
                      <Fila key={categoria.id}>
                        <TdDato className="text-tinta-suave">{categoria.orden}</TdDato>
                        <Td>
                          <div className="flex flex-wrap items-center gap-2">
                            {/*
                              El color es la única razón por la que esta columna
                              no es solo texto: es lo que después distingue las
                              tarjetas del catálogo de un vistazo.
                            */}
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full border border-regla"
                              style={{ backgroundColor: categoria.color ?? 'transparent' }}
                              aria-hidden
                            />
                            <span className="text-[13.5px] font-medium text-tinta">
                              {categoria.nombre}
                            </span>
                            {!categoria.activa && <Etiqueta tono="neutro">Inactiva</Etiqueta>}
                          </div>
                        </Td>
                        <Td className="hidden max-w-md truncate text-[13px] text-tinta-media lg:table-cell">
                          {categoria.descripcion ?? '—'}
                        </Td>
                        <Td>
                          {categoria.cursos === 0 ? (
                            <span className="text-[13px] text-tinta-suave">Sin cursos</span>
                          ) : (
                            <span className="font-dato text-[13px] tabular-nums text-tinta-media">
                              {categoria.cursos}{' '}
                              {categoria.cursos === 1 ? 'curso' : 'cursos'}
                            </span>
                          )}
                        </Td>
                        <Td className="pr-3">
                          <MenuFila
                            acciones={[
                              {
                                etiqueta: 'Editar categoría',
                                alElegir: () => {
                                  setCreando(false)
                                  setEditando(categoria)
                                },
                              },
                              {
                                etiqueta: categoria.activa ? 'Desactivar' : 'Reactivar',
                                alElegir: () => {
                                  void operar(() =>
                                    pedir<Respuesta>(`/catalogo/categorias/${categoria.id}`, {
                                      metodo: 'PATCH',
                                      cuerpo: {
                                        nombre: categoria.nombre,
                                        activa: !categoria.activa,
                                      },
                                    }),
                                  )
                                },
                              },
                              {
                                etiqueta: 'Eliminar',
                                peligrosa: true,
                                alElegir: () => {
                                  void operar(() =>
                                    pedir<Respuesta>(`/catalogo/categorias/${categoria.id}`, {
                                      metodo: 'DELETE',
                                    }),
                                  )
                                },
                              },
                            ]}
                          />
                        </Td>
                      </Fila>
                    ))}
                  </tbody>
                </Tabla>
                <PieDeTabla
                  mostradas={categorias.length}
                  total={categorias.length}
                  sustantivo="categorías"
                />
              </>
            )}
          </Ficha>

          <p className="text-[12.5px] leading-relaxed text-tinta-suave">
            Una categoría con cursos dentro no se puede eliminar: desactívala y dejará de
            ofrecerse al crear cursos nuevos, sin tocar los que ya la usan.{' '}
            <Link to="/admin/cursos" className="text-pizarra underline-offset-4 hover:underline">
              Ver el catálogo
            </Link>
            .
          </p>

          <DialogoCategoria
            abierto={creando || editando !== null}
            categoria={editando}
            guardando={guardando}
            siguienteOrden={categorias.length}
            alCerrar={() => {
              setCreando(false)
              setEditando(null)
            }}
            alEnviar={async (cuerpo) => {
              const r = await operar(() =>
                editando
                  ? pedir<Respuesta>(`/catalogo/categorias/${editando.id}`, {
                      metodo: 'PATCH',
                      cuerpo,
                    })
                  : pedir<Respuesta>('/catalogo/categorias', { metodo: 'POST', cuerpo }),
              )
              if (r) {
                setCreando(false)
                setEditando(null)
              }
            }}
          />
        </>
      )}
    </Pantalla>
  )
}

function DialogoCategoria({
  abierto,
  categoria,
  guardando,
  siguienteOrden,
  alCerrar,
  alEnviar,
}: {
  abierto: boolean
  categoria: Categoria | null
  guardando: boolean
  siguienteOrden: number
  alCerrar: () => void
  alEnviar: (cuerpo: Record<string, unknown>) => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [color, setColor] = useState('#2f6f4e')
  const [orden, setOrden] = useState('0')

  useEffect(() => {
    if (!abierto) return
    setNombre(categoria?.nombre ?? '')
    setDescripcion(categoria?.descripcion ?? '')
    setColor(categoria?.color ?? '#2f6f4e')
    setOrden(String(categoria?.orden ?? siguienteOrden))
  }, [abierto, categoria, siguienteOrden])

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={categoria ? 'Editar categoría' : 'Crear categoría'}
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            disabled={guardando || nombre.trim() === ''}
            onClick={() =>
              void alEnviar({
                nombre: nombre.trim(),
                descripcion: descripcion.trim(),
                color,
                orden: Number(orden) || 0,
                activa: categoria?.activa ?? true,
              })
            }
          >
            {guardando ? 'Guardando…' : categoria ? 'Guardar cambios' : 'Crear categoría'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo
          etiqueta="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Idiomas"
          autoFocus
        />
        <Campo
          etiqueta="Descripción"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Inglés, francés y portugués para adultos"
          ayuda="Opcional. Se muestra bajo el nombre en el catálogo."
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="color-categoria"
              className="etiqueta-dato text-[11.5px] font-semibold text-tinta"
            >
              Color
            </label>
            <div className="flex items-center gap-2.5">
              <input
                id="color-categoria"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-11 w-16 cursor-pointer rounded-sm border border-regla-fuerte bg-superficie p-1"
              />
              <span className="font-dato text-[13px] uppercase text-tinta-media">{color}</span>
            </div>
            <p className="text-[12px] text-tinta-suave">
              Distingue la categoría en las tarjetas del catálogo.
            </p>
          </div>
          <Campo
            etiqueta="Orden"
            type="number"
            min={0}
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            ayuda="Menor primero."
          />
        </div>
      </div>
    </Dialogo>
  )
}
