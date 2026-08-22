import { useEffect, useState } from 'react'
import { MapPin, Plus } from 'lucide-react'
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
import type { Sede } from '../catalogo'

type Respuesta = { sedes: Sede[] }

/*
  Las sedes existen para que un horario pueda decir "aula 204 del campus de
  San Pedro" y para que los reportes se puedan partir por recinto.

  La sede principal es la que se usa cuando nadie elige ninguna, y solo puede
  haber una: por eso se cambia marcando otra, no desmarcando esta.
*/
export function Sedes() {
  const { datos, cargando, error, recargar, fijar } = useConsulta<Respuesta>(
    '/catalogo/sedes',
  )
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Sede | null>(null)
  const { guardar, guardando, error: errorGuardar } = useGuardar()

  async function operar(operacion: () => Promise<Respuesta>) {
    const r = await guardar(operacion)
    if (r) fijar(r)
    return r
  }

  return (
    <Pantalla
      titulo="Sedes"
      descripcion="Los recintos de la institución. Cada curso presencial y cada persona pueden pertenecer a una."
      datos={datos}
      cargando={cargando}
      error={error}
      recargar={recargar}
      accion={
        <Boton
          variante="primario"
          iconoIzq={<Plus size={15} strokeWidth={1.75} />}
          onClick={() => setCreando(true)}
        >
          Crear sede
        </Boton>
      }
    >
      {({ sedes }) => (
        <>
          {errorGuardar && <Nota tono="error">{errorGuardar}</Nota>}

          <Ficha>
            {sedes.length === 0 ? (
              <EstadoVacio
                icono={MapPin}
                titulo="Todavía no hay sedes"
                texto="La primera que crees quedará marcada como principal: es la que se usa cuando nadie elige otra."
                accion={
                  <Boton variante="primario" onClick={() => setCreando(true)}>
                    Crear la primera sede
                  </Boton>
                }
              />
            ) : (
              <>
                <Tabla>
                  <Encabezado>
                    <Th className="w-24">Código</Th>
                    <Th>Sede</Th>
                    <Th className="hidden w-48 lg:table-cell">Ciudad</Th>
                    <Th className="hidden w-64 xl:table-cell">Dirección</Th>
                    <Th className="w-28">Personas</Th>
                    <Th className="w-10" />
                  </Encabezado>
                  <tbody>
                    {sedes.map((sede) => (
                      <Fila key={sede.id}>
                        <TdDato className="text-pizarra">{sede.codigo}</TdDato>
                        <Td>
                          <div className="flex items-center gap-3">
                            <MapPin
                              size={16}
                              strokeWidth={1.5}
                              className="shrink-0 text-tinta-suave"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[13.5px] font-medium text-tinta">
                                {sede.nombre}
                              </span>
                              {sede.esPrincipal && (
                                <Etiqueta tono="aprobado">Principal</Etiqueta>
                              )}
                              {!sede.activa && <Etiqueta tono="neutro">Inactiva</Etiqueta>}
                            </div>
                          </div>
                        </Td>
                        <Td className="hidden text-[13px] text-tinta-media lg:table-cell">
                          {sede.ciudad ?? '—'}
                        </Td>
                        <Td className="hidden text-[13px] text-tinta-media xl:table-cell">
                          {sede.direccion ?? '—'}
                        </Td>
                        <TdDato className="text-tinta-media">{sede.personas}</TdDato>
                        <Td className="pr-3">
                          <MenuFila
                            acciones={[
                              { etiqueta: 'Editar sede', alElegir: () => setEditando(sede) },
                              ...(sede.esPrincipal
                                ? []
                                : [
                                    {
                                      etiqueta: 'Marcar como principal',
                                      alElegir: () => {
                                        void operar(() =>
                                          pedir<Respuesta>(
                                            `/catalogo/sedes/${sede.id}/principal`,
                                            { metodo: 'POST' },
                                          ),
                                        )
                                      },
                                    },
                                  ]),
                              {
                                etiqueta: sede.activa ? 'Desactivar' : 'Reactivar',
                                alElegir: () => {
                                  void operar(() =>
                                    pedir<Respuesta>(`/catalogo/sedes/${sede.id}`, {
                                      metodo: 'PATCH',
                                      cuerpo: { activa: !sede.activa },
                                    }),
                                  )
                                },
                              },
                              ...(sede.esPrincipal
                                ? []
                                : [
                                    {
                                      etiqueta: 'Eliminar',
                                      peligrosa: true,
                                      alElegir: () => {
                                        void operar(() =>
                                          pedir<Respuesta>(`/catalogo/sedes/${sede.id}`, {
                                            metodo: 'DELETE',
                                          }),
                                        )
                                      },
                                    },
                                  ]),
                            ]}
                          />
                        </Td>
                      </Fila>
                    ))}
                  </tbody>
                </Tabla>
                <PieDeTabla
                  mostradas={sedes.length}
                  total={sedes.length}
                  sustantivo="sedes"
                />
              </>
            )}
          </Ficha>

          <DialogoSede
            abierto={creando || editando !== null}
            sede={editando}
            guardando={guardando}
            alCerrar={() => {
              setCreando(false)
              setEditando(null)
            }}
            alEnviar={async (cuerpo) => {
              const r = await operar(() =>
                editando
                  ? pedir<Respuesta>(`/catalogo/sedes/${editando.id}`, {
                      metodo: 'PATCH',
                      cuerpo,
                    })
                  : pedir<Respuesta>('/catalogo/sedes', { metodo: 'POST', cuerpo }),
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

/*
  El mismo diálogo crea y edita. Son el mismo formulario con los mismos campos
  y las mismas reglas: duplicarlo garantizaría que un día uno de los dos se
  quede sin un campo que el otro sí tiene.
*/
function DialogoSede({
  abierto,
  sede,
  guardando,
  alCerrar,
  alEnviar,
}: {
  abierto: boolean
  sede: Sede | null
  guardando: boolean
  alCerrar: () => void
  alEnviar: (cuerpo: Record<string, unknown>) => Promise<void>
}) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [direccion, setDireccion] = useState('')

  useEffect(() => {
    if (!abierto) return
    setCodigo(sede?.codigo ?? '')
    setNombre(sede?.nombre ?? '')
    setCiudad(sede?.ciudad ?? '')
    setDireccion(sede?.direccion ?? '')
  }, [abierto, sede])

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={sede ? 'Editar sede' : 'Crear sede'}
      descripcion={
        sede
          ? undefined
          : 'Si es la primera sede de la institución, quedará marcada como principal.'
      }
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
                ciudad: ciudad.trim(),
                direccion: direccion.trim(),
              })
            }
          >
            {guardando ? 'Guardando…' : sede ? 'Guardar cambios' : 'Crear sede'}
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
            placeholder="SPM"
            autoFocus
          />
          <Campo
            etiqueta="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Campus San Pedro"
          />
        </div>
        <Campo
          etiqueta="Ciudad"
          value={ciudad}
          onChange={(e) => setCiudad(e.target.value)}
          placeholder="San Pedro de Macorís"
        />
        <Campo
          etiqueta="Dirección"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Av. Circunvalación, km 2"
        />
      </div>
    </Dialogo>
  )
}
