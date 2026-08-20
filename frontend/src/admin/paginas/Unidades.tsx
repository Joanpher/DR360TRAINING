import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Network, Plus } from 'lucide-react'
import { Boton } from '../../ui/Boton'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import { Etiqueta } from '../../ui/Etiqueta'
import { EstadoVacio } from '../../ui/EstadoVacio'
import { Ficha } from '../../ui/Ficha'
import { Selector } from '../../ui/Selector'
import { cn } from '../../ui/cn'
import { pedir } from '../../datos/api'
import { useConsulta, useGuardar } from '../../datos/consulta'
import { Pantalla } from '../Pantalla'
import { MenuFila, Nota } from '../piezas'
import { nombreTipoUnidad, type Sede, type Unidad } from '../academico'

type Respuesta = { unidades: Unidad[] }

/*
  Las unidades académicas son un árbol -facultad, escuela, departamento- y por
  eso esta pantalla no es una tabla: la relación padre-hijo es el dato, y una
  tabla con una columna "padre" obliga a reconstruir mentalmente la jerarquía
  que aquí se ve de golpe.

  Quien coordina una unidad no se asigna desde aquí sino desde la ficha de la
  persona: el rol de coordinador es una propiedad de la membresía, y tenerlo en
  dos sitios que se puedan contradecir sería peor que tenerlo en uno solo.
*/
export function Unidades() {
  const { datos, cargando, error, recargar, fijar } = useConsulta<Respuesta>(
    '/academico/unidades',
  )
  const sedes = useConsulta<{ sedes: Sede[] }>('/academico/sedes')
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Unidad | null>(null)
  const [padrePropuesto, setPadrePropuesto] = useState<string | null>(null)
  const { guardar, guardando, error: errorGuardar } = useGuardar()

  async function operar(operacion: () => Promise<Respuesta>) {
    const r = await guardar(operacion)
    if (r) fijar(r)
    return r
  }

  function abrirCreacion(padreId: string | null) {
    setPadrePropuesto(padreId)
    setEditando(null)
    setCreando(true)
  }

  return (
    <Pantalla
      titulo="Unidades académicas"
      descripcion="La estructura interna de la institución. Define de quién dependen los programas y hasta dónde llega el alcance de un coordinador."
      datos={datos}
      cargando={cargando}
      error={error}
      recargar={recargar}
      accion={
        <Boton
          variante="primario"
          iconoIzq={<Plus size={15} strokeWidth={1.75} />}
          onClick={() => abrirCreacion(null)}
        >
          Crear unidad
        </Boton>
      }
    >
      {({ unidades }) => (
        <>
          {errorGuardar && <Nota tono="error">{errorGuardar}</Nota>}

          <Ficha>
            {unidades.length === 0 ? (
              <EstadoVacio
                icono={Network}
                titulo="Todavía no hay unidades"
                texto="Empieza por las de primer nivel —las facultades— y luego cuelga de ellas escuelas y departamentos."
                accion={
                  <Boton variante="primario" onClick={() => abrirCreacion(null)}>
                    Crear la primera unidad
                  </Boton>
                }
              />
            ) : (
              <Arbol
                unidades={unidades}
                alEditar={(unidad) => {
                  setCreando(false)
                  setEditando(unidad)
                }}
                alCrearHija={(padreId) => abrirCreacion(padreId)}
                alOperar={operar}
              />
            )}
          </Ficha>

          <DialogoUnidad
            abierto={creando || editando !== null}
            unidad={editando}
            padrePropuesto={padrePropuesto}
            unidades={unidades}
            sedes={sedes.datos?.sedes ?? []}
            guardando={guardando}
            alCerrar={() => {
              setCreando(false)
              setEditando(null)
              setPadrePropuesto(null)
            }}
            alEnviar={async (cuerpo) => {
              const r = await operar(() =>
                editando
                  ? pedir<Respuesta>(`/academico/unidades/${editando.id}`, {
                      metodo: 'PATCH',
                      cuerpo,
                    })
                  : pedir<Respuesta>('/academico/unidades', { metodo: 'POST', cuerpo }),
              )
              if (r) {
                setCreando(false)
                setEditando(null)
                setPadrePropuesto(null)
              }
            }}
          />
        </>
      )}
    </Pantalla>
  )
}

