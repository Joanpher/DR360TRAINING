import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  Clock3,
  Image as IconoImagen,
  MapPin,
  Plus,
  Trash2,
  TriangleAlert,
  Upload,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { AreaTexto } from '../../ui/AreaTexto'
import { Boton } from '../../ui/Boton'
import { Buscador } from '../../ui/Buscador'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import { Etiqueta } from '../../ui/Etiqueta'
import { EstadoVacio } from '../../ui/EstadoVacio'
import { Ficha } from '../../ui/Ficha'
import { Selector } from '../../ui/Selector'
import { pedir } from '../../datos/api'
import { useConsulta, useGuardar } from '../../datos/consulta'
import { Pantalla } from '../Pantalla'
import {
  BarraFiltros,
  Cifras,
  EstadoDeCurso,
  FiltroSelect,
  MenuFila,
  Nota,
} from '../piezas'
import {
  DIAS_SEMANA,
  dinero,
  fechaLegible,
  horarioLegible,
  nombreModalidad,
  nombreNivel,
  type Categoria,
  type Curso,
  type Horario,
  type Instructor,
  type Sede,
} from '../catalogo'

type Respuesta = { cursos: Curso[] }

/*
  El catálogo. Cada fila es un curso: lo que se anuncia, se cotiza y se cobra.

  Un curso sin instructor es el problema más caro de esta pantalla -no se puede
  publicar, y sin publicar nadie se inscribe-, así que no se dibuja como una
  celda vacía sino como una alerta.

  El filtrado es en el navegador y no en el servidor a propósito. El catálogo de
  un centro son decenas de cursos, ya vienen todos en la primera petición, y
  filtrar aquí responde al instante mientras se escribe. El API acepta los mismos
  filtros para cuando exista el catálogo público, que sí es otra escala.
*/
export function Cursos() {
  const navegar = useNavigate()
  const { datos, cargando, error, recargar, fijar } = useConsulta<Respuesta>('/catalogo/cursos')
  const { datos: cat } = useConsulta<{ categorias: Categoria[] }>('/catalogo/categorias')
  const { datos: sed } = useConsulta<{ sedes: Sede[] }>('/catalogo/sedes')
  const { datos: ins } = useConsulta<{ instructores: Instructor[] }>(
    '/catalogo/cursos/instructores',
  )

  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('todas')
  const [estado, setEstado] = useState('todos')
  const [editando, setEditando] = useState<Curso | null>(null)
  const { guardar, guardando, error: errorGuardar } = useGuardar()

  const cursos = useMemo(() => datos?.cursos ?? [], [datos])

  const filtrados = useMemo(() => {
    const buscado = texto.trim().toLowerCase()
    return cursos.filter((c) => {
      if (categoria !== 'todas' && c.categoriaId !== categoria) return false
      // "Sin instructor" no es un estado del curso sino una carencia; se filtra
      // por la misma casilla porque es lo que se busca cuando se busca eso.
      if (estado === 'sin-instructor' && c.instructorMembresiaId !== null) return false
      if (estado !== 'todos' && estado !== 'sin-instructor' && c.estado !== estado) return false
      if (!buscado) return true
      return (
        c.nombre.toLowerCase().includes(buscado) ||
        c.codigo.toLowerCase().includes(buscado) ||
        (c.instructor ?? '').toLowerCase().includes(buscado)
      )
    })
  }, [cursos, texto, categoria, estado])

  const activos = cursos.filter((c) => c.estado === 'activo')
  const enPromocion = cursos.filter((c) => c.estado === 'promocion')
  const graduados = cursos.filter((c) => c.estado === 'graduado')
  const inscritos = cursos.reduce((suma, c) => suma + c.inscritos, 0)

  async function operar(operacion: () => Promise<Respuesta>) {
    const r = await guardar(operacion)
    if (r) fijar(r)
    return r
  }

  return (
    <Pantalla
      titulo="Cursos"
      descripcion="El catálogo del centro. El estado de cada curso cambia automáticamente según sus fechas."
      datos={datos}
      cargando={cargando}
      error={error}
      recargar={recargar}
      accion={
        <Boton
          variante="primario"
          iconoIzq={<Plus size={15} strokeWidth={1.75} />}
          onClick={() => navegar('/admin/cursos/nuevo')}
        >
          Crear curso
        </Boton>
      }
    >
      {() => (
        <>
          {errorGuardar && <Nota tono="error">{errorGuardar}</Nota>}

          <Ficha>
            <Cifras
              datos={[
                {
                  etiqueta: 'En catálogo',
                  valor: String(cursos.length),
                  pie: `${activos.length} impartiendo docencia`,
                },
                {
                  etiqueta: 'Inscritos',
                  valor: String(inscritos),
                  pie: 'En cursos activos y preinscripciones',
                },
                {
                  etiqueta: 'En promoción',
                  valor: String(enPromocion.length),
                  pie: 'Todavía no han iniciado',
                },
                {
                  etiqueta: 'Graduados',
                  valor: String(graduados.length),
                  pie: 'Cursos que ya terminaron',
                },
              ]}
            />
          </Ficha>

          <div className="border-y border-regla bg-superficie">
            <BarraFiltros>
              <Buscador
                valor={texto}
                alCambiar={setTexto}
                placeholder="Buscar por nombre, código o instructor"
                className="w-full sm:w-72"
              />
              <FiltroSelect
                etiqueta="Categoría"
                valor={categoria}
                alCambiar={setCategoria}
                opciones={[
                  { valor: 'todas', texto: 'Todas' },
                  ...(cat?.categorias ?? []).map((c) => ({ valor: c.id, texto: c.nombre })),
                ]}
              />
              <FiltroSelect
                etiqueta="Estado"
                valor={estado}
                alCambiar={setEstado}
                opciones={[
                  { valor: 'todos', texto: 'Todos' },
                  { valor: 'promocion', texto: 'En promoción' },
                  { valor: 'activo', texto: 'Activos' },
                  { valor: 'graduado', texto: 'Graduados' },
                  { valor: 'sin-instructor', texto: 'Sin instructor' },
                ]}
              />
            </BarraFiltros>
          </div>

          {cursos.length === 0 ? (
            <EstadoVacio
              icono={BookOpen}
              titulo="El catálogo está vacío"
              texto="Un curso es lo que se anuncia y se cobra: lleva precio, duración, horario e instructor. Sin cursos no hay nada en lo que inscribir a nadie."
              accion={
                <Boton variante="primario" onClick={() => navegar('/admin/cursos/nuevo')}>
                  Crear el primer curso
                </Boton>
              }
            />
          ) : filtrados.length === 0 ? (
            <EstadoVacio
              icono={BookOpen}
              titulo="Ningún curso coincide"
              texto="Prueba con otro término o quita los filtros."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtrados.map((curso) => (
                <TarjetaCurso
                  key={curso.id}
                  curso={curso}
                  alEditar={() => setEditando(curso)}
                  alEliminar={() => {
                    void operar(() =>
                      pedir<Respuesta>(`/catalogo/cursos/${curso.id}`, {
                        metodo: 'DELETE',
                      }),
                    )
                  }}
                />
              ))}
            </div>
          )}

          <p className="text-[12.5px] leading-relaxed text-tinta-suave">
            Un curso con inscripciones se conserva en el historial académico.{' '}
            <Link
              to="/admin/inscripciones"
              className="text-pizarra underline-offset-4 hover:underline"
            >
              Ver quién está inscrito
            </Link>
            .
          </p>

          <FormularioCurso
            abierto={editando !== null}
            curso={editando}
            categorias={cat?.categorias ?? []}
            sedes={sed?.sedes ?? []}
            instructores={ins?.instructores ?? []}
            guardando={guardando}
            alCerrar={() => {
              setEditando(null)
            }}
            alEnviar={async (cuerpo) => {
              const r = await operar(() =>
                pedir<Respuesta>(`/catalogo/cursos/${editando!.id}`, {
                  metodo: 'PATCH',
                  cuerpo,
                }),
              )
              if (r) {
                setEditando(null)
              }
            }}
          />
        </>
      )}
    </Pantalla>
  )
}

