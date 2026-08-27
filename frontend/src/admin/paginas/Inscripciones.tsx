import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  Check,
  Copy,
  KeyRound,
  Receipt,
  UserPlus,
  UserRoundCheck,
  Users,
} from 'lucide-react'
import { AreaTexto } from '../../ui/AreaTexto'
import { Boton } from '../../ui/Boton'
import { Buscador } from '../../ui/Buscador'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import { Etiqueta } from '../../ui/Etiqueta'
import { EstadoVacio } from '../../ui/EstadoVacio'
import { Ficha, FichaCabecera } from '../../ui/Ficha'
import { Selector } from '../../ui/Selector'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../../ui/Tabla'
import { cn } from '../../ui/cn'
import { pedir } from '../../datos/api'
import { useConsulta, useGuardar } from '../../datos/consulta'
import { Pantalla } from '../Pantalla'
import {
  BarraFiltros,
  Cifras,
  EstadoDeCargo,
  EstadoDeCurso,
  EstadoDeInscripcion,
  FiltroSelect,
  MenuFila,
  Nota,
  PieDeTabla,
} from '../piezas'
import { dinero, fechaLegible, type Curso } from '../catalogo'
import {
  METODOS_PAGO,
  nombreEstadoInscripcion,
  type DetalleInscripcion,
  type Inscripcion,
  type ResultadoInscripcion,
} from '../inscripciones'
import type { Persona } from '../datos'
import { TarjetaCurso } from './Cursos'

type RespuestaLista = {
  inscripciones: Inscripcion[]
  total: number
  pagina: number
  porPagina: number
}

