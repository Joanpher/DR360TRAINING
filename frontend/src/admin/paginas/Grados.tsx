import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Layers, Plus } from 'lucide-react'
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
import {
  ORDEN_NIVELES,
  nombreNivel,
  type Asignatura,
  type Grado,
  type Nivel,
  type Unidad,
} from '../academico'

type Respuesta = { grados: Grado[] }

/*
  Los grados con su plan de estudio.

  Se agrupan por nivel y no se listan en una tabla plana porque el orden importa
  y es el del recorrido de un estudiante: Inicial, Primaria, Secundaria, y
  dentro de cada uno del 1ro al último. Una tabla ordenada alfabéticamente
  pondría 10mo antes que 2do.

  El plan de estudio vive aquí y no en su propia pantalla porque es lo que
  define al grado: 3ro de Primaria *es* las materias que lleva. Y es la pieza
  que hace que crear una sección genere sus cursos sin tocarlos uno a uno.
*/
export function Grados() {
  const { datos, cargando, error, recargar, fijar } = useConsulta<Respuesta>(
    '/academico/grados',
  )
  const materias = useConsulta<{ asignaturas: Asignatura[] }>('/academico/asignaturas')
  const unidades = useConsulta<{ unidades: Unidad[] }>('/academico/unidades')

  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Grado | null>(null)
  const [planDe, setPlanDe] = useState<Grado | null>(null)
  const { guardar, guardando, error: errorGuardar } = useGuardar()

  async function operar(operacion: () => Promise<Respuesta>) {
    const r = await guardar(operacion)
    if (r) fijar(r)
    return r
  }

  return (
    <Pantalla
      titulo="Grados"
      descripcion="Los escalones del colegio y las materias que lleva cada uno. El plan de estudio de un grado es lo que reciben todas sus secciones: al crear una sección, sus cursos salen de aquí."
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
          Crear grado
        </Boton>
      }
    >
      {({ grados }) => {
        const sinMaterias = (materias.datos?.asignaturas ?? []).length === 0

        return (
          <>
            {errorGuardar && <Nota tono="error">{errorGuardar}</Nota>}

            {sinMaterias && grados.length > 0 && (
              <Nota tono="aviso">
                Todavía no hay materias en el catálogo, así que los planes de estudio están
                vacíos y las secciones nacerán sin cursos.{' '}
                <Link to="/admin/materias" className="underline underline-offset-4">
                  Crea las materias primero
                </Link>
                .
              </Nota>
            )}

            {grados.length === 0 ? (
              <Ficha>
                <EstadoVacio
                  icono={GraduationCap}
                  titulo="Todavía no hay grados"
                  texto="Empieza por los que ofrece el colegio: 1ro de Primaria, 2do de Primaria… Cada uno lleva después su propio plan de materias."
                  accion={
                    <Boton variante="primario" onClick={() => setCreando(true)}>
                      Crear el primer grado
                    </Boton>
                  }
                />
              </Ficha>
            ) : (
              ORDEN_NIVELES.map((nivel) => {
                const delNivel = grados.filter((g) => g.nivel === nivel)
                if (delNivel.length === 0) return null

                return (
                  <section key={nivel} className="space-y-3">
                    <h2 className="etiqueta-dato text-tinta-suave">
                      {nombreNivel[nivel]}
                    </h2>
                    <Ficha>
                      <ul>
                        {delNivel.map((grado) => (
                          <FilaGrado
                            key={grado.id}
                            grado={grado}
                            alEditar={() => {
                              setCreando(false)
                              setEditando(grado)
                            }}
                            alEditarPlan={() => setPlanDe(grado)}
                            alOperar={operar}
                          />
                        ))}
                      </ul>
                    </Ficha>
                  </section>
                )
              })
            )}

            <DialogoGrado
              abierto={creando || editando !== null}
              grado={editando}
              grados={grados}
              unidades={unidades.datos?.unidades ?? []}
              guardando={guardando}
              alCerrar={() => {
                setCreando(false)
                setEditando(null)
              }}
              alEnviar={async (cuerpo) => {
                const r = await operar(() =>
                  editando
                    ? pedir<Respuesta>(`/academico/grados/${editando.id}`, {
                        metodo: 'PATCH',
                        cuerpo,
                      })
                    : pedir<Respuesta>('/academico/grados', { metodo: 'POST', cuerpo }),
                )
                if (r) {
                  setCreando(false)
                  setEditando(null)
                }
              }}
            />

            <DialogoPlan
              grado={planDe}
              materias={materias.datos?.asignaturas ?? []}
              guardando={guardando}
              alCerrar={() => setPlanDe(null)}
              alGuardar={async (lista) => {
                const r = await operar(() =>
                  pedir<Respuesta>(`/academico/grados/${planDe!.id}/plan`, {
                    metodo: 'PUT',
                    cuerpo: { materias: lista },
                  }),
                )
                if (r) setPlanDe(null)
              }}
            />
          </>
        )
      }}
    </Pantalla>
  )
}

