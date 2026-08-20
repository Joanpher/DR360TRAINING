import { useEffect, useState } from 'react'
import { CalendarRange, Plus } from 'lucide-react'
import { Boton } from '../../ui/Boton'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import { Etiqueta } from '../../ui/Etiqueta'
import { EstadoVacio } from '../../ui/EstadoVacio'
import { Ficha, FichaCabecera } from '../../ui/Ficha'
import { Selector } from '../../ui/Selector'
import { cn } from '../../ui/cn'
import { pedir } from '../../datos/api'
import { useConsulta, useGuardar } from '../../datos/consulta'
import { Pantalla } from '../Pantalla'
import { MenuFila, Nota } from '../piezas'
import {
  fechaLegible,
  nombreEstadoAno,
  rangoLegible,
  type AnoEscolar as Ano,
} from '../academico'

type Respuesta = { anos: Ano[] }

const tono = {
  activo: 'aprobado',
  planificado: 'aviso',
  cerrado: 'neutro',
} as const

/*
  El año escolar es el reloj del colegio: mientras uno está en curso las
  secciones existen y las notas se pueden cambiar; cuando se cierra, el
  expediente queda fijo.

  Abrir y cerrar son dos actos separados y ninguno arrastra al otro. Los
  calendarios se solapan -un año termina en junio y el siguiente se planifica
  desde marzo, pero quedan actas del anterior sin firmar-, así que cerrar es
  siempre una decisión explícita, nunca un efecto secundario de abrir el
  siguiente.

  Dentro de cada año van los períodos de calificación, que son cortes de nota y
  no ventanas de inscripción. Se generan solos al crear el año porque un año sin
  períodos no admite ni una calificación, y dejar ese paso a la memoria de
  alguien garantiza que se descubra el día que un maestro intente calificar.
*/
export function AnoEscolar() {
  const { datos, cargando, error, recargar, fijar } = useConsulta<Respuesta>(
    '/academico/anos',
  )
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Ano | null>(null)
  const [cerrando, setCerrando] = useState<Ano | null>(null)
  const [ajustando, setAjustando] = useState<Ano | null>(null)
  const { guardar, guardando, error: errorGuardar } = useGuardar()

  async function operar(operacion: () => Promise<Respuesta>) {
    const r = await guardar(operacion)
    if (r) fijar(r)
    return r
  }

  return (
    <Pantalla
      titulo="Año escolar"
      descripcion="De agosto a junio. Todo lo académico —secciones, cursos, inscripciones y notas— cuelga de un año, y las calificaciones de un año cerrado ya no se modifican."
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
          Crear año escolar
        </Boton>
      }
    >
      {({ anos }) => {
        const grupos = [
          { titulo: null, lista: anos.filter((a) => a.estado === 'activo') },
          { titulo: 'Planificados', lista: anos.filter((a) => a.estado === 'planificado') },
          { titulo: 'Cerrados', lista: anos.filter((a) => a.estado === 'cerrado') },
        ].filter((g) => g.lista.length > 0)

        return (
          <>
            {errorGuardar && <Nota tono="error">{errorGuardar}</Nota>}

            {anos.length === 0 ? (
              <Ficha>
                <EstadoVacio
                  icono={CalendarRange}
                  titulo="Todavía no hay ningún año escolar"
                  texto="Es lo primero que hay que crear: sin un año abierto no se pueden armar secciones ni inscribir a nadie."
                  accion={
                    <Boton variante="primario" onClick={() => setCreando(true)}>
                      Crear el primer año escolar
                    </Boton>
                  }
                />
              </Ficha>
            ) : (
              grupos.map((grupo) => (
                <section key={grupo.titulo ?? 'activo'} className="space-y-3">
                  {grupo.titulo && (
                    <h2 className="etiqueta-dato text-tinta-suave">{grupo.titulo}</h2>
                  )}
                  {grupo.lista.map((ano) => (
                    <TarjetaAno
                      key={ano.id}
                      ano={ano}
                      alEditar={() => {
                        setCreando(false)
                        setEditando(ano)
                      }}
                      alAjustarPeriodos={() => setAjustando(ano)}
                      alCerrar={() => setCerrando(ano)}
                      alOperar={operar}
                    />
                  ))}
                </section>
              ))
            )}

            <DialogoAno
              abierto={creando || editando !== null}
              ano={editando}
              guardando={guardando}
              alCerrar={() => {
                setCreando(false)
                setEditando(null)
              }}
              alEnviar={async (cuerpo) => {
                const r = await operar(() =>
                  editando
                    ? pedir<Respuesta>(`/academico/anos/${editando.id}`, {
                        metodo: 'PATCH',
                        cuerpo,
                      })
                    : pedir<Respuesta>('/academico/anos', { metodo: 'POST', cuerpo }),
                )
                if (r) {
                  setCreando(false)
                  setEditando(null)
                }
              }}
            />

            <DialogoPeriodos
              ano={ajustando}
              guardando={guardando}
              alCerrar={() => setAjustando(null)}
              alGuardar={async (periodos) => {
                const r = await operar(() =>
                  pedir<Respuesta>(`/academico/anos/${ajustando!.id}/periodos`, {
                    metodo: 'PUT',
                    cuerpo: { periodos },
                  }),
                )
                if (r) setAjustando(null)
              }}
            />

            <DialogoCerrar
              ano={cerrando}
              guardando={guardando}
              alCancelar={() => setCerrando(null)}
              alConfirmar={async (id) => {
                const r = await operar(() =>
                  pedir<Respuesta>(`/academico/anos/${id}/cerrar`, { metodo: 'POST' }),
                )
                if (r) setCerrando(null)
              }}
            />
          </>
        )
      }}
    </Pantalla>
  )
}

