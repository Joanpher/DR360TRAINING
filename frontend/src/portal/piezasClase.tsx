import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarClock,
  CircleDot,
  ClipboardList,
  Clock3,
  Radio,
  UserRound,
  Users,
  Video,
  X,
} from 'lucide-react'
import { useConsulta, useGuardar } from '../datos/consulta'
import { AreaTexto } from '../ui/AreaTexto'
import { Boton } from '../ui/Boton'
import { cn } from '../ui/cn'
import { Campo } from '../ui/Campo'
import { Dialogo } from '../ui/Dialogo'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Etiqueta } from '../ui/Etiqueta'
import { Ficha, FichaCabecera } from '../ui/Ficha'
import { Selector } from '../ui/Selector'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../ui/Tabla'
import {
  cancelarReunion,
  crearReunion,
  duracionLegible,
  finalizarReunion,
  horaReunion,
  iniciarReunion,
  cuandoEmpieza,
  nombreEstadoReunion,
  paraCampoFecha,
  soloHora,
  type NuevaReunion,
  type RespuestaAsistencia,
  type Reunion,
} from './reuniones'

/*
  Las piezas que comparten la agenda de clases y la pestana de un curso. Son las
  mismas dos cosas en los dos sitios -una tarjeta de clase y el formulario de
  convocarla- y duplicarlas garantizaba que un dia dejaran de comportarse igual.
*/

export function TarjetaReunion({
  reunion,
  alCambiar,
  mostrarCurso = false,
}: {
  reunion: Reunion
  alCambiar: (reunion: Reunion) => void
  mostrarCurso?: boolean
}) {
  const navegar = useNavigate()
  const guardado = useGuardar()
  const [asistenciaAbierta, setAsistenciaAbierta] = useState(false)
  const [cancelando, setCancelando] = useState(false)

  const enVivo = reunion.estado === 'en_curso'
  const terminada = reunion.estado === 'finalizada'
  const cancelada = reunion.estado === 'cancelada'

  async function accion(operacion: () => Promise<{ reunion: Reunion }>, entrar = false) {
    const resultado = await guardado.guardar(operacion)
    if (!resultado) return
    alCambiar(resultado.reunion)
    if (entrar) navegar(`/clases/${resultado.reunion.id}`)
  }

  return (
    <>
      <article
        className={cn(
          'rounded-md border bg-superficie transition-colors',
          enVivo ? 'border-correccion/45' : 'border-regla',
          cancelada && 'opacity-60',
        )}
      >
        <div className="flex flex-wrap items-start gap-4 p-4 sm:p-5">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border',
              enVivo
                ? 'border-correccion/40 bg-correccion-tenue text-correccion'
                : 'border-regla-fuerte bg-lienzo text-tinta-suave',
            )}
          >
            {enVivo ? <Radio size={18} strokeWidth={1.6} /> : <Video size={18} strokeWidth={1.5} />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-[15px] font-semibold leading-snug text-tinta">
                {reunion.titulo}
              </h3>
              {enVivo ? (
                <Etiqueta tono="correccion" icono={<CircleDot size={11} className="animate-pulse" />}>
                  En vivo
                </Etiqueta>
              ) : (
                <Etiqueta tono={reunion.estado === 'programada' ? 'aviso' : 'neutro'}>
                  {nombreEstadoReunion[reunion.estado]}
                </Etiqueta>
              )}
            </div>

            {mostrarCurso && (
              <p className="mt-1 flex flex-wrap items-baseline gap-2 text-[12.5px] text-tinta-media">
                <span className="font-dato text-[11.5px] text-pizarra">{reunion.cursoCodigo}</span>
                {reunion.cursoNombre}
              </p>
            )}

            {reunion.descripcion && (
              <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-tinta-media">
                {reunion.descripcion}
              </p>
            )}

            <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-tinta-media">
              <dd className="flex items-center gap-1.5">
                <CalendarClock size={14} className="text-tinta-suave" />
                {enVivo
                  ? `Empezó a las ${soloHora(reunion.iniciadaEn)}`
                  : terminada
                    ? `${soloHora(reunion.iniciadaEn)} – ${soloHora(reunion.finalizadaEn)}`
                    : horaReunion(reunion.programadaPara)}
              </dd>
              <dd className="flex items-center gap-1.5">
                <Clock3 size={14} className="text-tinta-suave" />
                {duracionLegible(reunion.duracionMinutos)}
              </dd>
              <dd className="flex items-center gap-1.5">
                <UserRound size={14} className="text-tinta-suave" />
                {reunion.anfitrion}
              </dd>
              {(enVivo || terminada) && (
                <dd className="flex items-center gap-1.5">
                  <Users size={14} className="text-tinta-suave" />
                  {enVivo
                    ? `${reunion.presentes} en la sala`
                    : `${reunion.participantes} asistieron`}
                </dd>
              )}
            </dl>

            {cancelada && reunion.motivoCancelacion && (
              <p className="mt-2 text-[12px] text-correccion">
                Cancelada: {reunion.motivoCancelacion}
              </p>
            )}

            {!enVivo && reunion.estado === 'programada' && reunion.programadaPara && (
              <p className="mt-2 text-[12px] text-tinta-suave">
                Empieza {cuandoEmpieza(reunion.programadaPara)}
                {reunion.abrirSinAnfitrion
                  ? ' · la sala se abre sola'
                  : ' · la sala se abre cuando el instructor inicie'}
              </p>
            )}

            {guardado.error && (
              <p className="mt-2 border border-correccion/30 bg-correccion-tenue px-3 py-2 text-[12px] text-correccion">
                {guardado.error}
              </p>
            )}
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {reunion.salaAbierta && (
              <Boton
                variante="primario"
                tamano="sm"
                iconoIzq={<Video size={15} />}
                onClick={() => navegar(`/clases/${reunion.id}`)}
              >
                Entrar
              </Boton>
            )}

            {reunion.puedeGestionar && reunion.estado === 'programada' && (
              <Boton
                variante={reunion.salaAbierta ? 'secundario' : 'primario'}
                tamano="sm"
                iconoIzq={<Radio size={15} />}
                disabled={guardado.guardando}
                onClick={() => void accion(() => iniciarReunion(reunion.id), true)}
              >
                Iniciar clase
              </Boton>
            )}

            {reunion.puedeGestionar && enVivo && (
              <Boton
                variante="peligro"
                tamano="sm"
                disabled={guardado.guardando}
                onClick={() => void accion(() => finalizarReunion(reunion.id))}
              >
                Terminar
              </Boton>
            )}

            {reunion.puedeGestionar && reunion.estado === 'programada' && (
              <button
                title="Cancelar la clase"
                aria-label="Cancelar la clase"
                disabled={guardado.guardando}
                onClick={() => setCancelando(true)}
                className="flex h-8 w-8 items-center justify-center rounded-sm text-tinta-suave hover:bg-correccion-tenue hover:text-correccion"
              >
                <X size={16} />
              </button>
            )}

            {reunion.puedeGestionar && (terminada || enVivo) && (
              <Boton
                tamano="sm"
                variante="fantasma"
                iconoIzq={<ClipboardList size={15} />}
                onClick={() => setAsistenciaAbierta(true)}
              >
                Asistencia
              </Boton>
            )}

            {!reunion.puedeGestionar && terminada && reunion.miAsistencia && (
              <span className="text-[12px] text-tinta-suave">
                Asististe {duracionLegible(reunion.miAsistencia.minutos)}
              </span>
            )}
          </div>
        </div>
      </article>

      {asistenciaAbierta && (
        <DialogoAsistencia reunion={reunion} alCerrar={() => setAsistenciaAbierta(false)} />
      )}

      {cancelando && (
        <DialogoCancelar
          reunion={reunion}
          alCerrar={() => setCancelando(false)}
          alCancelar={(motivo) => {
            setCancelando(false)
            void accion(() => cancelarReunion(reunion.id, motivo))
          }}
        />
      )}
    </>
  )
}