function FilaGrado({
  grado,
  alEditar,
  alEditarPlan,
  alOperar,
}: {
  grado: Grado
  alEditar: () => void
  alEditarPlan: () => void
  alOperar: (op: () => Promise<Respuesta>) => Promise<Respuesta | null>
}) {
  const horas = grado.plan.reduce((suma, m) => suma + (m.horasSemanales ?? 0), 0)

  return (
    <li className="border-b border-regla px-5 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs bg-lienzo font-dato text-[11px] font-semibold text-tinta-media">
              {grado.orden}
            </span>
            <span className="text-[14px] font-semibold text-tinta">{grado.nombre}</span>
            {!grado.activo && <Etiqueta tono="neutro">Inactivo</Etiqueta>}
          </div>
          <p className="mt-1 font-dato text-[11.5px] text-tinta-suave">
            {grado.secciones} {grado.secciones === 1 ? 'sección' : 'secciones'}
            {grado.unidad ? ` · ${grado.unidad}` : ''}
            {horas > 0 ? ` · ${horas} h/semana` : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Boton
            variante="secundario"
            tamano="sm"
            iconoIzq={<Layers size={14} strokeWidth={1.5} />}
            onClick={alEditarPlan}
          >
            Plan de estudio
          </Boton>
          <MenuFila
            acciones={[
              { etiqueta: 'Editar grado', alElegir: alEditar },
              {
                etiqueta: grado.activo ? 'Desactivar' : 'Reactivar',
                alElegir: () => {
                  void alOperar(() =>
                    pedir<Respuesta>(`/academico/grados/${grado.id}`, {
                      metodo: 'PATCH',
                      cuerpo: { activo: !grado.activo },
                    }),
                  )
                },
              },
              {
                etiqueta: 'Eliminar',
                peligrosa: true,
                alElegir: () => {
                  void alOperar(() =>
                    pedir<Respuesta>(`/academico/grados/${grado.id}`, { metodo: 'DELETE' }),
                  )
                },
              },
            ]}
          />
        </div>
      </div>

      {/*
        El plan se enseña aquí mismo y no escondido tras un clic: es el dato que
        de verdad distingue un grado de otro, y verlo de un vistazo es lo que
        permite detectar que a 4to le falta una materia que 3ro sí tiene.
      */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {grado.plan.length === 0 ? (
          <button
            onClick={alEditarPlan}
            className="etiqueta-dato rounded-xs border border-dashed border-aviso/40 bg-aviso-tenue px-2 py-1 text-aviso hover:border-aviso"
          >
            Sin plan de estudio — las secciones nacerán sin cursos
          </button>
        ) : (
          grado.plan.map((materia) => (
            <span
              key={materia.asignaturaId}
              className="inline-flex items-center gap-1.5 rounded-xs border border-regla bg-lienzo px-2 py-1"
              title={materia.nombre}
            >
              <span className="font-dato text-[11px] text-pizarra">{materia.codigo}</span>
              <span className="text-[12px] text-tinta-media">{materia.nombre}</span>
              {materia.horasSemanales !== null && (
                <span className="font-dato text-[11px] tabular-nums text-tinta-suave">
                  {materia.horasSemanales}h
                </span>
              )}
            </span>
          ))
        )}
      </div>
    </li>
  )
}

function DialogoGrado({
  abierto,
  grado,
  grados,
  unidades,
  guardando,
  alCerrar,
  alEnviar,
}: {
  abierto: boolean
  grado: Grado | null
  grados: Grado[]
  unidades: Unidad[]
  guardando: boolean
  alCerrar: () => void
  alEnviar: (cuerpo: Record<string, unknown>) => Promise<void>
}) {
  const [nivel, setNivel] = useState<Nivel>('primario')
  const [orden, setOrden] = useState('1')
  const [nombre, setNombre] = useState('')
  const [unidadId, setUnidadId] = useState('')
  const [nombreTocado, setNombreTocado] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setNivel(grado?.nivel ?? 'primario')
    setOrden(String(grado?.orden ?? 1))
    setNombre(grado?.nombre ?? '')
    setUnidadId(grado?.unidadAcademicaId ?? '')
    setNombreTocado(grado !== null)
  }, [abierto, grado])

  /*
    El nombre se propone solo a partir del nivel y el número —"3ro de Primaria"—
    porque es como se llaman en todos los colegios, pero deja de proponerse en
    cuanto alguien lo escribe a mano: hay colegios que usan "Tercero A de
    Básica" y no hay que pelearse con ellos.
  */
  const propuesto = useMemo(() => {
    const n = Number(orden)
    if (!n) return ''
    const ordinales = ['1ro', '2do', '3ro', '4to', '5to', '6to', '7mo', '8vo', '9no', '10mo', '11mo', '12mo']
    return `${ordinales[n - 1] ?? `${n}.º`} de ${nombreNivel[nivel]}`
  }, [nivel, orden])

  useEffect(() => {
    if (!nombreTocado) setNombre(propuesto)
  }, [propuesto, nombreTocado])

  /* Un grado ocupa un número dentro de su nivel y no se repite. */
  const ocupados = grados
    .filter((g) => g.nivel === nivel && g.id !== grado?.id)
    .map((g) => g.orden)

  const chocado = ocupados.includes(Number(orden))

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={grado ? 'Editar grado' : 'Crear grado'}
      descripcion="El grado existe una vez en el colegio, no una por año. Lo que cambia cada año son sus secciones."
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            disabled={guardando || nombre.trim() === '' || chocado}
            onClick={() =>
              void alEnviar({
                nivel,
                orden: Number(orden),
                nombre: nombre.trim(),
                unidadAcademicaId: unidadId || null,
              })
            }
          >
            {guardando ? 'Guardando…' : grado ? 'Guardar cambios' : 'Crear grado'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector
            etiqueta="Nivel"
            value={nivel}
            onChange={(e) => setNivel(e.target.value as Nivel)}
            opciones={ORDEN_NIVELES.map((n) => ({ valor: n, texto: nombreNivel[n] }))}
          />
          <Campo
            etiqueta="Número dentro del nivel"
            type="number"
            min={1}
            max={12}
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            error={chocado ? `Ya hay un grado ${orden} en ${nombreNivel[nivel]}.` : undefined}
            ayuda={chocado ? undefined : 'Ordena la lista y define el paso al siguiente grado.'}
          />
        </div>

        <Campo
          etiqueta="Nombre"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            setNombreTocado(true)
          }}
          placeholder="3ro de Primaria"
          ayuda="Se propone solo; cámbialo si tu colegio los nombra de otra forma."
        />

        <Selector
          etiqueta="Unidad académica"
          value={unidadId}
          onChange={(e) => setUnidadId(e.target.value)}
          vacio={unidades.length === 0 ? 'No hay unidades registradas' : 'Sin unidad asignada'}
          ayuda="Opcional. Sirve para que un coordinador tenga a su cargo los grados de su unidad."
          opciones={unidades.map((u) => ({ valor: u.id, texto: `${u.codigo} · ${u.nombre}` }))}
        />
      </div>
    </Dialogo>
  )
}