/*
  Quién está dentro de qué curso y cuánto debe.

  A diferencia del catálogo, esta lista se filtra y se pagina en el servidor: un
  centro con dos años de operación acumula miles de inscripciones, y traerlas
  todas para filtrar en el navegador dejaría de funcionar justo cuando el negocio
  empieza a ir bien.
*/
export function Inscripciones() {
  const navegar = useNavigate()
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [cursoId, setCursoId] = useState('todos')
  const [estado, setEstado] = useState('todos')
  const [soloDeuda, setSoloDeuda] = useState(false)
  const [pagina, setPagina] = useState(1)

  const [abierta, setAbierta] = useState<string | null>(null)

  /*
    Medio segundo de espera antes de preguntar. Sin esto, escribir "Rodríguez"
    dispara nueve peticiones y la última en llegar no tiene por qué ser la de la
    consulta más reciente.
  */
  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(texto)
      setPagina(1)
    }, 400)
    return () => clearTimeout(t)
  }, [texto])

  const ruta = useMemo(() => {
    const p = new URLSearchParams()
    if (cursoId !== 'todos') p.set('cursoId', cursoId)
    if (estado !== 'todos') p.set('estado', estado)
    if (soloDeuda) p.set('conDeuda', 'true')
    if (busqueda.trim()) p.set('busqueda', busqueda.trim())
    p.set('pagina', String(pagina))
    return `/inscripciones?${p.toString()}`
  }, [cursoId, estado, soloDeuda, busqueda, pagina])

  const { datos, cargando, error, recargar } = useConsulta<RespuestaLista>(ruta)
  const { datos: cat } = useConsulta<{ cursos: Curso[] }>('/catalogo/cursos')

  const cursos = cat?.cursos ?? []
  const cursosDisponibles = cursos.filter((c) => c.estado !== 'graduado')
  const inscripciones = datos?.inscripciones ?? []

  const deudaVisible = inscripciones.reduce((s, i) => s + Number(i.deuda), 0)
  const activas = inscripciones.filter((i) => i.estado === 'activa').length

  return (
    <Pantalla
      icono={UserRoundCheck}
      color="menta"
      titulo="Inscripciones"
      descripcion="Quién está en cada curso. Al inscribir a alguien nuevo el sistema le emite su matrícula y su clave, y genera el cargo por el precio del curso."
      datos={datos}
      cargando={cargando}
      error={error}
      recargar={recargar}
    >
      {(lista) => (
        <>
          {cursos.length === 0 && (
            <Nota tono="aviso">
              Todavía no hay cursos en el catálogo. Crea uno antes de inscribir a nadie: la
              inscripción copia su precio, y sin curso no hay qué cobrar.
            </Nota>
          )}

          <Ficha>
            <Cifras
              datos={[
                {
                  etiqueta: 'Inscripciones',
                  valor: String(lista.total),
                  pie: 'Con los filtros aplicados',
                },
                {
                  etiqueta: 'Cursando',
                  valor: String(activas),
                  pie: 'En esta página',
                },
                {
                  etiqueta: 'Por cobrar',
                  valor: dinero(deudaVisible),
                  pie: 'Suma de esta página',
                  alerta: deudaVisible > 0,
                },
                {
                  etiqueta: 'Cursos activos',
                  valor: String(cursos.filter((c) => c.estado === 'activo').length),
                  pie: 'Impartiendo docencia',
                },
              ]}
            />
          </Ficha>

          <section className="space-y-4">
            <header>
              <h2 className="font-display text-[20px] font-bold text-tinta">
                Elige el curso
              </h2>
              <p className="mt-1 text-[13px] text-tinta-media">
                Selecciona el curso en el que vas a inscribir a la persona.
              </p>
            </header>

            {cursosDisponibles.length === 0 ? (
              <EstadoVacio
                icono={Users}
                titulo="No hay cursos disponibles"
                texto="Los cursos graduados conservan su historial, pero ya no admiten nuevas inscripciones."
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {cursosDisponibles.map((curso) => (
                  <TarjetaCurso
                    key={curso.id}
                    curso={curso}
                    alSeleccionar={() =>
                      navegar(`/admin/inscripciones/nueva/${curso.id}`)
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <Ficha>
            <BarraFiltros>
              <Buscador
                valor={texto}
                alCambiar={setTexto}
                placeholder="Buscar por nombre, matrícula o curso"
                className="w-full sm:w-72"
              />
              <FiltroSelect
                etiqueta="Curso"
                valor={cursoId}
                alCambiar={(v) => {
                  setCursoId(v)
                  setPagina(1)
                }}
                opciones={[
                  { valor: 'todos', texto: 'Todos' },
                  ...cursos.map((c) => ({ valor: c.id, texto: `${c.codigo} · ${c.nombre}` })),
                ]}
              />
              <FiltroSelect
                etiqueta="Estado"
                valor={estado}
                alCambiar={(v) => {
                  setEstado(v)
                  setPagina(1)
                }}
                opciones={[
                  { valor: 'todos', texto: 'Todos' },
                  ...Object.entries(nombreEstadoInscripcion).map(([valor, texto]) => ({
                    valor,
                    texto,
                  })),
                ]}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={soloDeuda}
                  onChange={(e) => {
                    setSoloDeuda(e.target.checked)
                    setPagina(1)
                  }}
                  className="h-4 w-4 accent-[var(--color-pizarra,#0055fc)]"
                />
                <span className="text-[13px] text-tinta-media">Solo con deuda</span>
              </label>
            </BarraFiltros>

            {lista.inscripciones.length === 0 ? (
              <EstadoVacio
                icono={Users}
                titulo={lista.total === 0 ? 'Todavía no hay inscripciones' : 'Nada coincide'}
                texto={
                  lista.total === 0
                    ? 'Inscribir a alguien crea su matrícula, su clave y el cargo del curso en un solo acto.'
                    : 'Prueba con otro término o quita los filtros.'
                }
              />
            ) : (
              <>
                <Tabla>
                  <Encabezado>
                    <Th className="w-36">Matrícula</Th>
                    <Th>Persona</Th>
                    <Th className="hidden lg:table-cell">Curso</Th>
                    <Th className="w-28">Inscrita</Th>
                    <Th className="w-28">Deuda</Th>
                    <Th className="w-28">Estado</Th>
                    <Th className="w-10" />
                  </Encabezado>
                  <tbody>
                    {lista.inscripciones.map((i) => (
                      <Fila key={i.id} onClick={() => setAbierta(i.id)}>
                        <TdDato className="text-pizarra">{i.matricula ?? '—'}</TdDato>
                        <Td>
                          <p className="text-[13.5px] font-medium text-tinta">{i.nombre}</p>
                          <p className="mt-0.5 text-[12px] text-tinta-suave">
                            {i.correo ?? i.telefono ?? 'Sin contacto'}
                          </p>
                        </Td>
                        <Td className="hidden lg:table-cell">
                          <span className="font-dato text-[12px] text-pizarra">
                            {i.codigoCurso}
                          </span>{' '}
                          <span className="text-[13px] text-tinta-media">{i.curso}</span>
                        </Td>
                        <TdDato className="text-tinta-media">
                          {fechaLegible(i.inscritoEn)}
                        </TdDato>
                        <TdDato
                          className={cn(
                            Number(i.deuda) > 0 ? 'font-medium text-correccion' : 'text-tinta-suave',
                          )}
                        >
                          {Number(i.deuda) > 0 ? dinero(i.deuda) : 'Al día'}
                        </TdDato>
                        <Td>
                          <EstadoDeInscripcion estado={i.estado} />
                        </Td>
                        <Td className="pr-3" onClick={(e) => e.stopPropagation()}>
                          <MenuFila
                            acciones={[
                              { etiqueta: 'Ver ficha y cuenta', alElegir: () => setAbierta(i.id) },
                            ]}
                          />
                        </Td>
                      </Fila>
                    ))}
                  </tbody>
                </Tabla>

                <PieDeTabla
                  mostradas={lista.inscripciones.length}
                  total={lista.total}
                  sustantivo="inscripciones"
                />

                {lista.total > lista.porPagina && (
                  <div className="flex items-center justify-end gap-2 border-t border-regla px-5 py-2.5">
                    <Boton
                      variante="secundario"
                      tamano="sm"
                      disabled={pagina <= 1}
                      onClick={() => setPagina((p) => p - 1)}
                    >
                      Anterior
                    </Boton>
                    <span className="font-dato text-[12px] text-tinta-suave">
                      {pagina} de {Math.ceil(lista.total / lista.porPagina)}
                    </span>
                    <Boton
                      variante="secundario"
                      tamano="sm"
                      disabled={pagina >= Math.ceil(lista.total / lista.porPagina)}
                      onClick={() => setPagina((p) => p + 1)}
                    >
                      Siguiente
                    </Boton>
                  </div>
                )}
              </>
            )}
          </Ficha>

          {abierta && (
            <PanelInscripcion
              id={abierta}
              alCerrar={() => setAbierta(null)}
              alCambiar={recargar}
            />
          )}
        </>
      )}
    </Pantalla>
  )
}

// ---------------------------------------------------------------------------
// Inscribir
// ---------------------------------------------------------------------------

export function FormularioInscripcion({
  cursos,
  cursoInicialId,
  alCerrar,
  alListo,
}: {
  cursos: Curso[]
  cursoInicialId?: string
  alCerrar: () => void
  alListo: (r: ResultadoInscripcion) => void
}) {
  const [cursoId, setCursoId] = useState('')
  const [esNueva, setEsNueva] = useState(true)
  const [membresiaId, setMembresiaId] = useState('')
  const [buscaPersona, setBuscaPersona] = useState('')

  const [nombres, setNombres] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [correo, setCorreo] = useState('')
  const [documento, setDocumento] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [ocupacion, setOcupacion] = useState('')
  const [comoNosConocio, setComoNosConocio] = useState('')

  const [estado, setEstado] = useState('activa')
  const [descuento, setDescuento] = useState('')
  const [sinCobro, setSinCobro] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [paso, setPaso] = useState(1)

  const { guardar, guardando, error } = useGuardar()

  // Solo se piden cuando hacen falta, que es al elegir "ya es alumno".
  const { datos: dir } = useConsulta<{ personas: Persona[] }>(
    esNueva
      ? '/personas?rol=estudiante&porPagina=1'
      : `/personas?rol=estudiante&porPagina=50${
          buscaPersona.trim() ? `&busqueda=${encodeURIComponent(buscaPersona.trim())}` : ''
        }`,
  )

  const cursoPredeterminado = cursoInicialId ?? cursos[0]?.id ?? ''

  useEffect(() => {
    setCursoId(cursoPredeterminado)
    setEsNueva(true)
    setMembresiaId('')
    setBuscaPersona('')
    setNombres('')
    setApellidos('')
    setCorreo('')
    setDocumento('')
    setTelefono('')
    setDireccion('')
    setOcupacion('')
    setComoNosConocio('')
    setEstado('activa')
    setDescuento('')
    setSinCobro(false)
    setObservaciones('')
    setPaso(1)
  }, [cursoPredeterminado])

  const curso = cursos.find((c) => c.id === cursoId) ?? null
  const precio = curso ? Number(curso.precio) : 0
  const total = Math.max(0, precio - (Number(descuento) || 0))

  const estudianteListo =
    cursoId !== '' &&
    (esNueva ? nombres.trim() !== '' && apellidos.trim() !== '' : membresiaId !== '')
  const personaElegida = esNueva
    ? `${nombres.trim()} ${apellidos.trim()}`.trim()
    : dir?.personas.find((persona) => persona.id === membresiaId)?.nombre ?? 'Alumno existente'

  async function enviar() {
    const cuerpo: Record<string, unknown> = {
      cursoId,
      estado,
      descuento: Number(descuento) || 0,
      sinCobro,
      observaciones: observaciones.trim(),
    }

    if (esNueva) {
      Object.assign(cuerpo, {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        correo: correo.trim(),
        documento: documento.trim(),
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        ocupacion: ocupacion.trim(),
        comoNosConocio: comoNosConocio.trim(),
      })
    } else {
      cuerpo.membresiaId = membresiaId
    }

    const r = await guardar(() =>
      pedir<ResultadoInscripcion>('/inscripciones', { metodo: 'POST', cuerpo }),
    )
    if (r) alListo(r)
  }

  return (
    <Ficha className="overflow-hidden">
      {curso && (
        <div className="flex flex-wrap items-center gap-4 border-b border-regla bg-lienzo px-6 py-4">
          <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-regla bg-superficie">
            {curso.imagenUrl ? (
              <img
                src={curso.imagenUrl}
                alt={`Portada de ${curso.nombre}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-dato text-[11px] text-tinta-suave">SIN PORTADA</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-dato text-[11.5px] text-pizarra">{curso.codigo}</span>
              <EstadoDeCurso estado={curso.estado} />
            </div>
            <h2 className="mt-1 text-[17px] font-bold text-tinta">{curso.nombre}</h2>
            <p className="mt-1 text-[12.5px] text-tinta-media">
              {curso.instructor ?? 'Sin instructor'} · {curso.duracionSemanas}{' '}
              {curso.duracionSemanas === 1 ? 'semana' : 'semanas'}
            </p>
          </div>
          <p className="font-dato text-[18px] font-semibold text-tinta">
            {Number(curso.precio) === 0 ? 'Gratis' : dinero(curso.precio, curso.moneda)}
          </p>
        </div>
      )}

      <PasosInscripcion paso={paso} alElegir={setPaso} />

      <div className="px-6 py-6">
        {error && <Nota tono="error">{error}</Nota>}

        {paso === 1 && (
          <div className="flex flex-col gap-5">
            <div className="grid gap-2 sm:grid-cols-2">
              <BotonCamino
                activo={esNueva}
                icono={UserPlus}
                titulo="Alguien nuevo"
                texto="Se le crea cuenta, matrícula y clave"
                alElegir={() => setEsNueva(true)}
              />
              <BotonCamino
                activo={!esNueva}
                icono={Users}
                titulo="Ya es alumno"
                texto="Conserva su matrícula y su clave"
                alElegir={() => setEsNueva(false)}
              />
            </div>

            {esNueva ? (
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo
                    etiqueta="Nombres"
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    placeholder="María Altagracia"
                  />
                  <Campo
                    etiqueta="Apellidos"
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    placeholder="Reyes Cruz"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo
                    etiqueta="Cédula o documento"
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    placeholder="001-1234567-8"
                    ayuda="Evita inscribir dos veces a la misma persona."
                  />
                  <Campo
                    etiqueta="Teléfono"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="809-555-0100"
                  />
                </div>
                <Campo
                  etiqueta="Correo"
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="Opcional"
                  ayuda="Opcional: se entra con la matrícula, no con el correo."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo
                    etiqueta="Ocupación"
                    value={ocupacion}
                    onChange={(e) => setOcupacion(e.target.value)}
                  />
                  <Campo
                    etiqueta="Cómo nos conoció"
                    value={comoNosConocio}
                    onChange={(e) => setComoNosConocio(e.target.value)}
                    placeholder="Redes, referido, pasó por el local"
                  />
                </div>
                <Campo
                  etiqueta="Dirección"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Buscador
                  valor={buscaPersona}
                  alCambiar={setBuscaPersona}
                  placeholder="Buscar por nombre o matrícula"
                />
                <div className="max-h-72 overflow-y-auto rounded-sm border border-regla">
                  {(dir?.personas ?? []).length === 0 ? (
                    <p className="px-3 py-4 text-center text-[13px] text-tinta-suave">
                      Nadie coincide. Si es su primera vez, usa «Alguien nuevo».
                    </p>
                  ) : (
                    (dir?.personas ?? []).map((persona) => (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => setMembresiaId(persona.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 border-b border-regla px-3 py-2.5 text-left last:border-b-0',
                          membresiaId === persona.id ? 'bg-pizarra-tenue' : 'hover:bg-lienzo',
                        )}
                      >
                        <span>
                          <span className="block text-[13.5px] font-medium text-tinta">
                            {persona.nombre}
                          </span>
                          <span className="block text-[12px] text-tinta-suave">
                            {persona.correo}
                          </span>
                        </span>
                        <span className="font-dato text-[12px] text-pizarra">
                          {persona.codigo ?? '—'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {paso === 2 && (
          <div className="flex flex-col gap-5">
            {curso?.estado === 'promocion' && (
              <Nota tono="aviso">
                Este curso está en promoción y todavía no ha iniciado docencia.
              </Nota>
            )}
            <Selector
              etiqueta="Estado inicial"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              opciones={[
                { valor: 'activa', texto: 'Activa · ya está cursando' },
                { valor: 'preinscrita', texto: 'Preinscrita · reservó el cupo' },
              ]}
            />
            <AreaTexto
              etiqueta="Observaciones"
              rows={4}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Acuerdos de pago, detalles del caso."
            />
          </div>
        )}

        {paso === 3 && (
          <div className="flex flex-col gap-5">
            <div className="flex items-baseline justify-between border-y border-regla py-4">
              <span className="text-[13px] font-medium text-tinta">Total a cobrar</span>
              <span className="font-dato text-[22px] font-semibold tabular-nums text-tinta">
                {sinCobro ? 'Sin cargo' : dinero(total, curso?.moneda ?? 'DOP')}
              </span>
            </div>

            <Campo
              etiqueta="Descuento"
              type="number"
              min={0}
              step="0.01"
              max={precio}
              value={descuento}
              disabled={sinCobro}
              onChange={(e) => setDescuento(e.target.value)}
              placeholder="0.00"
              ayuda={`Precio de lista: ${dinero(precio, curso?.moneda ?? 'DOP')}`}
            />

            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={sinCobro}
                onChange={(e) => setSinCobro(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-pizarra,#0055fc)]"
              />
              <span className="text-[13px] leading-relaxed text-tinta-media">
                <span className="font-medium text-tinta">Sin cargo</span> · cortesía o
                intercambio.
              </span>
            </label>

            <dl className="grid gap-4 border-t border-regla pt-4 sm:grid-cols-3">
              <Dato etiqueta="Estudiante" valor={personaElegida} />
              <Dato
                etiqueta="Inscripción"
                valor={estado === 'activa' ? 'Activa' : 'Preinscrita'}
              />
              <Dato
                etiqueta="Importe"
                valor={sinCobro ? 'Sin cargo' : dinero(total, curso?.moneda ?? 'DOP')}
              />
            </dl>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-regla bg-lienzo px-6 py-4">
        <Boton
          variante="fantasma"
          onClick={paso === 1 ? alCerrar : () => setPaso((actual) => actual - 1)}
        >
          {paso === 1 ? 'Cancelar' : 'Anterior'}
        </Boton>
        {paso < 3 ? (
          <Boton
            variante="primario"
            disabled={paso === 1 && !estudianteListo}
            onClick={() => setPaso((actual) => actual + 1)}
          >
            Continuar
          </Boton>
        ) : (
          <Boton
            variante="primario"
            disabled={guardando || !estudianteListo}
            onClick={() => void enviar()}
          >
            {guardando ? 'Inscribiendo…' : 'Confirmar inscripción'}
          </Boton>
        )}
      </footer>
    </Ficha>
  )
}

const PASOS_INSCRIPCION = [
  { numero: 1, etiqueta: 'Estudiante' },
  { numero: 2, etiqueta: 'Inscripción' },
  { numero: 3, etiqueta: 'Cobro' },
]

function PasosInscripcion({
  paso,
  alElegir,
}: {
  paso: number
  alElegir: (paso: number) => void
}) {
  return (
    <nav aria-label="Progreso de la inscripción" className="border-b border-regla px-6 py-4">
      <ol className="grid grid-cols-3 gap-2">
        {PASOS_INSCRIPCION.map((item) => {
          const completado = item.numero < paso
          const activo = item.numero === paso
          return (
            <li key={item.numero}>
              <button
                type="button"
                disabled={item.numero > paso}
                onClick={() => alElegir(item.numero)}
                aria-current={activo ? 'step' : undefined}
                className={cn(
                  'flex min-h-10 w-full items-center gap-2 border-b-2 px-1 pb-2 text-left',
                  activo || completado
                    ? 'border-pizarra text-tinta'
                    : 'border-regla text-tinta-suave',
                  completado && 'cursor-pointer hover:text-pizarra',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-dato text-[11px] font-semibold',
                    activo || completado
                      ? 'border-pizarra bg-pizarra text-white'
                      : 'border-regla-fuerte bg-superficie text-tinta-suave',
                  )}
                >
                  {completado ? <Check size={13} strokeWidth={2.5} /> : item.numero}
                </span>
                <span className="truncate text-[12.5px] font-semibold">{item.etiqueta}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function BotonCamino({
  activo,
  icono: Icono,
  titulo,
  texto,
  alElegir,
}: {
  activo: boolean
  icono: typeof UserPlus
  titulo: string
  texto: string
  alElegir: () => void
}) {
  return (
    <button
      type="button"
      onClick={alElegir}
      className={cn(
        'flex items-start gap-3 rounded-sm border px-3.5 py-3 text-left transition-colors',
        activo
          ? 'border-pizarra bg-pizarra-tenue'
          : 'border-regla-fuerte hover:border-tinta-suave hover:bg-lienzo',
      )}
    >
      <Icono
        size={17}
        strokeWidth={1.5}
        className={cn('mt-0.5 shrink-0', activo ? 'text-pizarra' : 'text-tinta-suave')}
      />
      <span>
        <span
          className={cn(
            'block text-[13.5px] font-medium',
            activo ? 'text-pizarra' : 'text-tinta',
          )}
        >
          {titulo}
        </span>
        <span className="block text-[12px] text-tinta-suave">{texto}</span>
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Las credenciales recién emitidas
// ---------------------------------------------------------------------------
/*
  Esto no es una confirmación decorativa: la clave en claro existe una sola vez,
  en la respuesta de inscribir, y no se puede volver a consultar. Si se cierra
  este diálogo sin copiarla, la única salida es regenerarla.
*/
export function DialogoCredenciales({
  resultado,
  alCerrar,
}: {
  resultado: ResultadoInscripcion | null
  alCerrar: () => void
}) {
  const [copiado, setCopiado] = useState(false)

  if (!resultado?.clave) return null

  const texto = `Matrícula: ${resultado.matricula}\nClave: ${resultado.clave}`

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      titulo="Credenciales emitidas"
      descripcion="Entrégaselas ahora. La clave no se puede volver a consultar."
      pie={
        <Boton variante="primario" onClick={alCerrar}>
          Ya las entregué
        </Boton>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-sm border border-pizarra/25 bg-pizarra-tenue px-4 py-3">
          <BadgeCheck size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-pizarra" />
          <p className="text-[13px] leading-relaxed text-pizarra">
            {resultado.inscripcion.nombre} quedó inscrito en {resultado.inscripcion.curso}.
            {resultado.cargoGenerado
              ? ` Se generó el cargo por ${dinero(resultado.inscripcion.total)}.`
              : ' No se generó ningún cargo.'}
          </p>
        </div>

        <dl className="divide-y divide-regla rounded-sm border border-regla">
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="etiqueta-dato text-tinta-suave">Matrícula</dt>
            <dd className="font-dato text-[16px] font-medium tracking-wide text-tinta">
              {resultado.matricula}
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="etiqueta-dato text-tinta-suave">Clave</dt>
            <dd className="font-dato text-[16px] font-medium tracking-[0.12em] text-tinta">
              {resultado.clave}
            </dd>
          </div>
        </dl>

        <Boton
          variante="secundario"
          ancho
          iconoIzq={<Copy size={15} strokeWidth={1.75} />}
          onClick={() => {
            void navigator.clipboard?.writeText(texto).then(() => setCopiado(true))
          }}
        >
          {copiado ? 'Copiado' : 'Copiar matrícula y clave'}
        </Boton>
      </div>
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------
// La ficha y la cuenta
// ---------------------------------------------------------------------------

function PanelInscripcion({
  id,
  alCerrar,
  alCambiar,
}: {
  id: string
  alCerrar: () => void
  alCambiar: () => void
}) {
  const { datos, cargando, error, recargar } = useConsulta<DetalleInscripcion>(
    `/inscripciones/${id}`,
  )
  const { guardar, guardando, error: errorGuardar } = useGuardar()
  const [cobrando, setCobrando] = useState<string | null>(null)
  const [claveNueva, setClaveNueva] = useState<string | null>(null)

  async function operar<R>(operacion: () => Promise<R>) {
    const r = await guardar(operacion)
    if (r !== null) {
      recargar()
      alCambiar()
    }
    return r
  }

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      ancho="lg"
      titulo={datos ? datos.inscripcion.nombre : 'Cargando…'}
      descripcion={
        datos ? `${datos.inscripcion.codigoCurso} · ${datos.inscripcion.curso}` : undefined
      }
      pie={
        <Boton variante="secundario" onClick={alCerrar}>
          Cerrar
        </Boton>
      }
    >
      {cargando && !datos && <p className="text-[13px] text-tinta-suave">Cargando la ficha…</p>}
      {error && <Nota tono="error">{error}</Nota>}

      {datos && (
        <div className="flex flex-col gap-5">
          {errorGuardar && <Nota tono="error">{errorGuardar}</Nota>}
          {claveNueva && (
            <Nota tono="exito">
              Clave nueva: <span className="font-dato tracking-[0.12em]">{claveNueva}</span> —
              la anterior dejó de servir en el acto.
            </Nota>
          )}

          {/* --- Cabecera de estado --------------------------------------- */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Etiqueta tono="info">{datos.inscripcion.matricula ?? 'Sin matrícula'}</Etiqueta>
            <EstadoDeInscripcion estado={datos.inscripcion.estado} />
            <span className="text-[12.5px] text-tinta-suave">
              Inscrita el {fechaLegible(datos.inscripcion.inscritoEn)}
            </span>
          </div>

          {/* --- La cuenta ------------------------------------------------ */}
          <Ficha>
            <FichaCabecera
              titulo="Cuenta"
              descripcion={
                Number(datos.inscripcion.deuda) > 0
                  ? `Debe ${dinero(datos.inscripcion.deuda)} de ${dinero(datos.inscripcion.facturado)}`
                  : 'Al día'
              }
            />
            {datos.cargos.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-tinta-suave">
                No se generó ningún cargo para esta inscripción.
              </p>
            ) : (
              <Tabla>
                <Encabezado>
                  <Th>Concepto</Th>
                  <Th className="w-28">Monto</Th>
                  <Th className="w-28">Pagado</Th>
                  <Th className="w-28">Estado</Th>
                  <Th className="w-10" />
                </Encabezado>
                <tbody>
                  {datos.cargos.map((c) => (
                    <Fila key={c.id}>
                      <Td>
                        <p className="text-[13.5px] text-tinta">{c.descripcion}</p>
                        {c.venceEn && (
                          <p className="mt-0.5 text-[12px] text-tinta-suave">
                            Vence {fechaLegible(c.venceEn)}
                          </p>
                        )}
                        {c.motivo && (
                          <p className="mt-0.5 text-[12px] text-tinta-suave">{c.motivo}</p>
                        )}
                      </Td>
                      <TdDato className="text-tinta">{dinero(c.monto)}</TdDato>
                      <TdDato className="text-tinta-media">{dinero(c.pagado)}</TdDato>
                      <Td>
                        <EstadoDeCargo estado={c.estado} />
                      </Td>
                      <Td className="pr-3">
                        {c.estado === 'pendiente' && (
                          <MenuFila
                            acciones={[
                              { etiqueta: 'Registrar pago', alElegir: () => setCobrando(c.id) },
                              {
                                etiqueta: 'Condonar',
                                peligrosa: true,
                                alElegir: () => {
                                  const motivo = window.prompt(
                                    'Condonar exige decir por qué. ¿Motivo?',
                                  )
                                  if (motivo?.trim()) {
                                    void operar(() =>
                                      pedir(`/inscripciones/cargos/${c.id}/condonar`, {
                                        metodo: 'POST',
                                        cuerpo: { motivo },
                                      }),
                                    )
                                  }
                                },
                              },
                            ]}
                          />
                        )}
                      </Td>
                    </Fila>
                  ))}
                </tbody>
              </Tabla>
            )}
          </Ficha>

          {/* --- Pagos recibidos ------------------------------------------ */}
          {datos.pagos.length > 0 && (
            <Ficha>
              <FichaCabecera titulo="Pagos recibidos" />
              <Tabla>
                <Encabezado>
                  <Th className="w-28">Fecha</Th>
                  <Th className="w-28">Monto</Th>
                  <Th>Método</Th>
                  <Th className="hidden sm:table-cell">Recibió</Th>
                </Encabezado>
                <tbody>
                  {datos.pagos.map((p) => (
                    <Fila key={p.id}>
                      <TdDato className="text-tinta-media">{fechaLegible(p.recibidoEn)}</TdDato>
                      <TdDato className={cn(p.anulado && 'text-tinta-suave line-through')}>
                        {dinero(p.monto)}
                      </TdDato>
                      <Td className="text-[13px] text-tinta-media">
                        {p.metodo}
                        {p.referencia && (
                          <span className="ml-1.5 font-dato text-[12px] text-tinta-suave">
                            {p.referencia}
                          </span>
                        )}
                        {p.anulado && (
                          <Etiqueta tono="neutro">
                            <span className="ml-1">Anulado</span>
                          </Etiqueta>
                        )}
                      </Td>
                      <Td className="hidden text-[13px] text-tinta-suave sm:table-cell">
                        {p.registradoPor ?? '—'}
                      </Td>
                    </Fila>
                  ))}
                </tbody>
              </Tabla>
            </Ficha>
          )}

          {/* --- Datos de la persona -------------------------------------- */}
          {datos.ficha && (
            <Ficha>
              <FichaCabecera titulo="Ficha" />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-3">
                <Dato etiqueta="Documento" valor={datos.ficha.documento} />
                <Dato etiqueta="Teléfono" valor={datos.ficha.telefono} />
                <Dato etiqueta="Correo" valor={datos.inscripcion.correo} />
                <Dato etiqueta="Ocupación" valor={datos.ficha.ocupacion} />
                <Dato etiqueta="Empresa" valor={datos.ficha.empresa} />
                <Dato etiqueta="Nos conoció por" valor={datos.ficha.comoNosConocio} />
                <Dato
                  etiqueta="Dirección"
                  valor={datos.ficha.direccion}
                  className="col-span-2 sm:col-span-3"
                />
              </dl>
            </Ficha>
          )}

          {/* --- Otros cursos de la misma persona ------------------------- */}
          {datos.otrosCursos.length > 0 && (
            <Ficha>
              <FichaCabecera
                titulo="Otros cursos"
                descripcion="La misma matrícula sirve para todos"
              />
              <ul>
                {datos.otrosCursos.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 border-b border-regla px-5 py-2.5 last:border-b-0"
                  >
                    <span className="text-[13px] text-tinta">
                      <span className="font-dato text-[12px] text-pizarra">{c.codigo}</span>{' '}
                      {c.nombre}
                    </span>
                    <EstadoDeInscripcion estado={c.estado} />
                  </li>
                ))}
              </ul>
            </Ficha>
          )}

          {/* --- Acciones -------------------------------------------------- */}
          <div className="flex flex-wrap gap-2">
            <Selector
              etiqueta="Cambiar estado"
              className="w-48"
              value={datos.inscripcion.estado}
              disabled={guardando}
              onChange={(e) => {
                void operar(() =>
                  pedir<{ inscripcion: Inscripcion }>(`/inscripciones/${id}`, {
                    metodo: 'PATCH',
                    cuerpo: { estado: e.target.value },
                  }),
                )
              }}
              opciones={Object.entries(nombreEstadoInscripcion).map(([valor, texto]) => ({
                valor,
                texto,
              }))}
            />

            <div className="flex items-end">
              <Boton
                variante="secundario"
                iconoIzq={<KeyRound size={15} strokeWidth={1.75} />}
                disabled={guardando}
                onClick={() => {
                  void guardar(() =>
                    pedir<{ clave: string }>(`/inscripciones/${id}/clave`, { metodo: 'POST' }),
                  ).then((r) => {
                    if (r) setClaveNueva(r.clave)
                  })
                }}
              >
                Regenerar clave
              </Boton>
            </div>
          </div>

          {cobrando && (
            <DialogoPago
              cargo={datos.cargos.find((c) => c.id === cobrando)!}
              alCerrar={() => setCobrando(null)}
              alListo={() => {
                setCobrando(null)
                recargar()
                alCambiar()
              }}
            />
          )}
        </div>
      )}
    </Dialogo>
  )
}

function Dato({
  etiqueta,
  valor,
  className,
}: {
  etiqueta: string
  valor: string | null
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="etiqueta-dato text-tinta-suave">{etiqueta}</dt>
      <dd className="mt-0.5 text-[13px] text-tinta">{valor ?? '—'}</dd>
    </div>
  )
}

function DialogoPago({
  cargo,
  alCerrar,
  alListo,
}: {
  cargo: { id: string; descripcion: string; monto: string; pagado: string }
  alCerrar: () => void
  alListo: () => void
}) {
  const pendiente = (Number(cargo.monto) - Number(cargo.pagado)).toFixed(2)
  const [monto, setMonto] = useState(pendiente)
  const [metodo, setMetodo] = useState('efectivo')
  const [referencia, setReferencia] = useState('')
  const [recibidoEn, setRecibidoEn] = useState(new Date().toISOString().slice(0, 10))
  const [nota, setNota] = useState('')
  const { guardar, guardando, error } = useGuardar()

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      titulo="Registrar pago"
      descripcion={cargo.descripcion}
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            disabled={guardando || Number(monto) <= 0}
            onClick={() => {
              void guardar(() =>
                pedir(`/inscripciones/cargos/${cargo.id}/pagos`, {
                  metodo: 'POST',
                  cuerpo: {
                    monto: Number(monto),
                    metodo,
                    referencia: referencia.trim(),
                    recibidoEn,
                    nota: nota.trim(),
                  },
                }),
              ).then((r) => {
                if (r !== null) alListo()
              })
            }}
          >
            {guardando ? 'Registrando…' : 'Registrar'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Nota tono="error">{error}</Nota>}

        <div className="flex items-center gap-2 rounded-sm border border-regla bg-lienzo px-3.5 py-2.5">
          <Receipt size={16} strokeWidth={1.5} className="shrink-0 text-tinta-suave" />
          <p className="text-[13px] text-tinta-media">
            Pendiente <span className="font-dato text-tinta">{dinero(pendiente)}</span> de{' '}
            {dinero(cargo.monto)}. Se admiten abonos parciales.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Monto"
            type="number"
            min={0.01}
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            autoFocus
          />
          <Selector
            etiqueta="Método"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            opciones={METODOS_PAGO}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Referencia"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Nº de transferencia o recibo"
            ayuda="Lo que permite cuadrar con el banco."
          />
          <Campo
            etiqueta="Recibido el"
            type="date"
            value={recibidoEn}
            onChange={(e) => setRecibidoEn(e.target.value)}
          />
        </div>

        <AreaTexto
          etiqueta="Nota"
          rows={2}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
      </div>
    </Dialogo>
  )
}