export function TarjetaCurso({
  curso,
  alEditar,
  alEliminar,
  alSeleccionar,
}: {
  curso: Curso
  alEditar?: () => void
  alEliminar?: () => void
  alSeleccionar?: () => void
}) {
  const contenido = (
    <>
      <div className="relative aspect-video overflow-hidden bg-lienzo">
        {curso.imagenUrl ? (
          <img
            src={curso.imagenUrl}
            alt={`Portada de ${curso.nombre}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-tinta-suave">
            <IconoImagen size={28} strokeWidth={1.25} />
            <span className="text-[12px]">Sin portada</span>
          </div>
        )}
        {curso.categoria && (
          <span className="absolute left-3 top-3 border border-white/70 bg-superficie/95 px-2 py-1 text-[11px] font-semibold text-tinta">
            {curso.categoria}
          </span>
        )}
      </div>

      <div className="flex min-h-[285px] flex-col p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-dato text-[11.5px] text-pizarra">{curso.codigo}</p>
            <h2 className="mt-1 text-[16px] font-bold leading-snug text-tinta">{curso.nombre}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <EstadoDeCurso estado={curso.estado} />
            {alEditar && alEliminar && (
              <MenuFila
                acciones={[
                  { etiqueta: 'Editar curso', alElegir: alEditar },
                  { etiqueta: 'Eliminar', peligrosa: true, alElegir: alEliminar },
                ]}
              />
            )}
          </div>
        </div>

        {curso.resumen && (
          <p className="mt-2 line-clamp-2 min-h-10 text-[12.5px] leading-relaxed text-tinta-media">
            {curso.resumen}
          </p>
        )}

        <div className="mt-4 space-y-2 border-t border-regla pt-3 text-[12.5px] text-tinta-media">
          <p className="flex items-center gap-2">
            <UserRound size={14} strokeWidth={1.5} className="shrink-0 text-pizarra" />
            {curso.instructor ?? (
              <span className="inline-flex items-center gap-1 text-correccion">
                <TriangleAlert size={13} /> Sin instructor
              </span>
            )}
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={14} strokeWidth={1.5} className="shrink-0 text-pizarra" />
            {curso.modalidad === 'virtual'
              ? 'Virtual'
              : [curso.sede, curso.aula, nombreModalidad[curso.modalidad]].filter(Boolean).join(' · ') ||
                nombreModalidad[curso.modalidad]}
          </p>
          <p className="flex items-center gap-2">
            <CalendarDays size={14} strokeWidth={1.5} className="shrink-0 text-pizarra" />
            {horarioLegible(curso.horarios)}
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-regla pt-3">
          <DatoTarjeta
            icono={<Clock3 size={13} />}
            etiqueta="Duración"
            valor={
              curso.duracionSemanas
                ? `${curso.duracionSemanas} ${curso.duracionSemanas === 1 ? 'semana' : 'semanas'}`
                : '—'
            }
          />
          <DatoTarjeta etiqueta="Inicio" valor={fechaLegible(curso.iniciaEn)} />
          <DatoTarjeta etiqueta="Final" valor={fechaLegible(curso.terminaEn)} />
        </dl>

        <footer className="mt-auto flex items-end justify-between gap-3 border-t border-regla pt-4">
          <p className="font-dato text-[18px] font-semibold text-tinta">
            {Number(curso.precio) === 0 ? 'Gratis' : dinero(curso.precio, curso.moneda)}
          </p>
          <p className="flex items-center gap-1.5 text-[12px] text-tinta-suave">
            <Users size={14} />
            {curso.inscritos}{curso.cupo === null ? '' : ` / ${curso.cupo}`}
          </p>
        </footer>
        {alSeleccionar && (
          <span className="mt-3 block border-t border-regla pt-3 text-center text-[13px] font-semibold text-pizarra">
            Inscribir
          </span>
        )}
      </div>
    </>
  )

  if (alSeleccionar) {
    return (
      <article className="relative min-w-0 rounded-sm border border-regla bg-superficie text-left transition-colors hover:border-pizarra">
        <button
          type="button"
          onClick={alSeleccionar}
          aria-label={`Inscribir una persona en ${curso.nombre}`}
          className="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pizarra/35"
        />
        {contenido}
      </article>
    )
  }

  return <article className="min-w-0 rounded-sm border border-regla bg-superficie">{contenido}</article>
}

function DatoTarjeta({
  icono,
  etiqueta,
  valor,
}: {
  icono?: React.ReactNode
  etiqueta: string
  valor: string
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold text-tinta-suave">{etiqueta}</dt>
      <dd className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-tinta">
        {icono}
        <span className="min-w-0 break-words">{valor}</span>
      </dd>
    </div>
  )
}

function calcularFechaFinal(inicio: string, semanas: number): string | null {
  if (!inicio || !Number.isInteger(semanas) || semanas < 1) return null
  const fecha = new Date(`${inicio}T00:00:00.000Z`)
  fecha.setUTCDate(fecha.getUTCDate() + semanas * 7 - 1)
  return fecha.toISOString().slice(0, 10)
}

function calcularHorasDeCurso(horarios: Horario[], semanas: number): string | null {
  if (horarios.length === 0 || !Number.isInteger(semanas) || semanas < 1) return null
  const minutos = horarios.reduce((total, horario) => {
    const [horaInicio, minutoInicio] = horario.horaInicio.split(':').map(Number)
    const [horaFin, minutoFin] = horario.horaFin.split(':').map(Number)
    return total + horaFin * 60 + minutoFin - (horaInicio * 60 + minutoInicio)
  }, 0)
  const horas = (minutos * semanas) / 60
  return Number.isInteger(horas) ? String(horas) : horas.toFixed(1)
}

// ---------------------------------------------------------------------------
// El formulario
// ---------------------------------------------------------------------------

type Formulario = {
  codigo: string
  nombre: string
  resumen: string
  descripcion: string
  categoriaId: string
  instructorMembresiaId: string
  modalidad: string
  nivel: string
  sedeId: string
  aula: string
  imagenUrl: string
  precio: string
  moneda: string
  duracionSemanas: string
  iniciaEn: string
  cupo: string
  certificado: boolean
}

const VACIO: Formulario = {
  codigo: '',
  nombre: '',
  resumen: '',
  descripcion: '',
  categoriaId: '',
  instructorMembresiaId: '',
  modalidad: 'presencial',
  nivel: '',
  sedeId: '',
  aula: '',
  imagenUrl: '',
  precio: '',
  moneda: 'DOP',
  duracionSemanas: '',
  iniciaEn: '',
  cupo: '',
  certificado: true,
}

export function FormularioCurso({
  abierto,
  enPagina = false,
  curso,
  categorias,
  sedes,
  instructores,
  guardando,
  alCerrar,
  alEnviar,
}: {
  abierto: boolean
  enPagina?: boolean
  curso: Curso | null
  categorias: Categoria[]
  sedes: Sede[]
  instructores: Instructor[]
  guardando: boolean
  alCerrar: () => void
  alEnviar: (cuerpo: Record<string, unknown>) => Promise<void>
}) {
  const [f, setF] = useState<Formulario>(VACIO)
  const [horarios, setHorarios] = useState<Horario[]>([])

  useEffect(() => {
    if (!abierto && !enPagina) return
    if (!curso) {
      setF(VACIO)
      setHorarios([])
      return
    }
    setF({
      codigo: curso.codigo,
      nombre: curso.nombre,
      resumen: curso.resumen ?? '',
      descripcion: curso.descripcion ?? '',
      categoriaId: curso.categoriaId ?? '',
      instructorMembresiaId: curso.instructorMembresiaId ?? '',
      modalidad: curso.modalidad,
      nivel: curso.nivel ?? '',
      sedeId: curso.sedeId ?? '',
      aula: curso.aula ?? '',
      imagenUrl: curso.imagenUrl ?? '',
      precio: curso.precio,
      moneda: curso.moneda,
      duracionSemanas: curso.duracionSemanas ? String(curso.duracionSemanas) : '',
      iniciaEn: curso.iniciaEn ?? '',
      cupo: curso.cupo ? String(curso.cupo) : '',
      certificado: curso.certificado,
    })
    setHorarios(curso.horarios)
  }, [abierto, curso, enPagina])

  const set = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) =>
    setF((previo) => ({ ...previo, [clave]: valor }))

  const esVirtual = f.modalidad === 'virtual'
  const listo =
    f.codigo.trim() !== '' &&
    f.nombre.trim() !== '' &&
    f.precio.trim() !== '' &&
    f.iniciaEn !== '' &&
    Number(f.duracionSemanas) > 0
  const fechaFinalCalculada = calcularFechaFinal(f.iniciaEn, Number(f.duracionSemanas))
  const horasCalculadas = calcularHorasDeCurso(horarios, Number(f.duracionSemanas))

  /*
    Los campos vacíos viajan como cadena vacía y el backend los convierte en
    null; los numéricos, en cambio, tienen que salir como número o no ir. Mandar
    "" donde se espera un número es el error más fácil de cometer aquí, y el
    validador lo rechazaría con un mensaje sobre un campo que la persona dejó en
    blanco a propósito.
  */
  function cuerpo(): Record<string, unknown> {
    const numero = (v: string) => (v.trim() === '' ? null : Number(v))
    return {
      codigo: f.codigo.trim(),
      nombre: f.nombre.trim(),
      resumen: f.resumen.trim(),
      descripcion: f.descripcion.trim(),
      categoriaId: f.categoriaId || null,
      instructorMembresiaId: f.instructorMembresiaId || null,
      modalidad: f.modalidad,
      nivel: f.nivel || null,
      sedeId: esVirtual ? null : f.sedeId || null,
      aula: esVirtual ? '' : f.aula.trim(),
      imagenUrl: f.imagenUrl.trim(),
      precio: Number(f.precio) || 0,
      moneda: f.moneda,
      duracionSemanas: Number(f.duracionSemanas),
      iniciaEn: f.iniciaEn,
      cupo: numero(f.cupo),
      certificado: f.certificado,
      horarios,
    }
  }

  const campos = (
    <div className="flex flex-col gap-6">
        <Seccion titulo="Identidad">
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <Campo
              etiqueta="Código"
              value={f.codigo}
              onChange={(e) => set('codigo', e.target.value)}
              placeholder="ING-101"
              autoFocus
            />
            <Campo
              etiqueta="Nombre"
              value={f.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              placeholder="Inglés Básico"
            />
          </div>
          <Campo
            etiqueta="Resumen"
            value={f.resumen}
            onChange={(e) => set('resumen', e.target.value)}
            placeholder="Conversación desde cero, sin gramática memorizada"
            ayuda="Una línea. Es lo que se lee en la tarjeta del catálogo."
          />
          <AreaTexto
            etiqueta="Descripción"
            rows={4}
            value={f.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
            placeholder="Qué se aprende, cómo se evalúa, a quién va dirigido."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Selector
              etiqueta="Categoría"
              vacio="Sin categoría"
              value={f.categoriaId}
              onChange={(e) => set('categoriaId', e.target.value)}
              opciones={categorias
                .filter((c) => c.activa || c.id === f.categoriaId)
                .map((c) => ({ valor: c.id, texto: c.nombre }))}
            />
            <Selector
              etiqueta="Nivel"
              vacio="Sin nivel"
              value={f.nivel}
              onChange={(e) => set('nivel', e.target.value)}
              opciones={Object.entries(nombreNivel).map(([valor, texto]) => ({
                valor,
                texto,
              }))}
            />
          </div>
          <SelectorPortada valor={f.imagenUrl} alCambiar={(valor) => set('imagenUrl', valor)} />
        </Seccion>

        <Seccion titulo="Quién lo imparte y dónde">
          <Selector
            etiqueta="Instructor"
            vacio={
              instructores.length === 0
                ? 'Nadie tiene el rol de instructor todavía'
                : 'Sin asignar'
            }
            value={f.instructorMembresiaId}
            onChange={(e) => set('instructorMembresiaId', e.target.value)}
            opciones={instructores.map((i) => ({
              valor: i.membresiaId,
              texto: `${i.nombre}${i.cursos > 0 ? ` · ${i.cursos} curso(s)` : ''}`,
            }))}
            ayuda="Solo aparecen las personas con rol de instructor."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Selector
              etiqueta="Modalidad"
              value={f.modalidad}
              onChange={(e) => set('modalidad', e.target.value)}
              opciones={Object.entries(nombreModalidad).map(([valor, texto]) => ({
                valor,
                texto,
              }))}
            />
            {!esVirtual && (
              <Selector
                etiqueta="Sede"
                vacio="Sin sede"
                value={f.sedeId}
                onChange={(e) => set('sedeId', e.target.value)}
                opciones={sedes.map((s) => ({ valor: s.id, texto: s.nombre }))}
              />
            )}
          </div>

          {!esVirtual && (
            <Campo
              etiqueta="Aula"
              value={f.aula}
              onChange={(e) => set('aula', e.target.value)}
              placeholder="Aula 3"
            />
          )}
        </Seccion>

        <Seccion titulo="Horario">
          <EditorHorario horarios={horarios} alCambiar={setHorarios} />
        </Seccion>

        <Seccion titulo="Duración y cupo">
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo
              etiqueta="Fecha de inicio"
              type="date"
              value={f.iniciaEn}
              onChange={(e) => set('iniciaEn', e.target.value)}
            />
            <Campo
              etiqueta="Duración en semanas"
              type="number"
              min={1}
              value={f.duracionSemanas}
              onChange={(e) => set('duracionSemanas', e.target.value)}
              placeholder="8"
            />
            <Campo
              etiqueta="Cupo"
              type="number"
              min={1}
              value={f.cupo}
              onChange={(e) => set('cupo', e.target.value)}
              placeholder="Sin límite"
              ayuda="Vacío es sin límite."
            />
          </div>
          {fechaFinalCalculada && (
            <p className="border-l-2 border-pizarra bg-pizarra-tenue px-3 py-2 text-[12.5px] text-tinta-media">
              Finaliza automáticamente el {fechaLegible(fechaFinalCalculada)}
              {horasCalculadas ? ` y comprende ${horasCalculadas} horas de docencia.` : '.'}
            </p>
          )}
        </Seccion>

        <Seccion titulo="Precio">
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Campo
              etiqueta="Precio"
              type="number"
              min={0}
              step="0.01"
              value={f.precio}
              onChange={(e) => set('precio', e.target.value)}
              placeholder="0.00"
              ayuda="Se copia a la inscripción: subirlo después no cambia lo ya cobrado."
            />
            <Selector
              etiqueta="Moneda"
              value={f.moneda}
              onChange={(e) => set('moneda', e.target.value)}
              opciones={[
                { valor: 'DOP', texto: 'DOP' },
                { valor: 'USD', texto: 'USD' },
                { valor: 'EUR', texto: 'EUR' },
              ]}
            />
          </div>

          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={f.certificado}
              onChange={(e) => set('certificado', e.target.checked)}
              className="h-4 w-4 accent-[var(--color-pizarra,#0055fc)]"
            />
            <span className="text-[13.5px] text-tinta">Entrega certificado</span>
          </label>
        </Seccion>
    </div>
  )

  const acciones = (
    <>
      <Boton variante="fantasma" onClick={alCerrar}>
        Cancelar
      </Boton>
      <Boton
        variante="primario"
        disabled={guardando || !listo}
        onClick={() => void alEnviar(cuerpo())}
      >
        {guardando ? 'Guardando…' : curso ? 'Guardar cambios' : 'Crear curso'}
      </Boton>
    </>
  )

  if (enPagina) {
    return (
      <Ficha className="overflow-hidden">
        <div className="px-6 py-6">{campos}</div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-regla bg-lienzo px-6 py-4">
          {acciones}
        </footer>
      </Ficha>
    )
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="lg"
      titulo={curso ? `Editar ${curso.codigo}` : 'Crear curso'}
      descripcion="Todo lo que hace falta para anunciarlo, cotizarlo y llenarlo."
      pie={acciones}
    >
      {campos}
    </Dialogo>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="etiqueta-dato border-b border-regla pb-2 text-tinta-suave">{titulo}</h3>
      {children}
    </section>
  )
}

const TIPOS_PORTADA = ['image/jpeg', 'image/png', 'image/webp']
const MAXIMO_ARCHIVO = 8 * 1024 * 1024
const MAXIMO_DATO = 1_400_000

function SelectorPortada({
  valor,
  alCambiar,
}: {
  valor: string
  alCambiar: (valor: string) => void
}) {
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function seleccionar(archivo: File | undefined) {
    if (!archivo) return
    setError(null)
    setProcesando(true)
    try {
      alCambiar(await prepararPortada(archivo))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar esa imagen.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="etiqueta-dato text-[11.5px] font-semibold text-tinta">
        Imagen de portada
      </span>
      <div className="grid gap-3 sm:grid-cols-[minmax(220px,360px)_1fr] sm:items-center">
        <div className="relative aspect-video overflow-hidden rounded-sm border border-regla-fuerte bg-lienzo">
          {valor ? (
            <img src={valor} alt="Vista previa de la portada" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-tinta-suave">
              <IconoImagen size={24} strokeWidth={1.25} />
              <span className="text-[12px]">Sin portada</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-start gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-sm border border-regla-fuerte bg-superficie px-4 text-sm font-medium text-tinta hover:bg-lienzo">
            <Upload size={15} strokeWidth={1.5} />
            {procesando ? 'Preparando imagen…' : valor ? 'Cambiar imagen' : 'Seleccionar imagen'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={procesando}
              className="sr-only"
              onChange={(e) => {
                void seleccionar(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          {valor && (
            <button
              type="button"
              title="Quitar imagen"
              aria-label="Quitar imagen"
              onClick={() => alCambiar('')}
              className="flex h-9 w-9 items-center justify-center rounded-sm text-tinta-suave hover:bg-correccion-tenue hover:text-correccion"
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          )}
          <p className="text-[12px] leading-relaxed text-tinta-suave">
            JPEG, PNG o WebP. Se ajustará automáticamente a formato 16:9.
          </p>
        </div>
      </div>
      {error && <p className="text-[12px] text-correccion" role="alert">{error}</p>}
    </div>
  )
}

async function prepararPortada(archivo: File): Promise<string> {
  if (!TIPOS_PORTADA.includes(archivo.type)) {
    throw new Error('Selecciona una imagen JPEG, PNG o WebP.')
  }
  if (archivo.size > MAXIMO_ARCHIVO) {
    throw new Error('La imagen original no puede superar 8 MB.')
  }

  const temporal = URL.createObjectURL(archivo)
  try {
    const imagen = await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const elemento = new Image()
      elemento.onload = () => resolver(elemento)
      elemento.onerror = () => rechazar(new Error('El archivo no contiene una imagen válida.'))
      elemento.src = temporal
    })

    const ancho = Math.min(1200, imagen.naturalWidth)
    const alto = Math.max(1, Math.round(ancho * 9 / 16))
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const contexto = lienzo.getContext('2d')
    if (!contexto) throw new Error('El navegador no pudo preparar la imagen.')

    contexto.fillStyle = '#f4f7fc'
    contexto.fillRect(0, 0, ancho, alto)
    const escala = Math.min(ancho / imagen.naturalWidth, alto / imagen.naturalHeight)
    const destinoAncho = imagen.naturalWidth * escala
    const destinoAlto = imagen.naturalHeight * escala
    contexto.drawImage(
      imagen,
      (ancho - destinoAncho) / 2,
      (alto - destinoAlto) / 2,
      destinoAncho,
      destinoAlto,
    )

    const dato = lienzo.toDataURL('image/webp', 0.8)
    if (dato.length > MAXIMO_DATO) {
      throw new Error('La imagen sigue siendo demasiado pesada después de optimizarla.')
    }
    return dato
  } finally {
    URL.revokeObjectURL(temporal)
  }
}

/*
  Un bloque por fila: día, hora de inicio y hora de fin.

  Se edita como lista y no como una rejilla semanal porque un curso tiene dos o
  tres bloques, casi siempre a la misma hora, y una rejilla de siete columnas por
  veinticuatro filas para poner "martes y jueves de 6 a 8" es desproporcionada.
*/
function EditorHorario({
  horarios,
  alCambiar,
}: {
  horarios: Horario[]
  alCambiar: (h: Horario[]) => void
}) {
  function cambiar(indice: number, parche: Partial<Horario>) {
    alCambiar(horarios.map((h, i) => (i === indice ? { ...h, ...parche } : h)))
  }

  return (
    <div className="flex flex-col gap-2.5">
      {horarios.length === 0 && (
        <p className="text-[13px] text-tinta-suave">
          Sin bloques todavía. Un curso puede guardarse sin horario, pero entonces nadie sabe
          cuándo es.
        </p>
      )}

      {horarios.map((bloque, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <select
            value={bloque.diaSemana}
            onChange={(e) => cambiar(i, { diaSemana: Number(e.target.value) })}
            aria-label="Día"
            className="h-10 w-32 rounded-sm border border-regla-fuerte bg-superficie px-2 text-[13px] text-tinta focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15"
          >
            {DIAS_SEMANA.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.largo}
              </option>
            ))}
          </select>

          <input
            type="time"
            value={bloque.horaInicio}
            onChange={(e) => cambiar(i, { horaInicio: e.target.value })}
            aria-label="Hora de inicio"
            className="h-10 rounded-sm border border-regla-fuerte bg-superficie px-2 text-[13px] text-tinta focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15"
          />
          <span className="pb-2.5 text-tinta-suave">–</span>
          <input
            type="time"
            value={bloque.horaFin}
            onChange={(e) => cambiar(i, { horaFin: e.target.value })}
            aria-label="Hora de fin"
            className="h-10 rounded-sm border border-regla-fuerte bg-superficie px-2 text-[13px] text-tinta focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15"
          />

          <button
            type="button"
            onClick={() => alCambiar(horarios.filter((_, j) => j !== i))}
            aria-label="Quitar bloque"
            className="mb-0.5 flex h-9 w-9 items-center justify-center rounded-sm text-tinta-suave hover:bg-lienzo hover:text-correccion"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
      ))}

      <div>
        <Boton
          variante="secundario"
          tamano="sm"
          iconoIzq={<Plus size={14} strokeWidth={1.75} />}
          onClick={() =>
            alCambiar([
              ...horarios,
              // El bloque nuevo hereda la hora del anterior: en un curso de tres
              // días a la misma hora, es lo que evita escribirla tres veces.
              {
                diaSemana: siguienteDia(horarios),
                horaInicio: horarios.at(-1)?.horaInicio ?? '18:00',
                horaFin: horarios.at(-1)?.horaFin ?? '20:00',
              },
            ])
          }
        >
          Añadir bloque
        </Boton>
      </div>

      {horarios.length > 0 && (
        <Etiqueta tono="info">{horarioLegible(horarios)}</Etiqueta>
      )}
    </div>
  )
}

/* El primer día de la semana que todavía no está ocupado. */
function siguienteDia(horarios: Horario[]): number {
  const usados = new Set(horarios.map((h) => h.diaSemana))
  return DIAS_SEMANA.find((d) => !usados.has(d.valor))?.valor ?? 1
}
