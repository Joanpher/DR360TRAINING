import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  GraduationCap,
  Send,
  UserPlus,
} from 'lucide-react'
import { Ficha, FichaCabecera } from '../../ui/Ficha'
import { Etiqueta } from '../../ui/Etiqueta'
import { cn } from '../../ui/cn'
import { useSesion } from '../../app/sesion'
import { Cifras, EncabezadoPagina } from '../piezas'
import {
  bitacora,
  cursosAdmin,
  invitaciones,
  periodos,
  personas,
  puestaEnMarcha,
} from '../datos'

/*
  La primera pantalla del administrador no es un tablero de metricas bonitas:
  es una lista de lo que esta pendiente. Un rector no abre el panel para saber
  cuantos usuarios tiene, lo abre porque algo hay que resolver. Por eso "Hay
  que atender" va arriba y las cifras, que casi nunca cambian de un dia a otro,
  van debajo como contexto.
*/
export function Resumen() {
  const { usuario, institucion } = useSesion()
  const periodoActivo = periodos.find((p) => p.estado === 'activo')

  const delPeriodo = cursosAdmin.filter((c) => c.periodo === periodoActivo?.codigo)
  const sinDocente = delPeriodo.filter((c) => !c.docente)
  const enBorrador = delPeriodo.filter((c) => c.estado === 'borrador')
  const pendientes = invitaciones.filter((i) => i.estado === 'pendiente')
  const activas = personas.filter((p) => p.estado === 'activa')
  const docentes = activas.filter((p) => p.roles.includes('docente'))
  const estudiantes = activas.filter((p) => p.roles.includes('estudiante'))

  const hechos = puestaEnMarcha.filter((p) => p.hecho).length
  const avance = Math.round((hechos / puestaEnMarcha.length) * 100)

  const atender = [
    sinDocente.length > 0 && {
      texto: `${sinDocente.length} curso${sinDocente.length > 1 ? 's' : ''} del periodo sin instructor asignado`,
      detalle: sinDocente.map((c) => `${c.codigo}-${c.seccion}`).join(' · '),
      ruta: '/admin/cursos',
      accion: 'Asignar',
      grave: true,
    },
    enBorrador.length > 0 && {
      texto: `${enBorrador.length} curso${enBorrador.length > 1 ? 's' : ''} en borrador sin publicar`,
      detalle: 'Los estudiantes no pueden inscribirse hasta que se publiquen',
      ruta: '/admin/cursos',
      accion: 'Revisar',
      grave: false,
    },
    pendientes.length > 0 && {
      texto: `${pendientes.length} invitaciones sin aceptar`,
      detalle: 'Una vence mañana',
      ruta: '/admin/invitaciones',
      accion: 'Ver',
      grave: false,
    },
    {
      texto: 'El dominio uce.edu.do no está verificado',
      detalle: 'Sin verificar, nadie puede entrar con su correo institucional',
      ruta: '/admin/institucion',
      accion: 'Verificar',
      grave: false,
    },
  ].filter(Boolean) as Array<{
    texto: string
    detalle: string
    ruta: string
    accion: string
    grave: boolean
  }>

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo={`Buen día, ${usuario?.nombres?.split(' ')[0] ?? ''}`}
        descripcion={`Estás administrando ${institucion?.nombre ?? 'tu institución'}. Periodo ${periodoActivo?.codigo ?? 'sin abrir'}, del ${periodoActivo?.inicio ?? '—'} al ${periodoActivo?.fin ?? '—'}.`}
      />

      <Ficha>
        <FichaCabecera
          titulo="Hay que atender"
          descripcion="Lo que impide que el periodo funcione del todo"
        />
        <ul>
          {atender.map((item) => (
            <li
              key={item.texto}
              className="flex items-start gap-3.5 border-b border-regla px-5 py-3.5 last:border-b-0"
            >
              <CircleAlert
                size={17}
                strokeWidth={1.5}
                className={cn('mt-0.5 shrink-0', item.grave ? 'text-correccion' : 'text-aviso')}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-tinta">{item.texto}</p>
                <p className="mt-0.5 truncate text-[12.5px] text-tinta-suave">
                  {item.detalle}
                </p>
              </div>
              <Link
                to={item.ruta}
                className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-pizarra underline-offset-4 hover:underline"
              >
                {item.accion}
                <ArrowRight size={14} strokeWidth={1.75} />
              </Link>
            </li>
          ))}
        </ul>
      </Ficha>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <AccionRapida
          icono={UserPlus}
          titulo="Invitar persona"
          texto="Instructor, estudiante o administrador"
          ruta="/admin/personas"
        />
        <AccionRapida
          icono={BookOpen}
          titulo="Crear curso"
          texto="Asignatura, sección e instructor"
          ruta="/admin/cursos"
        />
        <AccionRapida
          icono={GraduationCap}
          titulo="Registrar programa"
          texto="Carrera, maestría o diplomado"
          ruta="/admin/programas"
        />
        <AccionRapida
          icono={Send}
          titulo="Importar desde CSV"
          texto="Alta masiva de estudiantes"
          ruta="/admin/personas"
        />
      </div>

      <Ficha>
        <Cifras
          datos={[
            {
              etiqueta: 'Personas activas',
              valor: String(activas.length),
              pie: `${docentes.length} instructores · ${estudiantes.length} estudiantes`,
            },
            {
              etiqueta: 'Cursos del periodo',
              valor: String(delPeriodo.length),
              pie: `${delPeriodo.filter((c) => c.estado === 'publicado').length} publicados`,
            },
            {
              etiqueta: 'Sin instructor',
              valor: String(sinDocente.length),
              pie: 'Bloquean la inscripción',
              alerta: sinDocente.length > 0,
            },
            {
              etiqueta: 'Invitaciones',
              valor: String(pendientes.length),
              pie: 'Pendientes de aceptar',
            },
          ]}
        />
      </Ficha>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Ficha>
          <FichaCabecera
            titulo="Puesta en marcha"
            descripcion={`${hechos} de ${puestaEnMarcha.length} pasos completados`}
            accion={
              <span className="font-dato text-[13px] tabular-nums text-tinta-media">
                {avance}%
              </span>
            }
          />
          <div className="h-1 bg-regla">
            <div className="h-full bg-pizarra" style={{ width: `${avance}%` }} />
          </div>
          <ul>
            {puestaEnMarcha.map((paso) => (
              <li key={paso.paso} className="border-b border-regla last:border-b-0">
                <Link
                  to={paso.ruta}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-lienzo"
                >
                  <span
                    className={cn(
                      'flex h-4.5 w-4.5 shrink-0 items-center justify-center border rounded-xs',
                      paso.hecho
                        ? 'border-pizarra bg-pizarra text-white'
                        : 'border-regla-fuerte bg-superficie',
                    )}
                  >
                    {paso.hecho && <Check size={12} strokeWidth={2.5} />}
                  </span>
                  <span
                    className={cn(
                      'flex-1 text-[13.5px]',
                      paso.hecho ? 'text-tinta-suave line-through' : 'text-tinta',
                    )}
                  >
                    {paso.paso}
                  </span>
                  {!paso.hecho && (
                    <ArrowRight size={14} strokeWidth={1.75} className="text-tinta-suave" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Ficha>

        <div className="space-y-6">
          <Ficha>
            <FichaCabecera
              titulo="Periodo activo"
              accion={<Etiqueta tono="aprobado">{periodoActivo?.codigo}</Etiqueta>}
            />
            <dl className="divide-y divide-regla">
              {[
                ['Nombre', periodoActivo?.nombre ?? '—'],
                ['Docencia', `${periodoActivo?.inicio} – ${periodoActivo?.fin}`],
                ['Inscripción', periodoActivo?.inscripcion ?? '—'],
                ['Cursos abiertos', String(periodoActivo?.cursos ?? 0)],
              ].map(([clave, valor]) => (
                <div key={clave} className="flex items-baseline gap-4 px-5 py-2.5">
                  <dt className="etiqueta-dato w-28 shrink-0 text-tinta-suave">{clave}</dt>
                  <dd className="text-[13.5px] text-tinta">{valor}</dd>
                </div>
              ))}
            </dl>
            <Link
              to="/admin/periodos"
              className="flex items-center justify-between border-t border-regla px-5 py-2.5 text-[13px] text-tinta-media hover:bg-lienzo hover:text-pizarra"
            >
              Administrar periodos
              <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          </Ficha>

          <Ficha>
            <FichaCabecera titulo="Últimos movimientos" descripcion="Registrados en la bitácora" />
            <ul>
              {bitacora.slice(0, 5).map((evento) => (
                <li
                  key={evento.id}
                  className="border-b border-regla px-5 py-3 last:border-b-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] text-tinta">
                      <span className="font-medium">{evento.actor}</span>{' '}
                      <span className="text-tinta-media">
                        {evento.accion.toLowerCase()}
                      </span>
                    </p>
                    <span className="shrink-0 font-dato text-[11px] text-tinta-suave">
                      {evento.cuando}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-dato text-[11.5px] text-tinta-suave">
                    {evento.objeto}
                  </p>
                </li>
              ))}
            </ul>
            <Link
              to="/admin/bitacora"
              className="flex items-center justify-between border-t border-regla px-5 py-2.5 text-[13px] text-tinta-media hover:bg-lienzo hover:text-pizarra"
            >
              Ver la bitácora completa
              <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          </Ficha>
        </div>
      </div>
    </div>
  )
}

function AccionRapida({
  icono: Icono,
  titulo,
  texto,
  ruta,
}: {
  icono: typeof BookOpen
  titulo: string
  texto: string
  ruta: string
}) {
  return (
    <Link
      to={ruta}
      className="group flex items-start gap-3 rounded-md border border-regla bg-superficie px-4 py-3.5 transition-colors hover:border-pizarra/40 hover:bg-pizarra-tenue"
    >
      <Icono
        size={18}
        strokeWidth={1.5}
        className="mt-0.5 shrink-0 text-tinta-suave group-hover:text-pizarra"
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-tinta">{titulo}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-tinta-suave">
          {texto}
        </span>
      </span>
    </Link>
  )
}
