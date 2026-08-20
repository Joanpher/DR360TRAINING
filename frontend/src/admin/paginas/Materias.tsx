import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookMarked, Plus } from 'lucide-react'
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
import type { Asignatura } from '../academico'

type Respuesta = { asignaturas: Asignatura[] }

/*
  El catálogo de materias del colegio. Es una lista corta y estable —Matemática,
  Lengua Española, Ciencias Sociales— que se define una vez y casi no cambia.

  Una materia no es un curso. "Matemática" es la materia; "Matemática de 3ro A
  en 2026-2027" es el curso. Confundirlas lleva a crear la misma materia una vez
  por cada grupo que la recibe, y a partir de ahí ningún reporte cuadra.
*/
export function Materias() {
  const { datos, cargando, error, recargar, fijar } = useConsulta<Respuesta>(
    '/academico/asignaturas',
  )
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Asignatura | null>(null)
  const { guardar, guardando, error: errorGuardar } = useGuardar()

  async function operar(operacion: () => Promise<Respuesta>) {
    const r = await guardar(operacion)
    if (r) fijar(r)
    return r
  }

  return (
    <Pantalla
      titulo="Materias"
      descripcion="Las asignaturas que imparte el colegio. Se definen una vez aquí y luego se reparten entre los grados desde el plan de estudio de cada uno."
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
          Crear materia
        </Boton>
      }
    >
      {({ asignaturas }) => (
        <>
          {errorGuardar && <Nota tono="error">{errorGuardar}</Nota>}

          <Ficha>
            {asignaturas.length === 0 ? (
              <EstadoVacio
                icono={BookMarked}
                titulo="Todavía no hay materias"
                texto="Sin materias no se puede armar el plan de estudio de ningún grado, y sin plan las secciones nacen sin cursos."
                accion={
                  <Boton variante="primario" onClick={() => setCreando(true)}>
                    Crear la primera materia
                  </Boton>
                }
              />
            ) : (
              <>
                <Tabla>
                  <Encabezado>
                    <Th className="w-24">Código</Th>
                    <Th>Materia</Th>
                    <Th className="hidden w-52 lg:table-cell">Área curricular</Th>
                    <Th className="w-32">En grados</Th>
                    <Th className="w-10" />
                  </Encabezado>
                  <tbody>
                    {asignaturas.map((materia) => (
                      <Fila key={materia.id}>
                        <TdDato className="text-pizarra">{materia.codigo}</TdDato>
                        <Td>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13.5px] font-medium text-tinta">
                              {materia.nombre}
                            </span>
                            {!materia.activa && <Etiqueta tono="neutro">Inactiva</Etiqueta>}
                          </div>
                        </Td>
                        <Td className="hidden text-[13px] text-tinta-media lg:table-cell">
                          {materia.area ?? '—'}
                        </Td>
                        <Td>
                          {materia.grados === 0 ? (
                            <span className="text-[13px] text-tinta-suave">
                              En ningún plan
                            </span>
                          ) : (
                            <span className="font-dato text-[13px] tabular-nums text-tinta-media">
                              {materia.grados}{' '}
                              {materia.grados === 1 ? 'grado' : 'grados'}
                            </span>
                          )}
                        </Td>
                        <Td className="pr-3">
                          <MenuFila
                            acciones={[
                              {
                                etiqueta: 'Editar materia',
                                alElegir: () => {
                                  setCreando(false)
                                  setEditando(materia)
                                },
                              },
                              {
                                etiqueta: materia.activa ? 'Desactivar' : 'Reactivar',
                                alElegir: () => {
                                  void operar(() =>
                                    pedir<Respuesta>(
                                      `/academico/asignaturas/${materia.id}`,
                                      { metodo: 'PATCH', cuerpo: { activa: !materia.activa } },
                                    ),
                                  )
                                },
                              },
                              {
                                etiqueta: 'Eliminar',
                                peligrosa: true,
                                alElegir: () => {
                                  void operar(() =>
                                    pedir<Respuesta>(
                                      `/academico/asignaturas/${materia.id}`,
                                      { metodo: 'DELETE' },
                                    ),
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
                  mostradas={asignaturas.length}
                  total={asignaturas.length}
                  sustantivo="materias"
                />
              </>
            )}
          </Ficha>

          <p className="text-[12.5px] leading-relaxed text-tinta-suave">
            Una materia desactivada deja de aparecer al armar planes nuevos, pero los cursos
            que ya la imparten siguen intactos.{' '}
            <Link to="/admin/grados" className="text-pizarra underline-offset-4 hover:underline">
              Reparte las materias entre los grados
            </Link>{' '}
            desde el plan de estudio de cada uno.
          </p>

          <DialogoMateria
            abierto={creando || editando !== null}
            materia={editando}
            guardando={guardando}
            alCerrar={() => {
              setCreando(false)
              setEditando(null)
            }}
            alEnviar={async (cuerpo) => {
              const r = await operar(() =>
                editando
                  ? pedir<Respuesta>(`/academico/asignaturas/${editando.id}`, {
                      metodo: 'PATCH',
                      cuerpo,
                    })
                  : pedir<Respuesta>('/academico/asignaturas', { metodo: 'POST', cuerpo }),
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

function DialogoMateria({
  abierto,
  materia,
  guardando,
  alCerrar,
  alEnviar,
}: {
  abierto: boolean
  materia: Asignatura | null
  guardando: boolean
  alCerrar: () => void
  alEnviar: (cuerpo: Record<string, unknown>) => Promise<void>
}) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [area, setArea] = useState('')

  useEffect(() => {
    if (!abierto) return
    setCodigo(materia?.codigo ?? '')
    setNombre(materia?.nombre ?? '')
    setArea(materia?.area ?? '')
  }, [abierto, materia])

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={materia ? 'Editar materia' : 'Crear materia'}
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            disabled={guardando || codigo.trim() === '' || nombre.trim() === ''}
            onClick={() =>
              void alEnviar({
                codigo: codigo.trim(),
                nombre: nombre.trim(),
                area: area.trim(),
              })
            }
          >
            {guardando ? 'Guardando…' : materia ? 'Guardar cambios' : 'Crear materia'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <Campo
            etiqueta="Código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="MAT"
            autoFocus
          />
          <Campo
            etiqueta="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Matemática"
          />
        </div>
        <Campo
          etiqueta="Área curricular"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="Ciencias"
          ayuda="Opcional. Sirve para agrupar materias en los reportes del MINERD."
        />
      </div>
    </Dialogo>
  )
}
