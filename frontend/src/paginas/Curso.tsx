import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ChevronRight,
  Download,
  FileText,
  Link2,
  Lock,
  MessagesSquare,
  MonitorPlay,
  Play,
  Upload,
  Users,
  Video,
} from 'lucide-react'
import { Boton } from '../ui/Boton'
import { Etiqueta } from '../ui/Etiqueta'
import { Ficha, FichaCabecera } from '../ui/Ficha'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../ui/Tabla'
import {
  categorias,
  cursos,
  escala,
  institucion,
  sesiones,
  tareas,
  unidades,
} from '../datos/demo'
import { cn } from '../ui/cn'

const pestanas = [
  'Contenido',
  'Tareas',
  'Calificaciones',
  'Clases',
  'Foro',
  'Personas',
] as const
type Pestana = (typeof pestanas)[number]

const iconoMaterial = {
  documento: FileText,
  video: MonitorPlay,
  enlace: Link2,
} as const

export function Curso() {
  const { codigo } = useParams()
  const curso = cursos.find((c) => c.codigo === codigo) ?? cursos[2]
  const [pestana, setPestana] = useState<Pestana>('Contenido')

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-1.5 text-[13px] text-tinta-media">
          <Link to="/cursos" className="hover:text-pizarra">
            Cursos
          </Link>
          <ChevronRight size={13} strokeWidth={1.5} className="text-tinta-suave" />
          <span className="font-dato text-[12px] text-tinta">{curso.codigo}</span>
        </nav>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-tinta">
              {curso.asignatura}
            </h1>
            <p className="etiqueta-dato mt-2 text-tinta-suave">
              {curso.docente} · Sección A · {curso.creditos} créditos · Periodo{' '}
              {institucion.periodo}
            </p>
          </div>
          <div className="flex gap-2">
            <Boton variante="secundario">Programa</Boton>
            <Boton
              variante="primario"
              iconoIzq={<Video size={15} strokeWidth={1.5} />}
            >
              Entrar a la clase
            </Boton>
          </div>
        </div>
      </div>

      <div className="flex gap-0.5 border-b border-regla">
        {pestanas.map((p) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            className={cn(
              'relative px-3 py-2.5 text-[13.5px] font-medium transition-colors',
              'after:absolute after:inset-x-2 after:-bottom-px after:h-[2px]',
              p === pestana
                ? 'text-tinta after:bg-pizarra'
                : 'text-tinta-media after:bg-transparent hover:text-tinta hover:after:bg-regla-fuerte',
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {pestana === 'Contenido' && <Contenido />}
      {pestana === 'Tareas' && <Tareas />}
      {pestana === 'Calificaciones' && <Calificaciones />}
      {pestana === 'Clases' && <Clases />}
      {pestana === 'Foro' && (
        <Ficha>
          <EstadoVacio
            icono={MessagesSquare}
            titulo="Todavía no hay hilos en este foro"
            texto="Abre el primer tema para que la clase pueda responder fuera del horario de clase."
            accion={<Boton variante="primario">Abrir un tema</Boton>}
          />
        </Ficha>
      )}
      {pestana === 'Personas' && (
        <Ficha>
          <EstadoVacio
            icono={Users}
            titulo="Lista del curso"
            texto="Aquí aparecerán los 32 estudiantes inscritos y el equipo docente cuando conectemos el módulo de inscripciones."
          />
        </Ficha>
      )}
    </div>
  )
}

function Contenido() {
  return (
    <div className="space-y-4">
      {unidades.map((unidad) => (
        <Ficha key={unidad.titulo}>
          <FichaCabecera
            titulo={unidad.titulo}
            accion={
              <Etiqueta
                tono={
                  unidad.estado === 'En curso'
                    ? 'aprobado'
                    : unidad.estado === 'Bloqueada'
                      ? 'neutro'
                      : 'info'
                }
              >
                {unidad.estado}
              </Etiqueta>
            }
          />
          {unidad.materiales.length === 0 ? (
            <EstadoVacio
              icono={Lock}
              titulo="Unidad bloqueada"
              texto="El material se publica al cerrar la Unidad 2, el 29 de agosto."
            />
          ) : (
            <ul>
              {unidad.materiales.map((material) => {
                const Icono =
                  iconoMaterial[material.tipo as keyof typeof iconoMaterial]
                return (
                  <li
                    key={material.titulo}
                    className="flex items-center gap-3.5 border-b border-regla px-5 py-3 last:border-b-0 hover:bg-lienzo"
                  >
                    <Icono
                      size={17}
                      strokeWidth={1.5}
                      className="shrink-0 text-tinta-suave"
                    />
                    <span className="flex-1 text-[14px] text-tinta">
                      {material.titulo}
                    </span>
                    <span className="font-dato text-[12px] text-tinta-suave">
                      {material.peso}
                    </span>
                    <span className="hidden font-dato text-[12px] tabular-nums text-tinta-suave sm:block">
                      {material.fecha}
                    </span>
                    <button
                      aria-label={`Descargar ${material.titulo}`}
                      className="flex h-7 w-7 items-center justify-center rounded-xs text-tinta-suave hover:bg-regla hover:text-tinta"
                    >
                      <Download size={15} strokeWidth={1.5} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Ficha>
      ))}
    </div>
  )
}

function Tareas() {
  return (
    <Ficha>
      <FichaCabecera
        titulo="Tareas del curso"
        descripcion="4 actividades · 65 puntos en total"
        accion={
          <Boton
            variante="secundario"
            tamano="sm"
            iconoIzq={<Upload size={14} strokeWidth={1.5} />}
          >
            Entregar
          </Boton>
        }
      />
      <Tabla>
        <Encabezado>
          <Th>Tarea</Th>
          <Th className="hidden md:table-cell">Unidad</Th>
          <Th className="w-44">Fecha límite</Th>
          <Th className="w-28 text-right">Puntos</Th>
          <Th className="w-36">Estado</Th>
        </Encabezado>
        <tbody>
          {tareas.map((tarea) => (
            <Fila key={tarea.titulo}>
              <Td className="font-medium text-tinta">{tarea.titulo}</Td>
              <Td className="hidden text-[13px] text-tinta-media md:table-cell">
                {tarea.unidad}
              </Td>
              <TdDato className="text-tinta-media">{tarea.limite}</TdDato>
              <TdDato className="text-right">
                {tarea.obtenido === null ? (
                  <span className="text-tinta-suave">— / {tarea.puntos}</span>
                ) : (
                  <span
                    className={cn(
                      tarea.obtenido === 0 ? 'text-correccion' : 'text-tinta',
                    )}
                  >
                    {tarea.obtenido} / {tarea.puntos}
                  </span>
                )}
              </TdDato>
              <Td>
                {tarea.estado === 'vencida' && (
                  <Etiqueta tono="correccion">No entregada</Etiqueta>
                )}
                {tarea.estado === 'pendiente' && (
                  <Etiqueta tono="aviso">Pendiente</Etiqueta>
                )}
                {tarea.estado === 'calificada' && (
                  <Etiqueta tono="aprobado">Calificada</Etiqueta>
                )}
              </Td>
            </Fila>
          ))}
        </tbody>
      </Tabla>
    </Ficha>
  )
}

function Calificaciones() {
  const obtenido = categorias.reduce((s, c) => s + c.obtenido, 0)
  const calificado = categorias
    .filter((c) => c.obtenido > 0)
    .reduce((s, c) => s + c.posible, 0)
  const porcentaje = (obtenido / calificado) * 100
  const banda =
    escala.bandas.find((b) => porcentaje >= b.desde && porcentaje <= b.hasta) ??
    escala.bandas[4]

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Ficha>
        <FichaCabecera
          titulo="Desglose por categoría"
          descripcion="Se guarda el puntaje crudo; la escala solo lo presenta."
        />
        <Tabla>
          <Encabezado>
            <Th>Categoría</Th>
            <Th className="w-24 text-right">Peso</Th>
            <Th className="w-32 text-right">Puntos</Th>
            <Th className="w-28 text-right">Aporte</Th>
          </Encabezado>
          <tbody>
            {categorias.map((categoria) => {
              const sinCalificar = categoria.obtenido === 0
              return (
                <Fila key={categoria.nombre}>
                  <Td className="font-medium text-tinta">{categoria.nombre}</Td>
                  <TdDato className="text-right text-tinta-media">
                    {categoria.peso}%
                  </TdDato>
                  <TdDato className="text-right">
                    {sinCalificar ? (
                      <span className="text-tinta-suave">
                        — / {categoria.posible}
                      </span>
                    ) : (
                      `${categoria.obtenido} / ${categoria.posible}`
                    )}
                  </TdDato>
                  <TdDato className="text-right text-tinta-media">
                    {sinCalificar
                      ? '—'
                      : `${((categoria.obtenido / categoria.posible) * categoria.peso).toFixed(1)}`}
                  </TdDato>
                </Fila>
              )
            })}
          </tbody>
        </Tabla>
      </Ficha>

      <div className="space-y-4">
        <Ficha className="p-5">
          <p className="etiqueta-dato text-tinta-suave">Nota hasta ahora</p>
          <div className="mt-3 flex items-end gap-3">
            <span className="font-display text-[52px] font-bold leading-none text-pizarra">
              {banda.etiqueta}
            </span>
            <span className="pb-1.5 font-dato text-[15px] tabular-nums text-tinta-media">
              {porcentaje.toFixed(1)}
            </span>
          </div>
          <dl className="mt-4 space-y-1.5 border-t border-regla pt-4 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-tinta-media">Puntaje calificado</dt>
              <dd className="font-dato tabular-nums text-tinta">
                {obtenido} / {calificado}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tinta-media">Índice</dt>
              <dd className="font-dato tabular-nums text-tinta">
                {banda.indice.toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tinta-media">Falta calificar</dt>
              <dd className="font-dato tabular-nums text-aviso">30 pts</dd>
            </div>
          </dl>
        </Ficha>

        <Ficha>
          <FichaCabecera titulo={escala.nombre} />
          <ul className="px-5 py-3">
            {escala.bandas.map((b) => (
              <li
                key={b.etiqueta}
                className={cn(
                  'flex items-center justify-between border-b border-regla py-2 last:border-b-0 font-dato text-[13px] tabular-nums',
                  b.etiqueta === banda.etiqueta
                    ? 'text-pizarra'
                    : 'text-tinta-suave',
                )}
              >
                <span className="font-medium">{b.etiqueta}</span>
                <span>
                  {b.desde} – {b.hasta}
                </span>
                <span>{b.indice.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </Ficha>
      </div>
    </div>
  )
}

function Clases() {
  return (
    <Ficha>
      <FichaCabecera
        titulo="Sesiones en vivo"
        descripcion="Martes y jueves · 14:00 · 90 minutos"
      />
      <ul>
        {sesiones.map((sesion) => (
          <li
            key={sesion.titulo}
            className="flex flex-wrap items-center gap-4 border-b border-regla px-5 py-4 last:border-b-0"
          >
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border',
                sesion.estado === 'proxima'
                  ? 'border-pizarra bg-pizarra-tenue text-pizarra'
                  : 'border-regla bg-lienzo text-tinta-suave',
              )}
            >
              {sesion.estado === 'proxima' ? (
                <Video size={16} strokeWidth={1.5} />
              ) : (
                <Play size={16} strokeWidth={1.5} />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-tinta">
                {sesion.titulo}
              </p>
              <p className="font-dato text-[12px] tabular-nums text-tinta-suave">
                {sesion.fecha} · {sesion.duracion}
              </p>
            </div>

            {sesion.asistencia && (
              <Etiqueta
                tono={sesion.asistencia === 'Presente' ? 'aprobado' : 'correccion'}
              >
                {sesion.asistencia}
              </Etiqueta>
            )}

            <Boton
              tamano="sm"
              variante={sesion.estado === 'proxima' ? 'primario' : 'secundario'}
            >
              {sesion.estado === 'proxima' ? 'Entrar' : 'Ver grabación'}
            </Boton>
          </li>
        ))}
      </ul>
    </Ficha>
  )
}