function TarjetaAno({
  ano,
  alEditar,
  alAjustarPeriodos,
  alCerrar,
  alOperar,
}: {
  ano: Ano
  alEditar: () => void
  alAjustarPeriodos: () => void
  alCerrar: () => void
  alOperar: (op: () => Promise<Respuesta>) => Promise<Respuesta | null>
}) {
  const abrir = () => {
    void alOperar(() =>
      pedir<Respuesta>(`/academico/anos/${ano.id}/abrir`, { metodo: 'POST' }),
    )
  }

  const acciones = [
    ...(ano.estado === 'cerrado'
      ? []
      : [
          { etiqueta: 'Editar fechas', alElegir: alEditar },
          { etiqueta: 'Ajustar períodos de nota', alElegir: alAjustarPeriodos },
        ]),
    ...(ano.estado === 'planificado'
      ? [
          { etiqueta: 'Abrir el año', alElegir: abrir },
          {
            etiqueta: 'Eliminar',
            peligrosa: true,
            alElegir: () => {
              void alOperar(() =>
                pedir<Respuesta>(`/academico/anos/${ano.id}`, { metodo: 'DELETE' }),
              )
            },
          },
        ]
      : []),
    ...(ano.estado === 'activo'
      ? [
          ...(ano.esActual ? [] : [{ etiqueta: 'Marcar como año actual', alElegir: abrir }]),
          { etiqueta: 'Cerrar el año', peligrosa: true, alElegir: alCerrar },
        ]
      : []),
  ]

  return (
    <Ficha className={cn(ano.esActual && 'border-pizarra/30')}>
      <FichaCabecera
        titulo={ano.nombre}
        descripcion={`${ano.codigo} · ${ano.secciones} ${ano.secciones === 1 ? 'sección' : 'secciones'}`}
        accion={
          <div className="flex items-center gap-2">
            {ano.esActual && <Etiqueta tono="aprobado">Actual</Etiqueta>}
            <Etiqueta tono={tono[ano.estado]}>{nombreEstadoAno[ano.estado]}</Etiqueta>
            {acciones.length > 0 && <MenuFila acciones={acciones} />}
          </div>
        }
      />

      <dl className="grid grid-cols-1 divide-regla sm:grid-cols-2 sm:divide-x">
        {[
          ['Docencia', `${fechaLegible(ano.inicio)} – ${fechaLegible(ano.fin)}`],
          ['Inscripción', rangoLegible(ano.inicioInscripcion, ano.finInscripcion)],
        ].map(([clave, valor], i) => (
          <div
            key={clave}
            className={cn('px-5 py-3.5', i === 0 && 'border-b border-regla sm:border-b-0')}
          >
            <dt className="etiqueta-dato text-tinta-suave">{clave}</dt>
            <dd className="mt-1.5 font-dato text-[13.5px] tabular-nums text-tinta">
              {valor}
            </dd>
          </div>
        ))}
      </dl>

      {ano.periodos.length > 0 && (
        <div className="border-t border-regla">
          <p className="etiqueta-dato px-5 pb-2 pt-3 text-tinta-suave">
            Períodos de calificación
          </p>
          <div
            className="grid divide-x divide-regla border-t border-regla"
            style={{
              gridTemplateColumns: `repeat(${ano.periodos.length}, minmax(0, 1fr))`,
            }}
          >
            {ano.periodos.map((periodo) => (
              <div key={periodo.id} className="px-4 py-3">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-tinta">
                  {periodo.nombre}
                  {periodo.cerrado && <Etiqueta tono="neutro">Cerrado</Etiqueta>}
                </p>
                <p className="mt-1 font-dato text-[11.5px] tabular-nums text-tinta-suave">
                  {fechaLegible(periodo.inicio)} – {fechaLegible(periodo.fin)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Ficha>
  )
}

function DialogoAno({
  abierto,
  ano,
  guardando,
  alCerrar,
  alEnviar,
}: {
  abierto: boolean
  ano: Ano | null
  guardando: boolean
  alCerrar: () => void
  alEnviar: (cuerpo: Record<string, unknown>) => Promise<void>
}) {
  const [campos, setCampos] = useState({
    codigo: '',
    nombre: '',
    inicio: '',
    fin: '',
    inicioInscripcion: '',
    finInscripcion: '',
    periodos: '4',
  })

  useEffect(() => {
    if (!abierto) return
    setCampos({
      codigo: ano?.codigo ?? '',
      nombre: ano?.nombre ?? '',
      inicio: ano?.inicio ?? '',
      fin: ano?.fin ?? '',
      inicioInscripcion: ano?.inicioInscripcion ?? '',
      finInscripcion: ano?.finInscripcion ?? '',
      periodos: String(ano?.periodos.length || 4),
    })
  }, [abierto, ano])

  const cambiar = (clave: keyof typeof campos) => (valor: string) =>
    setCampos((previos) => ({ ...previos, [clave]: valor }))

  const completo =
    campos.codigo.trim() !== '' &&
    campos.nombre.trim() !== '' &&
    campos.inicio !== '' &&
    campos.fin !== ''

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={ano ? 'Editar año escolar' : 'Crear año escolar'}
      descripcion={
        ano
          ? undefined
          : 'Nace planificado. Abrirlo es un acto aparte: es lo que deja inscribir estudiantes.'
      }
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            disabled={guardando || !completo}
            onClick={() =>
              void alEnviar({
                codigo: campos.codigo.trim(),
                nombre: campos.nombre.trim(),
                inicio: campos.inicio,
                fin: campos.fin,
                inicioInscripcion: campos.inicioInscripcion,
                finInscripcion: campos.finInscripcion,
                ...(ano ? {} : { periodos: Number(campos.periodos) }),
              })
            }
          >
            {guardando ? 'Guardando…' : ano ? 'Guardar cambios' : 'Crear año'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
          <Campo
            etiqueta="Código"
            value={campos.codigo}
            onChange={(e) => cambiar('codigo')(e.target.value)}
            placeholder="2026-2027"
            autoFocus
          />
          <Campo
            etiqueta="Nombre"
            value={campos.nombre}
            onChange={(e) => cambiar('nombre')(e.target.value)}
            placeholder="Año escolar 2026-2027"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Inicio de docencia"
            type="date"
            value={campos.inicio}
            onChange={(e) => cambiar('inicio')(e.target.value)}
          />
          <Campo
            etiqueta="Fin de docencia"
            type="date"
            value={campos.fin}
            onChange={(e) => cambiar('fin')(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Apertura de inscripción"
            type="date"
            value={campos.inicioInscripcion}
            onChange={(e) => cambiar('inicioInscripcion')(e.target.value)}
          />
          <Campo
            etiqueta="Cierre de inscripción"
            type="date"
            value={campos.finInscripcion}
            onChange={(e) => cambiar('finInscripcion')(e.target.value)}
          />
        </div>

        {!ano && (
          <Selector
            etiqueta="Períodos de calificación"
            value={campos.periodos}
            onChange={(e) => cambiar('periodos')(e.target.value)}
            ayuda="Se crean repartiendo el calendario en partes iguales y luego se pueden ajustar uno a uno. Cuatro es lo que trabaja el MINERD."
            opciones={[
              { valor: '2', texto: '2 · semestres' },
              { valor: '3', texto: '3 · trimestres' },
              { valor: '4', texto: '4 · el estándar del MINERD' },
            ]}
          />
        )}

        <p className="rounded-sm border border-regla bg-lienzo px-3 py-2.5 text-[12.5px] leading-relaxed text-tinta-media">
          Abrir este año lo convierte en el actual —el que la plataforma muestra por
          defecto— pero no cierra el anterior. Cerrar un año es una decisión aparte,
          porque congela sus calificaciones.
        </p>
      </div>
    </Dialogo>
  )
}

/*
  Los cortes de nota se editan todos juntos porque tienen que encajar entre
  ellos: si uno se alarga, el siguiente empieza más tarde. Editarlos de uno en
  uno dejaría estados intermedios con solapes que el servidor rechazaría a mitad
  de camino.
*/
function DialogoPeriodos({
  ano,
  guardando,
  alCerrar,
  alGuardar,
}: {
  ano: Ano | null
  guardando: boolean
  alCerrar: () => void
  alGuardar: (periodos: unknown[]) => Promise<void>
}) {
  const [lista, setLista] = useState<Ano['periodos']>([])

  useEffect(() => {
    if (ano) setLista(ano.periodos)
  }, [ano])

  if (!ano) return null

  function cambiar(i: number, clave: 'nombre' | 'inicio' | 'fin', valor: string) {
    setLista((previos) =>
      previos.map((p, j) => (j === i ? { ...p, [clave]: valor } : p)),
    )
  }

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      ancho="lg"
      titulo={`Períodos de ${ano.codigo}`}
      descripcion="Deben ir uno detrás de otro, sin solaparse. Un período cerrado ya no admite cambios de nota."
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            disabled={guardando || lista.length === 0}
            onClick={() =>
              void alGuardar(
                lista.map((p, i) => ({
                  id: p.id,
                  orden: i + 1,
                  nombre: p.nombre,
                  inicio: p.inicio,
                  fin: p.fin,
                })),
              )
            }
          >
            {guardando ? 'Guardando…' : 'Guardar períodos'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_150px_150px_36px] items-center gap-2">
          {['Nombre', 'Desde', 'Hasta', ''].map((titulo, i) => (
            <span key={i} className="etiqueta-dato text-tinta-suave">
              {titulo}
            </span>
          ))}

          {lista.map((periodo, i) => (
            <RenglonPeriodo
              key={periodo.id || i}
              periodo={periodo}
              alCambiar={(clave, valor) => cambiar(i, clave, valor)}
              alQuitar={
                lista.length > 1
                  ? () => setLista((previos) => previos.filter((_, j) => j !== i))
                  : undefined
              }
            />
          ))}
        </div>

        <Boton
          variante="secundario"
          tamano="sm"
          iconoIzq={<Plus size={14} strokeWidth={1.75} />}
          onClick={() =>
            setLista((previos) => [
              ...previos,
              {
                id: '',
                orden: previos.length + 1,
                nombre: `${previos.length + 1}.º período`,
                inicio: '',
                fin: '',
                cerrado: false,
              },
            ])
          }
        >
          Añadir período
        </Boton>
      </div>
    </Dialogo>
  )
}

function RenglonPeriodo({
  periodo,
  alCambiar,
  alQuitar,
}: {
  periodo: Ano['periodos'][number]
  alCambiar: (clave: 'nombre' | 'inicio' | 'fin', valor: string) => void
  alQuitar?: () => void
}) {
  const clase =
    'h-9 w-full rounded-sm border border-regla-fuerte bg-superficie px-2 text-[13px] text-tinta focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15 disabled:bg-lienzo disabled:text-tinta-suave'

  return (
    <>
      <input
        value={periodo.nombre}
        onChange={(e) => alCambiar('nombre', e.target.value)}
        disabled={periodo.cerrado}
        aria-label="Nombre del período"
        className={clase}
      />
      <input
        type="date"
        value={periodo.inicio}
        onChange={(e) => alCambiar('inicio', e.target.value)}
        disabled={periodo.cerrado}
        aria-label="Desde"
        className={cn(clase, 'font-dato tabular-nums')}
      />
      <input
        type="date"
        value={periodo.fin}
        onChange={(e) => alCambiar('fin', e.target.value)}
        disabled={periodo.cerrado}
        aria-label="Hasta"
        className={cn(clase, 'font-dato tabular-nums')}
      />
      <button
        type="button"
        onClick={alQuitar}
        disabled={!alQuitar || periodo.cerrado}
        aria-label="Quitar período"
        className="flex h-9 w-9 items-center justify-center rounded-sm text-tinta-suave hover:bg-correccion-tenue hover:text-correccion disabled:cursor-not-allowed disabled:opacity-30"
      >
        ×
      </button>
    </>
  )
}

function DialogoCerrar({
  ano,
  guardando,
  alCancelar,
  alConfirmar,
}: {
  ano: Ano | null
  guardando: boolean
  alCancelar: () => void
  alConfirmar: (id: string) => Promise<void>
}) {
  if (!ano) return null

  return (
    <Dialogo
      abierto
      alCerrar={alCancelar}
      ancho="sm"
      titulo={`Cerrar ${ano.codigo}`}
      descripcion="Las calificaciones de todos sus períodos quedarán fijas y no se podrán modificar. No se puede volver a abrir."
      pie={
        <>
          <Boton variante="fantasma" onClick={alCancelar}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            disabled={guardando}
            onClick={() => void alConfirmar(ano.id)}
          >
            {guardando ? 'Cerrando…' : 'Cerrar el año'}
          </Boton>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-tinta-media">
        {ano.nombre}, del {fechaLegible(ano.inicio)} al {fechaLegible(ano.fin)}, con{' '}
        {ano.secciones} {ano.secciones === 1 ? 'sección' : 'secciones'}.
      </p>
    </Dialogo>
  )
}
