import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  CalendarClock,
  ChevronRight,
  ImagePlus,
  MapPin,
  Clock3,
  UserRound,
  Users,
  Upload,
  Trash2,
} from 'lucide-react'
import {
  fechaLegible,
  horarioLegible,
  nombreEstadoCurso,
  nombreModalidad,
  type Curso as CursoDato,
} from '../admin/catalogo'
import { useRol } from '../app/rol'
import { pedir } from '../datos/api'
import { useConsulta, useGuardar } from '../datos/consulta'
import { prepararPortadaCompleta } from '../datos/portada'
import { AulaCurso } from '../portal/AulaCurso'
import { ClasesCurso } from '../portal/ClasesCurso'
import { AulaEstudiante } from '../portal/AulaEstudiante'
import { ForoCurso } from '../portal/ForoCurso'
import { CalificacionesCurso, TareasCurso } from '../portal/CursoModulos'
import { EvaluacionesCurso } from '../portal/EvaluacionesCurso'
import { Boton } from '../ui/Boton'
import { cn } from '../ui/cn'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Etiqueta } from '../ui/Etiqueta'
import { Ficha, FichaCabecera } from '../ui/Ficha'
import { Dialogo } from '../ui/Dialogo'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../ui/Tabla'

const pestanas = ['Aula', 'Tareas', 'Exámenes', 'Calificaciones', 'Clases', 'Foro', 'Personas'] as const
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
  const [parametros] = useSearchParams()
  const { rol } = useRol()
  const [pestana, setPestana] = useState<Pestana>(() =>
    parametros.get('seccion') === 'examenes' ? 'Exámenes' : 'Aula',
  )
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

        {rol === 'estudiante' ? (
          <CabeceraCursoEstudiante curso={curso} />
        ) : (
          <CabeceraCursoDocente curso={curso} alActualizar={() => void recargar()} />
        )}
      </div>

      <div className="flex gap-0.5 overflow-x-auto border-b border-regla">
        {pestanas.map((nombre) => (
          <button key={nombre} onClick={() => setPestana(nombre)} className={cn('relative shrink-0 px-3 py-2.5 text-[13.5px] font-medium transition-colors after:absolute after:inset-x-2 after:-bottom-px after:h-[2px]', nombre === pestana ? 'text-tinta after:bg-pizarra' : 'text-tinta-media after:bg-transparent hover:text-tinta hover:after:bg-regla-fuerte')}>
            {nombre}
          </button>
        ))}
      </div>

      {pestana === 'Aula' && (rol === 'docente' ? <AulaCurso curso={curso} /> : <AulaEstudiante curso={curso} />)}
      {pestana === 'Tareas' && <TareasCurso curso={curso} esDocente={rol === 'docente'} alAbrirAula={() => setPestana('Aula')} />}
      {pestana === 'Exámenes' && <EvaluacionesCurso curso={curso} esDocente={rol === 'docente'} />}
      {pestana === 'Calificaciones' && <CalificacionesCurso curso={curso} esDocente={rol === 'docente'} />}
      {pestana === 'Clases' && <ClasesCurso curso={curso} />}
      {pestana === 'Foro' && <ForoCurso curso={curso} />}
      {pestana === 'Personas' && <Personas curso={curso} estudiantes={estudiantes} esDocente={rol === 'docente'} />}
    </div>
  )
}

