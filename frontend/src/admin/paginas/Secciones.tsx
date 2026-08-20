import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Plus, TriangleAlert, Users } from 'lucide-react'
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
import { BarraFiltros, FiltroSelect, MenuFila, Nota } from '../piezas'
import {
  nombreEstadoCurso,
  nombreNivel,
  type AnoEscolar,
  type Curso,
  type Grado,
  type Sede,
  type Seccion,
} from '../academico'
import type { ListaPersonas, Persona } from '../personas'

type Respuesta = { secciones: Seccion[]; cursosGenerados?: number }

/*
  Las secciones son los grupos reales del colegio: 3ro A, 3ro B, 4to Única.

  Cada una nace con sus cursos ya creados, uno por materia del plan de estudio
  de su grado. Eso es lo que hace que más adelante inscribir a un niño en 3ro A
  lo deje en sus ocho clases sin tocarlas una por una: la sección ya sabe qué se
  imparte en ella.

  Por eso la fila de una sección se despliega para ver sus cursos: asignar
  docentes es lo que más se hace aquí, y sacarlo a otra pantalla obligaría a ir
  y volver por cada grupo.
*/
export function Secciones() {
  const anos = useConsulta<{ anos: AnoEscolar[] }>('/academico/anos')
  const [anoId, setAnoId] = useState('')

  // Al entrar se mira el año en curso, que es donde está el trabajo del día.
  useEffect(() => {
    if (!anoId && anos.datos) {
      const actual = anos.datos.anos.find((a) => a.esActual) ?? anos.datos.anos[0]
      if (actual) setAnoId(actual.id)
    }
  }, [anos.datos, anoId])

  const ruta = anoId ? `/academico/secciones?anoEscolarId=${anoId}` : '/academico/secciones'
  const { datos, cargando, error, recargar, fijar } = useConsulta<Respuesta>(ruta)

  const grados = useConsulta<{ grados: Grado[] }>('/academico/grados')
  const sedes = useConsulta<{ sedes: Sede[] }>('/academico/sedes')
  const cursos = useConsulta<{ cursos: Curso[] }>(
    anoId ? `/academico/cursos?anoEscolarId=${anoId}` : '/academico/cursos',
  )

  /*
    Los docentes se piden una vez aquí y se pasan hacia abajo. Estaban pedidos
    dentro de cada fila de curso, y eso son treinta peticiones idénticas al
    desplegar una sección con treinta materias, todas por la misma lista.
  */
  const docentes = useConsulta<ListaPersonas>(
    '/personas?rol=docente&estado=activa&porPagina=200',
  )
  const opcionesDocente = useMemo(
    () =>
      (docentes.datos?.personas ?? []).map((p: Persona) => ({
        valor: p.id,
        texto: p.nombre,
      })),
    [docentes.datos],
  )

  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Seccion | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const { guardar, guardando, error: errorGuardar } = useGuardar()

  async function operar(operacion: () => Promise<Respuesta>) {
    const r = await guardar(operacion)
    if (r) {
      fijar(r)
      void cursos.recargar()
    }
    return r
  }

  const anoElegido = anos.datos?.anos.find((a) => a.id === anoId)

  return (
    <Pantalla
      titulo="Secciones"
      descripcion="Los grupos del colegio en cada año escolar. Al crear una sección se generan sus cursos a partir del plan de estudio del grado."
      datos={datos}
      cargando={cargando}
      error={error}
      recargar={recargar}
      accion={
        <Boton
          variante="primario"
          iconoIzq={<Plus size={15} strokeWidth={1.75} />}
          disabled={!anoId || anoElegido?.estado === 'cerrado'}
          onClick={() => {
            setEditando(null)
            setCreando(true)
          }}
        >
          Crear sección
        </Boton>
      }
    >
      {({ secciones }) => {
        const cursosPorSeccion = new Map<string, Curso[]>()
        for (const curso of cursos.datos?.cursos ?? []) {
          cursosPorSeccion.set(curso.seccionId, [
            ...(cursosPorSeccion.get(curso.seccionId) ?? []),
            curso,
          ])
        }

        const sinDocente = secciones.reduce((s, x) => s + x.cursosSinDocente, 0)

        return (
          <>
            {errorGuardar && <Nota tono="error">{errorGuardar}</Nota>}
            {aviso && <Nota tono="exito">{aviso}</Nota>}

            {anoElegido?.estado === 'cerrado' && (
              <Nota tono="aviso">
                {anoElegido.codigo} está cerrado. Sus secciones se pueden consultar pero no
                modificar.
              </Nota>
            )}

            {sinDocente > 0 && (
              <Nota tono="aviso">
                Hay {sinDocente} {sinDocente === 1 ? 'curso' : 'cursos'} sin docente
                asignado. Un curso sin docente no se puede publicar, así que nadie podrá
                dar clase ni calificar en él.
              </Nota>
            )}

            <Ficha>
              <BarraFiltros>
                <FiltroSelect
                  etiqueta="Año escolar"
                  valor={anoId}
                  alCambiar={setAnoId}
                  opciones={(anos.datos?.anos ?? []).map((a) => ({
                    valor: a.id,
                    texto: a.esActual ? `${a.codigo} · en curso` : a.codigo,
                  }))}
                />
              </BarraFiltros>

              {secciones.length === 0 ? (
                <EstadoVacio
                  icono={Users}
                  titulo="No hay secciones en este año"
                  texto={
                    (grados.datos?.grados ?? []).length === 0
                      ? 'Antes de armar grupos hay que crear los grados y su plan de estudio.'
                      : 'Crea los grupos de este año: 1ro A, 1ro B, 2do A… Cada uno nacerá con los cursos del plan de su grado.'
                  }
                  accion={
                    (grados.datos?.grados ?? []).length === 0 ? (
                      <Link to="/admin/grados">
                        <Boton variante="primario">Ir a grados</Boton>
                      </Link>
                    ) : (
                      <Boton
                        variante="primario"
                        disabled={!anoId}
                        onClick={() => setCreando(true)}
                      >
                        Crear la primera sección
                      </Boton>
                    )
                  }
                />
              ) : (
                <ul>
                  {secciones.map((seccion) => (
                    <FilaSeccion
                      key={seccion.id}
                      seccion={seccion}
                      cursos={cursosPorSeccion.get(seccion.id) ?? []}
                      docentes={opcionesDocente}
                      abierta={abierta === seccion.id}
                      bloqueada={anoElegido?.estado === 'cerrado'}
                      alAlternar={() =>
                        setAbierta((previa) => (previa === seccion.id ? null : seccion.id))
                      }
                      alEditar={() => {
                        setCreando(false)
                        setEditando(seccion)
                      }}
                      alSincronizar={async () => {
                        const r = await operar(() =>
                          pedir<Respuesta>(
                            `/academico/secciones/${seccion.id}/sincronizar-cursos`,
                            { metodo: 'POST' },
                          ),
                        )
                        if (r) {
                          setAviso(
                            r.cursosGenerados
                              ? `Se añadieron ${r.cursosGenerados} cursos a ${seccion.grado} ${seccion.nombre}.`
                              : `${seccion.grado} ${seccion.nombre} ya tenía todas las materias de su plan.`,
                          )
                        }
                      }}
                      alOperar={operar}
                      alCambiarCurso={async (cursoId, cuerpo) => {
                        const r = await guardar(() =>
                          pedir<{ curso: Curso }>(`/academico/cursos/${cursoId}`, {
                            metodo: 'PATCH',
                            cuerpo,
                          }),
                        )
                        if (r) {
                          void cursos.recargar()
                          void recargar()
                        }
                      }}
                    />
                  ))}
                </ul>
              )}
            </Ficha>

            <DialogoSeccion
              abierto={creando || editando !== null}
              seccion={editando}
              anoId={anoId}
              grados={grados.datos?.grados ?? []}
              sedes={sedes.datos?.sedes ?? []}
              docentes={opcionesDocente}
              guardando={guardando}
              alCerrar={() => {
                setCreando(false)
                setEditando(null)
              }}
              alEnviar={async (cuerpo) => {
                const r = await operar(() =>
                  editando
                    ? pedir<Respuesta>(`/academico/secciones/${editando.id}`, {
                        metodo: 'PATCH',
                        cuerpo,
                      })
                    : pedir<Respuesta>('/academico/secciones', { metodo: 'POST', cuerpo }),
                )
                if (r) {
                  if (!editando) {
                    setAviso(
                      r.cursosGenerados
                        ? `Sección creada con ${r.cursosGenerados} cursos generados desde el plan del grado.`
                        : 'Sección creada. El grado no tiene plan de estudio todavía, así que nació sin cursos.',
                    )
                  }
                  setCreando(false)
                  setEditando(null)
                }
              }}
            />
          </>
        )
      }}
    </Pantalla>
  )
}

