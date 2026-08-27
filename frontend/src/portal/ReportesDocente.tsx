import { useState } from 'react'
import {
  ChartColumn,
  ChevronRight,
  ClipboardCheck,
  Users,
  Video,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useConsulta } from '../datos/consulta'
import { Boton } from '../ui/Boton'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Etiqueta } from '../ui/Etiqueta'
import { Ficha, FichaCabecera } from '../ui/Ficha'
import { Medidor } from '../ui/Medidor'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../ui/Tabla'
import {
  comoNumero,
  fechaCorta,
  minutosLegibles,
  nombreEstadoInscripcion,
  porcentaje,
  tonoRendimiento,
  type RespuestaReporteCurso,
  type RespuestaReportes,
  type ResumenCurso,
} from './docencia'

/*
  Reportes de quien imparte.

  Dos niveles y no mas: la lista de cursos responde "¿como va cada curso?" y el
  detalle responde "¿quien se esta quedando atras?". Son las dos unicas
  preguntas que un instructor se hace antes de una clase, y cualquier tercer
  nivel acabaria repitiendo lo que ya cuentan el aula y las evaluaciones.

  Todo sale de /api/docencia, que agrega sobre las tablas de siempre. No hay un
  solo numero guardado en ninguna parte: un reporte que se calcula al abrirlo no
  puede quedarse viejo, que es el fallo por el que nadie se fia de los reportes.
*/
export function ReportesDocente() {
  const [cursoAbierto, setCursoAbierto] = useState<ResumenCurso | null>(null)
  const consulta = useConsulta<RespuestaReportes>('/docencia/reportes')

  if (cursoAbierto) {
    return (
      <DetalleCurso curso={cursoAbierto} alVolver={() => setCursoAbierto(null)} />
    )
  }

  const cursos = consulta.datos?.cursos ?? []
  const totales = cursos.reduce(
    (suma, curso) => ({
      estudiantes: suma.estudiantes + curso.estudiantes,
      porCalificar: suma.porCalificar + curso.porCalificar,
      clases: suma.clases + curso.clasesCelebradas,
    }),
    { estudiantes: 0, porCalificar: 0, clases: 0 },
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-regla pb-5">
        <div>
          <p className="etiqueta-dato text-pizarra">Seguimiento</p>
          <h1 className="mt-1 font-display text-[30px] font-bold text-tinta">Reportes</h1>
          <p className="mt-2 max-w-xl text-[13px] text-tinta-media">
            Rendimiento, entregas y asistencia de los cursos que impartes. Se calcula
            al abrir la pantalla: lo que ves es el estado de ahora mismo.
          </p>
        </div>
        {!consulta.cargando && cursos.length > 0 && (
          <p className="font-dato text-[12px] text-tinta-suave">
            {cursos.length} {cursos.length === 1 ? 'curso' : 'cursos'} ·{' '}
            {totales.estudiantes} estudiantes
          </p>
        )}
      </header>

      {consulta.cargando ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-md bg-superficie" />
          <div className="h-80 animate-pulse rounded-md bg-superficie" />
        </div>
      ) : consulta.error ? (
        <Ficha>
          <EstadoVacio
            icono={ChartColumn}
            titulo="No se pudieron cargar los reportes"
            texto={consulta.error}
            accion={
              <Boton tamano="sm" onClick={() => void consulta.recargar()}>
                Reintentar
              </Boton>
            }
          />
        </Ficha>
      ) : cursos.length === 0 ? (
        <Ficha>
          <EstadoVacio
            icono={ChartColumn}
            titulo="Todavía no hay nada que reportar"
            texto="Cuando te asignen un curso con estudiantes inscritos, aquí verás cómo va."
          />
        </Ficha>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Cifra
              icono={Users}
              valor={String(totales.estudiantes)}
              etiqueta="Estudiantes"
              detalle="matrículas vivas en tus cursos"
            />
            <Cifra
              icono={ClipboardCheck}
              valor={String(totales.porCalificar)}
              etiqueta="Sin calificar"
              detalle="entregas esperando nota"
              alerta={totales.porCalificar > 0}
            />
            <Cifra
              icono={Video}
              valor={String(totales.clases)}
              etiqueta="Clases dadas"
              detalle="sesiones en vivo celebradas"
            />
          </div>

          <Ficha>
            <FichaCabecera
              titulo="Por curso"
              descripcion="Abre uno para ver la lista de clase con su rendimiento."
            />
            <Tabla>
              <Encabezado>
                <Th>Curso</Th>
                <Th className="text-right">Estudiantes</Th>
                <Th className="text-right">Sin calificar</Th>
                <Th>Promedio tareas</Th>
                <Th>Promedio exámenes</Th>
                <Th>Asistencia</Th>
                <Th className="w-10" />
              </Encabezado>
              <tbody>
                {cursos.map((curso) => (
                  <Fila key={curso.cursoId} onClick={() => setCursoAbierto(curso)}>
                    <Td>
                      <p className="font-medium text-tinta">{curso.nombre}</p>
                      <p className="font-dato text-[12px] text-tinta-suave">
                        {curso.codigo} · {curso.tareasPublicadas} tareas ·{' '}
                        {curso.evaluacionesPublicadas} exámenes
                      </p>
                    </Td>
                    <TdDato className="text-right">{curso.estudiantes}</TdDato>
                    <TdDato className="text-right">
                      {curso.porCalificar > 0 ? (
                        <Etiqueta tono="aviso">{curso.porCalificar}</Etiqueta>
                      ) : (
                        <span className="text-tinta-suave">0</span>
                      )}
                    </TdDato>
                    <Td>
                      <Barra valor={curso.promedioTareas} />
                    </Td>
                    <Td>
                      <Barra valor={curso.promedioEvaluaciones} />
                    </Td>
                    <Td>
                      <Barra valor={curso.asistenciaMedia} />
                    </Td>
                    <Td className="text-right">
                      <ChevronRight size={15} className="text-tinta-suave" />
                    </Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          </Ficha>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detalle de un curso: la lista de clase
// ---------------------------------------------------------------------------
function DetalleCurso({
  curso,
  alVolver,
}: {
  curso: ResumenCurso
  alVolver: () => void
}) {
  const consulta = useConsulta<RespuestaReporteCurso>(
    `/docencia/reportes/${curso.cursoId}`,
  )

  const estudiantes = consulta.datos?.estudiantes ?? []
  const cabecera = consulta.datos?.curso

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-1.5 text-[13px] text-tinta-media">
          <button onClick={alVolver} className="hover:text-pizarra">
            Reportes
          </button>
          <ChevronRight size={13} className="text-tinta-suave" />
          <span className="font-dato text-[12px] text-tinta">{curso.codigo}</span>
        </nav>

        <header className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-regla pb-5">
          <div>
            <h1 className="font-display text-[26px] font-bold leading-tight text-tinta">
              {curso.nombre}
            </h1>
            {cabecera && (
              <p className="mt-1.5 font-dato text-[12px] text-tinta-suave">
                {cabecera.tareasPublicadas} tareas · {cabecera.evaluacionesPublicadas}{' '}
                exámenes · {cabecera.clasesCelebradas} clases dadas
              </p>
            )}
          </div>
          <Link
            to={`/cursos/${encodeURIComponent(curso.codigo)}`}
            className="text-[13px] text-pizarra hover:underline"
          >
            Ir al curso
          </Link>
        </header>
      </div>

      {consulta.cargando ? (
        <div className="h-80 animate-pulse rounded-md bg-superficie" />
      ) : consulta.error ? (
        <Ficha>
          <EstadoVacio
            icono={ChartColumn}
            titulo="No se pudo cargar el curso"
            texto={consulta.error}
            accion={
              <Boton tamano="sm" onClick={() => void consulta.recargar()}>
                Reintentar
              </Boton>
            }
          />
        </Ficha>
      ) : estudiantes.length === 0 ? (
        <Ficha>
          <EstadoVacio
            icono={Users}
            titulo="Este curso no tiene estudiantes"
            texto="La lista aparecerá cuando administración registre la primera inscripción."
          />
        </Ficha>
      ) : (
        <Ficha>
          <FichaCabecera
            titulo="Lista de clase"
            descripcion={`${estudiantes.length} ${estudiantes.length === 1 ? 'persona inscrita' : 'personas inscritas'}`}
          />
          <Tabla>
            <Encabezado>
              <Th>Estudiante</Th>
              <Th className="text-right">Entregas</Th>
              <Th>Promedio tareas</Th>
              <Th className="text-right">Exámenes</Th>
              <Th>Promedio exámenes</Th>
              <Th className="text-right">Asistencia</Th>
              <Th>Última actividad</Th>
            </Encabezado>
            <tbody>
              {estudiantes.map((fila) => (
                <Fila key={fila.membresiaId}>
                  <Td>
                    <p className="font-medium text-tinta">{fila.nombre}</p>
                    <p className="font-dato text-[12px] text-tinta-suave">
                      {fila.matricula ?? 'Sin matrícula'} ·{' '}
                      {nombreEstadoInscripcion[fila.estado] ?? fila.estado}
                    </p>
                  </Td>
                  <TdDato className="text-right">
                    {fila.entregas}
                    {cabecera && (
                      <span className="text-tinta-suave">
                        /{cabecera.tareasPublicadas}
                      </span>
                    )}
                  </TdDato>
                  <Td>
                    <Barra valor={fila.promedioTareas} />
                  </Td>
                  <TdDato className="text-right">{fila.intentos}</TdDato>
                  <Td>
                    <Barra valor={fila.promedioEvaluaciones} />
                  </Td>
                  <TdDato className="text-right">
                    {fila.clasesAsistidas}
                    {cabecera && (
                      <span className="text-tinta-suave">
                        /{cabecera.clasesCelebradas}
                      </span>
                    )}
                    <span className="ml-2 text-[12px] text-tinta-suave">
                      {minutosLegibles(fila.minutos)}
                    </span>
                  </TdDato>
                  <Td>
                    <span
                      className={
                        fila.ultimaActividadEn ? 'text-tinta-media' : 'text-tinta-suave'
                      }
                    >
                      {fechaCorta(fila.ultimaActividadEn)}
                    </span>
                  </Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        </Ficha>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function Barra({ valor }: { valor: string | null }) {
  if (valor === null) {
    return <span className="text-[13px] text-tinta-suave">Sin datos</span>
  }
  return (
    <div className="flex items-center gap-2">
      <Medidor valor={comoNumero(valor)} etiqueta={porcentaje(valor)} />
      <Etiqueta tono={tonoRendimiento(valor)}>{porcentaje(valor)}</Etiqueta>
    </div>
  )
}

function Cifra({
  icono: Icono,
  valor,
  etiqueta,
  detalle,
  alerta,
}: {
  icono: typeof Users
  valor: string
  etiqueta: string
  detalle: string
  alerta?: boolean
}) {
  return (
    <Ficha className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="etiqueta-dato text-tinta-suave">{etiqueta}</p>
          <p className="mt-1 font-display text-[28px] font-bold leading-none text-tinta">
            {valor}
          </p>
          <p className="mt-1.5 text-[12.5px] text-tinta-media">{detalle}</p>
        </div>
        <span
          className={
            alerta
              ? 'flex h-9 w-9 items-center justify-center rounded-sm border border-aviso/25 bg-aviso-tenue text-aviso'
              : 'flex h-9 w-9 items-center justify-center rounded-sm border border-regla bg-lienzo text-tinta-suave'
          }
        >
          <Icono size={17} strokeWidth={1.5} />
        </span>
      </div>
    </Ficha>
  )
}