/*
  El árbol se arma en el navegador a partir de la lista plana. Son decenas de
  filas, no miles: pedirle a la base una consulta recursiva para ordenar algo
  que cabe entero en memoria sería trabajo de más en el sitio más caro.
*/
function Arbol({
  unidades,
  alEditar,
  alCrearHija,
  alOperar,
}: {
  unidades: Unidad[]
  alEditar: (unidad: Unidad) => void
  alCrearHija: (padreId: string) => void
  alOperar: (operacion: () => Promise<Respuesta>) => Promise<Respuesta | null>
}) {
  const porPadre = useMemo(() => {
    const mapa = new Map<string | null, Unidad[]>()
    for (const unidad of unidades) {
      const clave = unidad.padreId
      mapa.set(clave, [...(mapa.get(clave) ?? []), unidad])
    }
    return mapa
  }, [unidades])

  /*
    Una unidad cuyo padre fue eliminado quedaría fuera del árbol y desaparecería
    de la pantalla sin estar borrada. Se cuelgan de la raíz para que se vean.
  */
  const ids = new Set(unidades.map((u) => u.id))
  const raices = unidades.filter((u) => u.padreId === null || !ids.has(u.padreId))

  function ramas(unidad: Unidad, nivel: number): React.ReactNode[] {
    const hijas = porPadre.get(unidad.id) ?? []
    return [
      <FilaUnidad
        key={unidad.id}
        unidad={unidad}
        nivel={nivel}
        alEditar={alEditar}
        alCrearHija={alCrearHija}
        alOperar={alOperar}
      />,
      ...hijas.flatMap((hija) => ramas(hija, nivel + 1)),
    ]
  }

  return <ul>{raices.flatMap((raiz) => ramas(raiz, 0))}</ul>
}