type OpcionDocente = { valor: string; texto: string }

function FilaSeccion({
  seccion,
  cursos,
  docentes,
  abierta,
  bloqueada,
  alAlternar,
  alEditar,
  alSincronizar,
  alOperar,
  alCambiarCurso,
}: {
  seccion: Seccion
  cursos: Curso[]
  docentes: OpcionDocente[]
  abierta: boolean
  bloqueada: boolean
  alAlternar: () => void
  alEditar: () => void
  alSincronizar: () => Promise<void>
  alOperar: (op: () => Promise<Respuesta>) => Promise<Respuesta | null>
  alCambiarCurso: (cursoId: string, cuerpo: Record<string, unknown>) => Promise<void>
}) {
  return (
    <li className="border-b border-regla last:border-b-0">
      <div className="flex items-center gap-4 px-5 py-3.5">
        <button
          onClick={alAlternar}
          aria-expanded={abierta}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ChevronDown
            size={16}
            strokeWidth={1.75}
            className={cn(
              'shrink-0 text-tinta-suave transition-transform',
              abierta && 'rotate-180',
            )}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold text-tinta">
                {seccion.grado} {seccion.nombre}
              </span>
              {!seccion.activa && <Etiqueta tono="neutro">Inactiva</Etiqueta>}
              {seccion.cursosSinDocente > 0 && (
                <Etiqueta tono="aviso" icono={<TriangleAlert size={11} strokeWidth={2} />}>
                  {seccion.cursosSinDocente} sin docente
                </Etiqueta>
              )}
            </div>
            <p className="mt-0.5 font-dato text-[11.5px] text-tinta-suave">
              {nombreNivel[seccion.nivel]} · {seccion.cursos}{' '}
              {seccion.cursos === 1 ? 'curso' : 'cursos'}
              {seccion.cupo ? ` · cupo ${seccion.cupo}` : ''}
              {seccion.aula ? ` · ${seccion.aula}` : ''}
              {seccion.tutor ? ` · tutor: ${seccion.tutor}` : ''}
            </p>
          </div>
        </button>

        {!bloqueada && (
          <MenuFila
            acciones={[
              { etiqueta: 'Editar sección', alElegir: alEditar },
              { etiqueta: 'Sincronizar cursos con el plan', alElegir: () => void alSincronizar() },
              {
                etiqueta: seccion.activa ? 'Desactivar' : 'Reactivar',
                alElegir: () => {
                  void alOperar(() =>
                    pedir<Respuesta>(`/academico/secciones/${seccion.id}`, {
                      metodo: 'PATCH',
                      cuerpo: { activa: !seccion.activa },
                    }),
                  )
                },
              },
              {
                etiqueta: 'Eliminar sección',
                peligrosa: true,
                alElegir: () => {
                  void alOperar(() =>
                    pedir<Respuesta>(`/academico/secciones/${seccion.id}`, {
                      metodo: 'DELETE',
                    }),
                  )
                },
              },
            ]}
          />
        )}
      </div>

      {abierta && (
        <div className="border-t border-regla bg-lienzo px-5 py-3">
          {cursos.length === 0 ? (
            <p className="py-2 text-[13px] leading-relaxed text-tinta-media">
              Esta sección no tiene cursos. Su grado no tenía plan de estudio cuando se
              creó:{' '}
              <Link
                to="/admin/grados"
                className="text-pizarra underline-offset-4 hover:underline"
              >
                arma el plan
              </Link>{' '}
              y luego usa «Sincronizar cursos con el plan».
            </p>
          ) : (
            <ul className="divide-y divide-regla">
              {cursos.map((curso) => (
                <FilaCurso
                  key={curso.id}
                  curso={curso}
                  docentes={docentes}
                  bloqueada={bloqueada}
                  alCambiar={(cuerpo) => alCambiarCurso(curso.id, cuerpo)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

/* Cada curso de la sección con su docente, que se asigna aquí mismo. */
function FilaCurso({
  curso,
  docentes,
  bloqueada,
  alCambiar,
}: {
  curso: Curso
  docentes: OpcionDocente[]
  bloqueada: boolean
  alCambiar: (cuerpo: Record<string, unknown>) => Promise<void>
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <span className="w-12 shrink-0 font-dato text-[11.5px] text-pizarra">
        {curso.codigoAsignatura}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] text-tinta">
        {curso.asignatura}
      </span>

      <select
        value={curso.docenteMembresiaId ?? ''}
        disabled={bloqueada}
        onChange={(e) => void alCambiar({ docenteMembresiaId: e.target.value || null })}
        aria-label={`Docente de ${curso.asignatura}`}
        className={cn(
          'h-8 w-56 rounded-sm border bg-superficie px-2 text-[13px] focus:border-pizarra focus:outline-none disabled:opacity-50',
          curso.docenteMembresiaId
            ? 'border-regla-fuerte text-tinta'
            : 'border-aviso/40 text-aviso',
        )}
      >
        <option value="">Sin docente</option>
        {docentes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>

      {curso.estado === 'publicado' ? (
        <Etiqueta tono="aprobado">{nombreEstadoCurso.publicado}</Etiqueta>
      ) : curso.estado === 'cerrado' ? (
        <Etiqueta tono="neutro">{nombreEstadoCurso.cerrado}</Etiqueta>
      ) : (
        <Boton
          variante="secundario"
          tamano="sm"
          disabled={bloqueada || !curso.docenteMembresiaId}
          onClick={() => void alCambiar({ estado: 'publicado' })}
          title={
            curso.docenteMembresiaId
              ? undefined
              : 'Asigna un docente antes de publicar el curso'
          }
        >
          Publicar
        </Boton>
      )}
    </li>
  )
}

function DialogoSeccion({
  abierto,
  seccion,
  anoId,
  grados,
  sedes,
  docentes,
  guardando,
  alCerrar,
  alEnviar,
}: {
  abierto: boolean
  seccion: Seccion | null
  anoId: string
  grados: Grado[]
  sedes: Sede[]
  docentes: OpcionDocente[]
  guardando: boolean
  alCerrar: () => void
  alEnviar: (cuerpo: Record<string, unknown>) => Promise<void>
}) {
  const [gradoId, setGradoId] = useState('')
  const [nombre, setNombre] = useState('')
  const [cupo, setCupo] = useState('')
  const [aula, setAula] = useState('')
  const [sedeId, setSedeId] = useState('')
  const [tutorId, setTutorId] = useState('')

  useEffect(() => {
    if (!abierto) return
    setGradoId(seccion?.gradoId ?? '')
    setNombre(seccion?.nombre ?? '')
    setCupo(seccion?.cupo?.toString() ?? '')
    setAula(seccion?.aula ?? '')
    setSedeId(seccion?.sedeId ?? '')
    setTutorId(seccion?.tutorMembresiaId ?? '')
  }, [abierto, seccion])

  const grado = grados.find((g) => g.id === gradoId)

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={seccion ? `Editar ${seccion.grado} ${seccion.nombre}` : 'Crear sección'}
      descripcion={
        seccion
          ? undefined
          : 'Nacerá con un curso por cada materia del plan de estudio de su grado.'
      }
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            disabled={guardando || nombre.trim() === '' || (!seccion && gradoId === '')}
            onClick={() =>
              void alEnviar({
                ...(seccion ? {} : { anoEscolarId: anoId, gradoId }),
                nombre: nombre.trim(),
                cupo: cupo === '' ? null : Number(cupo),
                aula: aula.trim(),
                sedeId: sedeId || null,
                tutorMembresiaId: tutorId || null,
              })
            }
          >
            {guardando ? 'Guardando…' : seccion ? 'Guardar cambios' : 'Crear sección'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!seccion && (
          <Selector
            etiqueta="Grado"
            value={gradoId}
            onChange={(e) => setGradoId(e.target.value)}
            vacio="Elige el grado"
            opciones={grados
              .filter((g) => g.activo)
              .map((g) => ({
                valor: g.id,
                texto: `${g.nombre} · ${g.plan.length} ${g.plan.length === 1 ? 'materia' : 'materias'}`,
              }))}
          />
        )}

        {grado && grado.plan.length === 0 && (
          <Nota tono="aviso">
            {grado.nombre} no tiene plan de estudio, así que la sección nacerá sin cursos.
            Puedes crearla igual y sincronizarla después.
          </Nota>
        )}

        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Campo
            etiqueta="Sección"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="A"
            ayuda="A, B, Única…"
            autoFocus
          />
          <Campo
            etiqueta="Aula"
            value={aula}
            onChange={(e) => setAula(e.target.value)}
            placeholder="Aula 12"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Cupo"
            type="number"
            min={1}
            max={200}
            value={cupo}
            onChange={(e) => setCupo(e.target.value)}
            placeholder="30"
            ayuda="Cuántos estudiantes admite. Opcional."
          />
          <Selector
            etiqueta="Sede"
            value={sedeId}
            onChange={(e) => setSedeId(e.target.value)}
            vacio={sedes.length === 0 ? 'No hay sedes registradas' : 'Sin sede asignada'}
            opciones={sedes.map((s) => ({ valor: s.id, texto: s.nombre }))}
          />
        </div>

        <Selector
          etiqueta="Maestro guía"
          value={tutorId}
          onChange={(e) => setTutorId(e.target.value)}
          vacio="Sin asignar"
          ayuda="El tutor del grupo. En primaria suele impartir además casi todas sus materias."
          opciones={docentes}
        />
      </div>
    </Dialogo>
  )
}