function CabeceraCursoDocente({ curso, alActualizar }: { curso: CursoDato; alActualizar: () => void }) {
  return (
    <section className="mt-4 overflow-hidden rounded-md border border-regla bg-superficie">
      <div className="grid md:grid-cols-[210px_1fr]">
        <div className="relative aspect-video overflow-hidden border-b border-regla bg-lienzo p-3 md:aspect-auto md:min-h-[205px] md:border-b-0 md:border-r">
          {curso.imagenUrl ? (
            <img src={curso.imagenUrl} alt={`Portada de ${curso.nombre}`} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-tinta-suave"><BookOpen size={38} strokeWidth={1.2} /></div>
          )}
          <span className="absolute bottom-4 left-4 border border-white/70 bg-superficie/95 px-2.5 py-1.5 font-dato text-[11px] font-medium text-tinta">{curso.codigo}</span>
          <EditorPortada curso={curso} alActualizar={alActualizar} />
        </div>

        <div className="flex flex-col p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="etiqueta-dato text-pizarra">Gestión del curso</p>
              <h1 className="mt-1 font-display text-[25px] font-bold leading-tight text-tinta">{curso.nombre}</h1>
              <p className="mt-2 text-[12.5px] text-tinta-media">{[curso.categoria, nombreModalidad[curso.modalidad], curso.sede, curso.aula].filter(Boolean).join(' · ')}</p>
            </div>
            <EstadoCurso curso={curso} />
          </div>

          {curso.resumen && <p className="mt-3 line-clamp-2 max-w-3xl text-[12.5px] leading-relaxed text-tinta-media">{curso.resumen}</p>}

          <div className="mt-4 grid grid-cols-2 gap-px border border-regla bg-regla sm:grid-cols-4">
            <DatoCurso etiqueta="Horario" valor={horarioLegible(curso.horarios)} />
            <DatoCurso etiqueta="Duración" valor={curso.duracionSemanas ? `${curso.duracionSemanas} semanas` : '—'} />
            <DatoCurso etiqueta="Período" valor={`${fechaLegible(curso.iniciaEn)} – ${fechaLegible(curso.terminaEn)}`} />
            <DatoCurso etiqueta="Grupo" valor={`${curso.inscritos}${curso.cupo ? ` / ${curso.cupo}` : ''} inscritos`} />
          </div>
        </div>
      </div>
    </section>
  )
}

function CabeceraCursoEstudiante({ curso }: { curso: CursoDato }) {
  return (
    <section className="mt-4 overflow-hidden rounded-md border border-regla bg-superficie">
      <div className="grid lg:grid-cols-[240px_1fr]">
        <div className="relative aspect-video overflow-hidden border-b border-regla bg-lienzo p-3 lg:aspect-auto lg:min-h-[215px] lg:border-b-0 lg:border-r">
          {curso.imagenUrl ? (
            <img src={curso.imagenUrl} alt={`Portada de ${curso.nombre}`} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-tinta-suave"><BookOpen size={44} strokeWidth={1.2} /></div>
          )}
          <span className="absolute bottom-4 left-4 border border-white/70 bg-superficie/95 px-2.5 py-1.5 font-dato text-[11px] font-medium text-tinta">{curso.codigo}</span>
        </div>

        <div className="flex flex-col p-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="etiqueta-dato text-pizarra">{curso.categoria ?? 'Mi curso'}</p>
              <h1 className="mt-1.5 font-display text-[25px] font-bold leading-tight text-tinta sm:text-[28px]">{curso.nombre}</h1>
            </div>
            <EstadoCurso curso={curso} />
          </div>

          {curso.resumen && <p className="mt-2 line-clamp-2 max-w-2xl text-[12.5px] leading-relaxed text-tinta-media">{curso.resumen}</p>}

          <p className="mt-3 flex items-center gap-2 border-t border-regla pt-3 text-[12.5px] text-tinta-media">
            <UserRound size={16} className="text-pizarra" />
            <span><strong className="font-semibold text-tinta">{curso.instructor ?? 'Sin instructor asignado'}</strong><span className="ml-2 text-tinta-suave">Instructor</span></span>
          </p>

          <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-regla pt-3 sm:grid-cols-4">
            <DetalleCurso icono={<CalendarClock size={15} />} etiqueta="Horario" valor={horarioLegible(curso.horarios)} />
            <DetalleCurso icono={<Clock3 size={15} />} etiqueta="Duración" valor={curso.duracionSemanas ? `${curso.duracionSemanas} semanas` : '—'} />
            <DetalleCurso icono={<CalendarClock size={15} />} etiqueta="Inicio" valor={fechaLegible(curso.iniciaEn)} />
            <DetalleCurso icono={<MapPin size={15} />} etiqueta="Modalidad" valor={[nombreModalidad[curso.modalidad], curso.sede, curso.aula].filter(Boolean).join(' · ')} />
          </div>
        </div>
      </div>
    </section>
  )
}