/*
  Cancelar pide un motivo porque lo va a leer alguien que tenia esa clase en su
  agenda. "Cancelada" a secas obliga a preguntar por otro canal, que es justo lo
  que esta pantalla existe para evitar.
*/
function DialogoCancelar({
  reunion,
  alCerrar,
  alCancelar,
}: {
  reunion: Reunion
  alCerrar: () => void
  alCancelar: (motivo?: string) => void
}) {
  const [motivo, setMotivo] = useState('')

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      titulo="Cancelar la clase"
      descripcion={reunion.titulo}
      ancho="sm"
    >
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed text-tinta-media">
          La sesión desaparece de la agenda del grupo. La sala no llega a abrirse
          y no se puede reabrir: si hace falta, se convoca otra.
        </p>
        <AreaTexto
          etiqueta="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Se pospone para el jueves a la misma hora."
          maxLength={500}
          ayuda="Opcional, pero lo verá quien esperaba la clase."
        />
        <div className="flex justify-end gap-2 border-t border-regla pt-4">
          <Boton tamano="sm" variante="fantasma" onClick={alCerrar}>
            Volver
          </Boton>
          <Boton
            tamano="sm"
            variante="peligro"
            onClick={() => alCancelar(motivo.trim() || undefined)}
          >
            Cancelar la clase
          </Boton>
        </div>
      </div>
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------

/*
  Convocar una clase. Dos caminos y no uno: "ahora" abre la sala en el acto -que
  es lo que se hace cuando la clase ya empezo y alguien pregunta por el enlace-
  y "programar" la deja en la agenda con su hora.
*/
export function DialogoNuevaReunion({
  abierto,
  alCerrar,
  cursoId,
  cursoNombre,
  cursos,
  alCrear,
}: {
  abierto: boolean
  alCerrar: () => void
  /* Fijo cuando se convoca desde un curso; ausente en la agenda general. */
  cursoId?: string
  cursoNombre?: string
  cursos?: { id: string; codigo: string; nombre: string }[]
  alCrear: (reunion: Reunion) => void
}) {
  const guardado = useGuardar()
  const [curso, setCurso] = useState(cursoId ?? cursos?.[0]?.id ?? '')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [cuando, setCuando] = useState<'ahora' | 'programar'>('ahora')
  const [fecha, setFecha] = useState(() =>
    paraCampoFecha(new Date(Date.now() + 3600_000)),
  )
  const [duracion, setDuracion] = useState('60')
  const [abrirSinAnfitrion, setAbrirSinAnfitrion] = useState(false)
  const [silenciar, setSilenciar] = useState(true)
  const [camaraApagada, setCamaraApagada] = useState(false)
  const [grabacion, setGrabacion] = useState(false)

  const destino = cursoId ?? curso

  async function guardar() {
    if (!destino) return
    const cuerpo: NuevaReunion = {
      titulo: titulo.trim() || undefined,
      descripcion: descripcion.trim() || undefined,
      duracionMinutos: Number(duracion),
      abrirSinAnfitrion,
      silenciarAlEntrar: silenciar,
      camaraApagadaAlEntrar: camaraApagada,
      permiteGrabacion: grabacion,
      ...(cuando === 'ahora'
        ? { iniciarAhora: true }
        : { programadaPara: new Date(fecha).toISOString() }),
    }
    const resultado = await guardado.guardar(() => crearReunion(destino, cuerpo))
    if (resultado) {
      alCrear(resultado.reunion)
      alCerrar()
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Convocar clase en vivo"
      descripcion={cursoNombre ?? 'Elige el curso y cuándo se imparte.'}
      ancho="md"
    >
      <div className="space-y-4">
        {!cursoId && cursos && (
          <Selector
            etiqueta="Curso"
            value={curso}
            onChange={(e) => setCurso(e.target.value)}
            opciones={cursos.map((c) => ({
              valor: c.id,
              texto: `${c.codigo} · ${c.nombre}`,
            }))}
            vacio={cursos.length === 0 ? 'No tienes cursos asignados' : undefined}
          />
        )}

        <Campo
          etiqueta="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Clase en vivo"
          ayuda="Si lo dejas vacío toma el nombre del curso."
          maxLength={160}
        />

        <AreaTexto
          etiqueta="Descripción"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Qué se va a ver en esta sesión. Opcional."
          maxLength={2000}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Selector
            etiqueta="Cuándo"
            value={cuando}
            onChange={(e) => setCuando(e.target.value as 'ahora' | 'programar')}
            opciones={[
              { valor: 'ahora', texto: 'Empezar ahora' },
              { valor: 'programar', texto: 'Programar' },
            ]}
          />
          <Selector
            etiqueta="Duración"
            value={duracion}
            onChange={(e) => setDuracion(e.target.value)}
            opciones={['30', '45', '60', '90', '120', '180'].map((m) => ({
              valor: m,
              texto: duracionLegible(Number(m)),
            }))}
          />
        </div>

        {cuando === 'programar' && (
          <Campo
            etiqueta="Fecha y hora"
            type="datetime-local"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        )}

        <fieldset className="space-y-2.5 border-t border-regla pt-4">
          <legend className="etiqueta-dato mb-1 text-tinta-suave">La sala</legend>

          {cuando === 'programar' && (
            <Casilla
              marcada={abrirSinAnfitrion}
              alCambiar={setAbrirSinAnfitrion}
              titulo="Abrir sin instructor"
              texto="El alumnado puede entrar 15 minutos antes de la hora, sin esperar a que inicies."
            />
          )}
          <Casilla
            marcada={silenciar}
            alCambiar={setSilenciar}
            titulo="Entrar con micrófono apagado"
            texto="Solo para quien no modera. Puede encenderlo cuando quiera."
          />
          <Casilla
            marcada={camaraApagada}
            alCambiar={setCamaraApagada}
            titulo="Entrar con cámara apagada"
            texto="Útil en grupos grandes o con conexiones lentas."
          />
          <Casilla
            marcada={grabacion}
            alCambiar={setGrabacion}
            titulo="Permitir grabar"
            texto="Habilita el botón de grabación para quien modera. Requiere que el servidor de Jitsi tenga grabación configurada."
          />
        </fieldset>

        {guardado.error && (
          <p className="border border-correccion/30 bg-correccion-tenue px-3 py-2 text-[12px] text-correccion">
            {guardado.error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-regla pt-4">
          <Boton tamano="sm" variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            tamano="sm"
            variante="primario"
            disabled={guardado.guardando || !destino}
            onClick={() => void guardar()}
          >
            {guardado.guardando
              ? 'Convocando…'
              : cuando === 'ahora'
                ? 'Empezar clase'
                : 'Programar clase'}
          </Boton>
        </div>
      </div>
    </Dialogo>
  )
}

function Casilla({
  marcada,
  alCambiar,
  titulo,
  texto,
}: {
  marcada: boolean
  alCambiar: (valor: boolean) => void
  titulo: string
  texto: string
}) {
  return (
    <label className="flex items-start gap-2.5">
      <input
        type="checkbox"
        checked={marcada}
        onChange={(e) => alCambiar(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--color-pizarra,#0055fc)]"
      />
      <span className="text-[13px] leading-relaxed text-tinta-media">
        <span className="font-medium text-tinta">{titulo}</span> · {texto}
      </span>
    </label>
  )
}

// ---------------------------------------------------------------------------

/*
  La hoja de asistencia. Los minutos no son "estuvo o no estuvo": una clase de
  hora y media a la que alguien entra los ultimos diez minutos no es asistencia,
  y un si/no lo contaria igual que la del que estuvo entera.
*/
function DialogoAsistencia({
  reunion,
  alCerrar,
}: {
  reunion: Reunion
  alCerrar: () => void
}) {
  const { datos, cargando, error } = useConsulta<RespuestaAsistencia>(
    `/reuniones/${reunion.id}/asistencia`,
  )

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      titulo="Asistencia"
      descripcion={reunion.titulo}
      ancho="lg"
    >
      {cargando ? (
        <div className="h-40 animate-pulse rounded-sm bg-lienzo" />
      ) : error ? (
        <p className="border border-correccion/30 bg-correccion-tenue px-3 py-2 text-[12.5px] text-correccion">
          {error}
        </p>
      ) : !datos || datos.asistentes.length === 0 ? (
        <EstadoVacio
          icono={Users}
          titulo="Nadie ha entrado todavía"
          texto="La lista se llena sola conforme el grupo se une a la sala."
        />
      ) : (
        <Tabla>
          <Encabezado>
            <Th>Persona</Th>
            <Th className="w-36">Matrícula</Th>
            <Th className="w-28">Entró</Th>
            <Th className="w-28">Tiempo</Th>
            <Th className="w-24">Estado</Th>
          </Encabezado>
          <tbody>
            {datos.asistentes.map((a) => (
              <Fila key={a.id}>
                <Td className="font-medium text-tinta">
                  {a.nombre}
                  {a.esAnfitrion && (
                    <span className="ml-2 text-[11px] font-normal text-tinta-suave">
                      instructor
                    </span>
                  )}
                </Td>
                <TdDato>{a.matricula ?? '—'}</TdDato>
                <TdDato>{soloHora(a.primeraEntradaEn)}</TdDato>
                <TdDato>{duracionLegible(a.minutos)}</TdDato>
                <Td>
                  <Etiqueta tono={a.dentro ? 'aprobado' : 'neutro'}>
                    {a.dentro ? 'En la sala' : 'Salió'}
                  </Etiqueta>
                </Td>
              </Fila>
            ))}
          </tbody>
        </Tabla>
      )}
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------

export function ListaReuniones({
  reuniones,
  alCambiar,
  mostrarCurso = false,
  titulo,
  descripcion,
  accion,
  vacio,
}: {
  reuniones: Reunion[]
  alCambiar: (reunion: Reunion) => void
  mostrarCurso?: boolean
  titulo: string
  descripcion?: string
  accion?: ReactNode
  vacio: { titulo: string; texto: string }
}) {
  if (reuniones.length === 0) {
    return (
      <Ficha>
        <FichaCabecera titulo={titulo} descripcion={descripcion} accion={accion} />
        <EstadoVacio icono={Video} titulo={vacio.titulo} texto={vacio.texto} />
      </Ficha>
    )
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[15px] font-semibold tracking-tight text-tinta">
            {titulo}
          </h2>
          {descripcion && <p className="mt-0.5 text-[13px] text-tinta-media">{descripcion}</p>}
        </div>
        {accion}
      </header>
      <div className="space-y-3">
        {reuniones.map((reunion) => (
          <TarjetaReunion
            key={reunion.id}
            reunion={reunion}
            alCambiar={alCambiar}
            mostrarCurso={mostrarCurso}
          />
        ))}
      </div>
    </section>
  )
}