/*
  El plan se edita marcando materias, no añadiéndolas de una en una: la pregunta
  es "qué lleva este grado", y verla como una lista completa con lo marcado y lo
  no marcado deja detectar de un vistazo lo que falta.
*/
function DialogoPlan({
  grado,
  materias,
  guardando,
  alCerrar,
  alGuardar,
}: {
  grado: Grado | null
  materias: Asignatura[]
  guardando: boolean
  alCerrar: () => void
  alGuardar: (materias: Array<{ asignaturaId: string; horasSemanales: number | null }>) => Promise<void>
}) {
  const [elegidas, setElegidas] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!grado) return
    setElegidas(
      new Map(grado.plan.map((m) => [m.asignaturaId, m.horasSemanales?.toString() ?? ''])),
    )
  }, [grado])

  if (!grado) return null

  const disponibles = materias.filter((m) => m.activa || elegidas.has(m.id))
  const horas = [...elegidas.values()].reduce((suma, h) => suma + (Number(h) || 0), 0)

  function alternar(id: string, marcada: boolean) {
    setElegidas((previas) => {
      const copia = new Map(previas)
      if (marcada) copia.set(id, '')
      else copia.delete(id)
      return copia
    })
  }

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      ancho="lg"
      titulo={`Plan de estudio · ${grado.nombre}`}
      descripcion="Las materias marcadas son las que cursan todas las secciones de este grado. Al crear una sección, cada una se convierte en un curso."
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            disabled={guardando}
            onClick={() =>
              void alGuardar(
                [...elegidas.entries()].map(([asignaturaId, h]) => ({
                  asignaturaId,
                  horasSemanales: h === '' ? null : Number(h),
                })),
              )
            }
          >
            {guardando ? 'Guardando…' : 'Guardar plan'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {materias.length === 0 ? (
          <Nota tono="aviso">
            No hay materias en el catálogo todavía.{' '}
            <Link to="/admin/materias" className="underline underline-offset-4">
              Créalas primero
            </Link>{' '}
            y vuelve aquí a repartirlas.
          </Nota>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] text-tinta-media">
                {elegidas.size} de {disponibles.length} materias
              </p>
              <p className="font-dato text-[12px] tabular-nums text-tinta-suave">
                {horas} h/semana
              </p>
            </div>

            <ul className="max-h-[380px] overflow-y-auto rounded-sm border border-regla">
              {disponibles.map((materia) => {
                const marcada = elegidas.has(materia.id)
                return (
                  <li
                    key={materia.id}
                    className={cn(
                      'flex items-center gap-3 border-b border-regla px-3 py-2.5 last:border-b-0',
                      marcada && 'bg-pizarra-tenue',
                    )}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={(e) => alternar(materia.id, e.target.checked)}
                        className="h-4 w-4 shrink-0 accent-pizarra"
                      />
                      <span className="font-dato text-[11.5px] text-pizarra">
                        {materia.codigo}
                      </span>
                      <span className="truncate text-[13.5px] text-tinta">
                        {materia.nombre}
                      </span>
                      {!materia.activa && <Etiqueta tono="neutro">Inactiva</Etiqueta>}
                    </label>

                    <span className="flex shrink-0 items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={elegidas.get(materia.id) ?? ''}
                        onChange={(e) =>
                          setElegidas((previas) =>
                            new Map(previas).set(materia.id, e.target.value),
                          )
                        }
                        disabled={!marcada}
                        placeholder="—"
                        aria-label={`Horas semanales de ${materia.nombre}`}
                        className="h-8 w-16 rounded-sm border border-regla-fuerte bg-superficie px-2 text-center font-dato text-[12.5px] tabular-nums text-tinta focus:border-pizarra focus:outline-none disabled:bg-lienzo disabled:opacity-50"
                      />
                      <span className="font-dato text-[11px] text-tinta-suave">h</span>
                    </span>
                  </li>
                )
              })}
            </ul>

            <p className="text-[12.5px] leading-relaxed text-tinta-suave">
              Cambiar el plan no toca las secciones que ya existen: un grupo que lleva medio
              año cursando una materia no la pierde porque alguien edite esto. Para añadir
              las materias nuevas a un grupo ya creado, usa «Sincronizar cursos» en la
              sección.
            </p>
          </>
        )}
      </div>
    </Dialogo>
  )
}
