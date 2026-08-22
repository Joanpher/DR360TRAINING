import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  BookOpen,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  MapPin,
  MessagesSquare,
  Users,
} from 'lucide-react'
import {
  DIAS_SEMANA,
  fechaLegible,
  horarioLegible,
  nombreEstadoCurso,
  nombreModalidad,
  type Curso as CursoDato,
} from '../admin/catalogo'
import { useRol } from '../app/rol'
import { useConsulta } from '../datos/consulta'
import { Boton } from '../ui/Boton'
import { cn } from '../ui/cn'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Etiqueta } from '../ui/Etiqueta'
import { Ficha, FichaCabecera } from '../ui/Ficha'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../ui/Tabla'

const pestanas = ['Contenido', 'Tareas', 'Calificaciones', 'Clases', 'Foro', 'Personas'] as const
type Pestana = (typeof pestanas)[number]

type Estudiante = {
  inscripcionId: string
  membresiaId: string
  matricula: string | null
  nombre: string
  estado: string
  inscritoEn: string
}

type Respuesta = {
  curso: CursoDato
  estudiantes: Estudiante[]
}

export function Curso() {
  const { codigo = '' } = useParams()
  const { rol } = useRol()
  const [pestana, setPestana] = useState<Pestana>('Contenido')
  const { datos, cargando, error, recargar } = useConsulta<Respuesta>(
    `/portal/cursos/${encodeURIComponent(codigo)}`,
  )

  if (cargando) {
    return <div className="h-[520px] animate-pulse rounded-md bg-superficie" />
  }

  if (error || !datos) {
    return (
      <div className="space-y-5">
        <Link to="/cursos" className="text-[13px] text-pizarra hover:underline">Volver a cursos</Link>
        <Ficha>
          <EstadoVacio icono={BookOpen} titulo="No se pudo abrir el curso" texto={error ?? 'El curso no está disponible.'} accion={<Boton tamano="sm" onClick={() => void recargar()}>Reintentar</Boton>} />
        </Ficha>
      </div>
    )
  }

  const { curso, estudiantes } = datos

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-1.5 text-[13px] text-tinta-media">
          <Link to="/cursos" className="hover:text-pizarra">Cursos</Link>
          <ChevronRight size={13} className="text-tinta-suave" />
          <span className="font-dato text-[12px] text-tinta">{curso.codigo}</span>
        </nav>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[28px] font-bold leading-tight text-tinta">{curso.nombre}</h1>
              <Etiqueta tono={curso.estado === 'activo' ? 'aprobado' : curso.estado === 'promocion' ? 'aviso' : 'neutro'}>
                {nombreEstadoCurso[curso.estado]}
              </Etiqueta>
            </div>
            <p className="mt-2 text-[13px] text-tinta-media">
              {[curso.instructor, curso.categoria, nombreModalidad[curso.modalidad]].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      </div>

      <Ficha className="overflow-hidden">
        <div className="grid md:grid-cols-[220px_1fr]">
          <div className="aspect-video bg-lienzo md:aspect-auto md:min-h-36">
            {curso.imagenUrl ? <img src={curso.imagenUrl} alt={`Portada de ${curso.nombre}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-tinta-suave"><BookOpen size={30} /></div>}
          </div>
          <div className="grid grid-cols-2 gap-px bg-regla sm:grid-cols-4">
            <DatoCurso etiqueta="Horario" valor={horarioLegible(curso.horarios)} />
            <DatoCurso etiqueta="Duración" valor={curso.duracionSemanas ? `${curso.duracionSemanas} semanas` : '—'} />
            <DatoCurso etiqueta="Fechas" valor={`${fechaLegible(curso.iniciaEn)} – ${fechaLegible(curso.terminaEn)}`} />
            <DatoCurso etiqueta="Grupo" valor={`${curso.inscritos}${curso.cupo ? ` / ${curso.cupo}` : ''} inscritos`} />
          </div>
        </div>
      </Ficha>

      <div className="flex gap-0.5 overflow-x-auto border-b border-regla">
        {pestanas.map((nombre) => (
          <button key={nombre} onClick={() => setPestana(nombre)} className={cn('relative shrink-0 px-3 py-2.5 text-[13.5px] font-medium transition-colors after:absolute after:inset-x-2 after:-bottom-px after:h-[2px]', nombre === pestana ? 'text-tinta after:bg-pizarra' : 'text-tinta-media after:bg-transparent hover:text-tinta hover:after:bg-regla-fuerte')}>
            {nombre}
          </button>
        ))}
      </div>

      {pestana === 'Contenido' && <Contenido curso={curso} />}
      {pestana === 'Tareas' && <ModuloVacio icono={ClipboardList} titulo="No hay tareas" texto="Este curso todavía no tiene tareas publicadas." />}
      {pestana === 'Calificaciones' && <ModuloVacio icono={GraduationCap} titulo="No hay calificaciones" texto="Este curso todavía no tiene evaluaciones calificadas." />}
      {pestana === 'Clases' && <Clases curso={curso} />}
      {pestana === 'Foro' && <ModuloVacio icono={MessagesSquare} titulo="No hay conversaciones" texto="Este curso todavía no tiene temas publicados." />}
      {pestana === 'Personas' && <Personas curso={curso} estudiantes={estudiantes} esDocente={rol === 'docente'} />}
    </div>
  )
}

function DatoCurso({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <dl className="min-w-0 bg-superficie p-4">
      <dt className="etiqueta-dato text-tinta-suave">{etiqueta}</dt>
      <dd className="mt-2 break-words text-[13px] font-medium leading-relaxed text-tinta">{valor}</dd>
    </dl>
  )
}

function Contenido({ curso }: { curso: CursoDato }) {
  return (
    <div className="space-y-4">
      {(curso.descripcion || curso.resumen) && (
        <Ficha>
          <FichaCabecera titulo="Acerca del curso" />
          <p className="px-5 py-4 text-[14px] leading-relaxed text-tinta-media">{curso.descripcion || curso.resumen}</p>
        </Ficha>
      )}
      <ModuloVacio icono={BookOpen} titulo="No hay materiales" texto="Este curso todavía no tiene contenido publicado." />
    </div>
  )
}

function Clases({ curso }: { curso: CursoDato }) {
  if (curso.horarios.length === 0) {
    return <ModuloVacio icono={CalendarClock} titulo="No hay horario" texto="Este curso todavía no tiene bloques de clase programados." />
  }

  return (
    <Ficha>
      <FichaCabecera titulo="Horario semanal" descripcion={`${fechaLegible(curso.iniciaEn)} – ${fechaLegible(curso.terminaEn)}`} />
      <ul>
        {curso.horarios.map((horario) => (
          <li key={`${horario.diaSemana}-${horario.horaInicio}`} className="flex flex-wrap items-center gap-4 border-b border-regla px-5 py-4 last:border-b-0">
            <CalendarClock size={18} className="text-pizarra" />
            <div className="min-w-36">
              <p className="text-[14px] font-semibold text-tinta">{DIAS_SEMANA[horario.diaSemana - 1]?.largo}</p>
              <p className="font-dato text-[12px] text-tinta-media">{horario.horaInicio} – {horario.horaFin}</p>
            </div>
            <p className="ml-auto flex items-center gap-2 text-[13px] text-tinta-media">
              <MapPin size={14} /> {[curso.sede, curso.aula].filter(Boolean).join(' · ') || nombreModalidad[curso.modalidad]}
            </p>
          </li>
        ))}
      </ul>
    </Ficha>
  )
}

function Personas({ curso, estudiantes, esDocente }: { curso: CursoDato; estudiantes: Estudiante[]; esDocente: boolean }) {
  if (!esDocente) {
    return (
      <Ficha>
        <FichaCabecera titulo="Equipo docente" />
        <div className="flex items-center gap-3 px-5 py-4">
          <Users size={18} className="text-pizarra" />
          <div><p className="text-[14px] font-semibold text-tinta">{curso.instructor ?? 'Sin instructor asignado'}</p><p className="text-[12px] text-tinta-suave">Instructor</p></div>
        </div>
      </Ficha>
    )
  }

  if (estudiantes.length === 0) {
    return <ModuloVacio icono={Users} titulo="No hay estudiantes inscritos" texto="La lista se actualizará cuando se registre una inscripción." />
  }

  return (
    <Ficha className="overflow-hidden">
      <FichaCabecera titulo="Estudiantes" descripcion={`${estudiantes.length} en este grupo`} />
      <Tabla>
        <Encabezado><Th>Estudiante</Th><Th className="w-48">Matrícula</Th><Th className="w-36">Estado</Th><Th className="w-40">Inscripción</Th></Encabezado>
        <tbody>
          {estudiantes.map((estudiante) => (
            <Fila key={estudiante.inscripcionId}>
              <Td className="font-medium text-tinta">{estudiante.nombre}</Td>
              <TdDato>{estudiante.matricula ?? '—'}</TdDato>
              <Td><Etiqueta tono={estudiante.estado === 'activa' ? 'aprobado' : estudiante.estado === 'preinscrita' ? 'aviso' : 'neutro'}>{nombreInscripcion(estudiante.estado)}</Etiqueta></Td>
              <TdDato>{fechaLegible(estudiante.inscritoEn)}</TdDato>
            </Fila>
          ))}
        </tbody>
      </Tabla>
    </Ficha>
  )
}

function ModuloVacio({ icono, titulo, texto }: { icono: typeof BookOpen; titulo: string; texto: string }) {
  return <Ficha><EstadoVacio icono={icono} titulo={titulo} texto={texto} /></Ficha>
}

function nombreInscripcion(estado: string): string {
  return ({ preinscrita: 'Preinscrita', activa: 'Activa', completada: 'Completada' } as Record<string, string>)[estado] ?? estado
}