function FilaUnidad({
  unidad,
  nivel,
  alEditar,
  alCrearHija,
  alOperar,
}: {
  unidad: Unidad
  nivel: number
  alEditar: (unidad: Unidad) => void
  alCrearHija: (padreId: string) => void
  alOperar: (operacion: () => Promise<Respuesta>) => Promise<Respuesta | null>
}) {
  return (
    <li className="border-b border-regla last:border-b-0">
      <div
        className="flex items-center gap-4 py-3 pr-3 hover:bg-lienzo"
        style={{ paddingLeft: `${20 + nivel * 26}px` }}
      >
        {/* La sangría sola no basta: una guía de 1px hace visible de qué cuelga. */}
        {nivel > 0 && (
          <span aria-hidden="true" className="-ml-4 h-px w-3 shrink-0 bg-regla-fuerte" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-dato text-[12px] text-pizarra">{unidad.codigo}</span>
            <span
              className={cn(
                'truncate text-tinta',
                nivel === 0 ? 'text-[14px] font-semibold' : 'text-[13.5px]',
              )}
            >
              {unidad.nombre}
            </span>
            {!unidad.activa && <Etiqueta tono="neutro">Inactiva</Etiqueta>}
          </div>
          <p className="mt-0.5 font-dato text-[11.5px] text-tinta-suave">
            {nombreTipoUnidad[unidad.tipo]} · {unidad.grados} grado
            {unidad.grados === 1 ? '' : 's'}
            {unidad.sede ? ` · ${unidad.sede}` : ''}
          </p>
        </div>

        <div className="hidden w-56 shrink-0 sm:block">
          {unidad.responsables.length > 0 ? (
            <span className="text-[13px] text-tinta-media">
              {unidad.responsables.join(', ')}
            </span>
          ) : (
            <Link
              to="/admin/personas"
              className="text-[13px] text-tinta-suave underline-offset-4 hover:text-pizarra hover:underline"
            >
              Sin coordinador
            </Link>
          )}
        </div>

        <MenuFila
          acciones={[
            { etiqueta: 'Editar unidad', alElegir: () => alEditar(unidad) },
            { etiqueta: 'Crear subunidad', alElegir: () => alCrearHija(unidad.id) },
            {
              etiqueta: unidad.activa ? 'Desactivar' : 'Reactivar',
              alElegir: () => {
                void alOperar(() =>
                  pedir<Respuesta>(`/academico/unidades/${unidad.id}`, {
                    metodo: 'PATCH',
                    cuerpo: { activa: !unidad.activa },
                  }),
                )
              },
            },
            {
              etiqueta: 'Eliminar',
              peligrosa: true,
              alElegir: () => {
                void alOperar(() =>
                  pedir<Respuesta>(`/academico/unidades/${unidad.id}`, { metodo: 'DELETE' }),
                )
              },
            },
          ]}
        />
      </div>
    </li>
  )
}

function DialogoUnidad({
  abierto,
  unidad,
  padrePropuesto,
  unidades,
  sedes,
  guardando,
  alCerrar,
  alEnviar,
}: {
  abierto: boolean
  unidad: Unidad | null
  padrePropuesto: string | null
  unidades: Unidad[]
  sedes: Sede[]
  guardando: boolean
  alCerrar: () => void
  alEnviar: (cuerpo: Record<string, unknown>) => Promise<void>
}) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('facultad')
  const [padreId, setPadreId] = useState('')
  const [sedeId, setSedeId] = useState('')

  useEffect(() => {
    if (!abierto) return
    setCodigo(unidad?.codigo ?? '')
    setNombre(unidad?.nombre ?? '')
    setTipo(unidad?.tipo ?? 'facultad')
    setPadreId(unidad?.padreId ?? padrePropuesto ?? '')
    setSedeId(unidad?.sedeId ?? '')
  }, [abierto, unidad, padrePropuesto])

  /*
    Una unidad no puede colgar de sí misma ni de sus descendientes. El servidor
    lo rechaza igualmente, pero ofrecer en el desplegable opciones que se sabe
    que van a fallar es hacerle perder el tiempo a quien lo usa.
  */
  const posiblesPadres = useMemo(() => {
    if (!unidad) return unidades
    const prohibidos = new Set([unidad.id])
    let creció = true
    while (creció) {
      creció = false
      for (const u of unidades) {
        if (u.padreId && prohibidos.has(u.padreId) && !prohibidos.has(u.id)) {
          prohibidos.add(u.id)
          creció = true
        }
      }
    }
    return unidades.filter((u) => !prohibidos.has(u.id))
  }, [unidad, unidades])

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={unidad ? 'Editar unidad académica' : 'Crear unidad académica'}
      descripcion="Puede colgar de otra unidad o ser de primer nivel, como una facultad."
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
                tipo,
                padreId: padreId || null,
                sedeId: sedeId || null,
              })
            }
          >
            {guardando ? 'Guardando…' : unidad ? 'Guardar cambios' : 'Crear unidad'}
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
            placeholder="EINF"
            autoFocus
          />
          <Campo
            etiqueta="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Escuela de Informática"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Selector
            etiqueta="Tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            opciones={[
              { valor: 'facultad', texto: 'Facultad' },
              { valor: 'escuela', texto: 'Escuela' },
              { valor: 'departamento', texto: 'Departamento' },
              { valor: 'area', texto: 'Área' },
            ]}
          />
          <Selector
            etiqueta="Depende de"
            value={padreId}
            onChange={(e) => setPadreId(e.target.value)}
            vacio="Primer nivel"
            opciones={posiblesPadres.map((u) => ({
              valor: u.id,
              texto: `${u.codigo} · ${u.nombre}`,
            }))}
          />
        </div>

        <Selector
          etiqueta="Sede"
          value={sedeId}
          onChange={(e) => setSedeId(e.target.value)}
          vacio={sedes.length === 0 ? 'No hay sedes registradas' : 'Sin sede asignada'}
          opciones={sedes.map((s) => ({ valor: s.id, texto: s.nombre }))}
        />
      </div>
    </Dialogo>
  )
}
