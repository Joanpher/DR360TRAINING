import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  CircleCheck,
  FileText,
  Megaphone,
  MonitorPlay,
  MessageSquare,
} from 'lucide-react'
import { Ficha, FichaCabecera } from '../ui/Ficha'
import { Etiqueta } from '../ui/Etiqueta'
import { Medidor } from '../ui/Medidor'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../ui/Tabla'
import {
  actividad,
  anuncios,
  cursos,
  institucion,
  resumenPorRol,
  usuario,
} from '../datos/demo'
import { useRol } from '../app/rol'

const iconoActividad = {
  nota: CircleCheck,
  material: FileText,
  clase: MonitorPlay,
  foro: MessageSquare,
} as const

export function Inicio() {
  const { rol } = useRol()
  const resumen = resumenPorRol[rol]
  const esDocente = rol !== 'estudiante'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-tinta">
            Buen día, {usuario.nombre.split(' ')[0]}
          </h1>
          <p className="etiqueta-dato mt-1.5 text-tinta-suave">
            Periodo {institucion.periodo} · {usuario.carrera}
          </p>
        </div>
        <Link
          to="/calendario"
          className="flex items-center gap-1.5 text-[13px] font-medium text-pizarra hover:underline underline-offset-4"
        >
          Ver mi horario
          <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      </header>

      {/* Un solo bloque reglado en vez de cuatro tarjetas sueltas. */}
      <Ficha>
        <dl className="grid grid-cols-2 divide-regla md:grid-cols-4 md:divide-x">
          {resumen.map((dato, i) => (
            <div
              key={dato.etiqueta}
              className={`px-5 py-4 ${i < 2 ? 'border-b border-regla md:border-b-0' : ''}`}
            >
              <dt className="etiqueta-dato text-tinta-suave">{dato.etiqueta}</dt>
              <dd className="mt-2 font-dato text-[28px] font-medium leading-none tabular-nums text-tinta">
                {dato.valor}
              </dd>
              <p className="mt-1.5 text-[12px] text-tinta-suave">{dato.pie}</p>
            </div>
          ))}
        </dl>
      </Ficha>

      <Ficha>
        <FichaCabecera
          titulo={esDocente ? 'Cursos que impartes' : 'Mis cursos'}
          descripcion={`${cursos.length} asignaturas en el periodo ${institucion.periodo}`}
          accion={
            <Link
              to="/cursos"
              className="text-[13px] font-medium text-pizarra hover:underline underline-offset-4"
            >
              Ver todos
            </Link>
          }
        />
        <Tabla>
          <Encabezado>
            <Th className="w-32">Código</Th>
            <Th>Asignatura</Th>
            <Th className="hidden lg:table-cell">
              {esDocente ? 'Sección' : 'Docente'}
            </Th>
            <Th className="w-44">{esDocente ? 'Por calificar' : 'Progreso'}</Th>
            <Th className="w-56">Próxima entrega</Th>
          </Encabezado>
          <tbody>
            {cursos.map((curso, i) => (
              <Fila key={curso.codigo}>
                <TdDato className="text-pizarra">
                  <Link to={`/cursos/${curso.codigo}`} className="hover:underline">
                    {curso.codigo}
                  </Link>
                </TdDato>
                <Td>
                  <Link
                    to={`/cursos/${curso.codigo}`}
                    className="font-medium text-tinta hover:text-pizarra"
                  >
                    {curso.asignatura}
                  </Link>
                  <span className="ml-2 font-dato text-[11px] text-tinta-suave">
                    {curso.creditos} cr
                  </span>
                </Td>
                <Td className="hidden text-[13px] text-tinta-media lg:table-cell">
                  {esDocente ? `Sección ${String.fromCharCode(65 + i)}` : curso.docente}
                </Td>
                <Td>
                  {esDocente ? (
                    <span className="font-dato text-[13px] tabular-nums text-tinta">
                      {[8, 0, 12, 3, 4, 0][i]} entregas
                    </span>
                  ) : (
                    <Medidor valor={curso.progreso} etiqueta="Avance del curso" />
                  )}
                </Td>
                <Td>
                  {curso.proxima ? (
                    <div className="flex items-center gap-2.5">
                      <span className="font-dato text-[13px] tabular-nums text-tinta-media">
                        {curso.proxima.fecha}
                      </span>
                      <span className="truncate text-[13px] text-tinta">
                        {curso.proxima.titulo}
                      </span>
                      {curso.proxima.estado === 'vencida' && (
                        <Etiqueta tono="correccion">Vencida</Etiqueta>
                      )}
                    </div>
                  ) : (
                    <span className="text-[13px] text-tinta-suave">
                      Sin entregas próximas
                    </span>
                  )}
                </Td>
              </Fila>
            ))}
          </tbody>
        </Tabla>
      </Ficha>

      <div className="grid gap-6 lg:grid-cols-2">
        <Ficha>
          <FichaCabecera titulo="Anuncios" descripcion="De tu institución" />
          <ul>
            {anuncios.map((anuncio) => (
              <li
                key={anuncio.titulo}
                className="flex gap-3.5 border-b border-regla px-5 py-4 last:border-b-0"
              >
                <Megaphone
                  size={17}
                  strokeWidth={1.5}
                  className="mt-0.5 shrink-0 text-tinta-suave"
                />
                <div>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-[14px] font-semibold text-tinta">
                      {anuncio.titulo}
                    </h3>
                    <span className="font-dato text-[11px] text-tinta-suave">
                      {anuncio.fecha}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-tinta-media">
                    {anuncio.cuerpo}
                  </p>
                  <p className="etiqueta-dato mt-1.5 text-tinta-suave">
                    {anuncio.origen}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Ficha>

        <Ficha>
          <FichaCabecera titulo="Actividad reciente" descripcion="Hoy" />
          <ul>
            {actividad.map((item) => {
              const Icono = iconoActividad[item.tipo as keyof typeof iconoActividad] ?? Activity
              return (
                <li
                  key={item.texto}
                  className="flex items-center gap-3.5 border-b border-regla px-5 py-3.5 last:border-b-0"
                >
                  <Icono
                    size={16}
                    strokeWidth={1.5}
                    className="shrink-0 text-tinta-suave"
                  />
                  <p className="flex-1 text-[13px] text-tinta">{item.texto}</p>
                  <span className="font-dato text-[11px] tabular-nums text-tinta-suave">
                    {item.hora}
                  </span>
                </li>
              )
            })}
          </ul>
        </Ficha>
      </div>
    </div>
  )
}