function EditorPortada({ curso, alActualizar }: { curso: CursoDato; alActualizar: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(curso.imagenUrl)
  const [procesando, setProcesando] = useState(false)
  const [errorImagen, setErrorImagen] = useState<string | null>(null)
  const guardado = useGuardar()

  async function seleccionar(archivo: File | undefined) {
    if (!archivo) return
    setProcesando(true)
    setErrorImagen(null)
    try {
      setVistaPrevia(await prepararPortadaCompleta(archivo))
    } catch (error) {
      setErrorImagen(error instanceof Error ? error.message : 'No se pudo procesar la imagen.')
    } finally {
      setProcesando(false)
    }
  }

  async function guardar() {
    const resultado = await guardado.guardar(() =>
      pedir<{ imagenUrl: string | null }>(`/aulas/curso/${curso.id}/portada`, {
        metodo: 'PATCH',
        cuerpo: { imagenUrl: vistaPrevia },
      }),
    )
    if (resultado) {
      setAbierto(false)
      alActualizar()
    }
  }

  function abrir() {
    setVistaPrevia(curso.imagenUrl)
    setErrorImagen(null)
    setAbierto(true)
  }

  return (
    <>
      <button
        type="button"
        title="Cambiar portada"
        aria-label="Cambiar portada"
        onClick={abrir}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center border border-regla bg-superficie text-pizarra shadow-sm hover:bg-pizarra hover:text-white"
      >
        <ImagePlus size={16} />
      </button>
      <Dialogo abierto={abierto} alCerrar={() => setAbierto(false)} titulo="Portada del curso" descripcion={curso.nombre} ancho="md">
        <div className="space-y-5">
          <div className="aspect-video overflow-hidden border border-regla bg-lienzo p-3">
            {vistaPrevia ? (
              <img src={vistaPrevia} alt="Vista previa de la portada" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-tinta-suave"><BookOpen size={34} strokeWidth={1.2} /><span className="text-[12px]">Sin portada</span></div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 border border-regla-fuerte bg-superficie px-3 text-[12.5px] font-semibold text-tinta hover:bg-lienzo">
              <Upload size={15} /> {procesando ? 'Preparando...' : 'Seleccionar imagen'}
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={procesando} className="sr-only" onChange={(evento) => { void seleccionar(evento.target.files?.[0]); evento.target.value = '' }} />
            </label>
            {vistaPrevia && (
              <button type="button" title="Quitar portada" aria-label="Quitar portada" onClick={() => setVistaPrevia(null)} className="flex h-9 w-9 items-center justify-center text-tinta-suave hover:bg-correccion-tenue hover:text-correccion"><Trash2 size={15} /></button>
            )}
          </div>
          <p className="text-[11.5px] leading-relaxed text-tinta-suave">JPEG, PNG o WebP. La imagen se ajusta a 16:9 sin recortar su contenido.</p>
          {(errorImagen || guardado.error) && <p className="border border-correccion/30 bg-correccion-tenue px-3 py-2 text-[12px] text-correccion">{errorImagen ?? guardado.error}</p>}
          <div className="flex justify-end gap-2 border-t border-regla pt-4">
            <Boton tamano="sm" variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton>
            <Boton tamano="sm" variante="primario" onClick={() => void guardar()} disabled={procesando || guardado.guardando}>{guardado.guardando ? 'Guardando...' : 'Guardar portada'}</Boton>
          </div>
        </div>
      </Dialogo>
    </>
  )
}

function EstadoCurso({ curso }: { curso: CursoDato }) {
  return (
    <Etiqueta tono={curso.estado === 'activo' ? 'aprobado' : curso.estado === 'promocion' ? 'aviso' : 'neutro'}>
      {nombreEstadoCurso[curso.estado]}
    </Etiqueta>
  )
}

function DetalleCurso({ icono, etiqueta, valor }: { icono: React.ReactNode; etiqueta: string; valor: string }) {
  return (
    <dl className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase text-tinta-suave">{icono}{etiqueta}</dt>
      <dd className="mt-1.5 break-words text-[11.5px] font-medium leading-relaxed text-tinta">{valor}</dd>
    </dl>
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
