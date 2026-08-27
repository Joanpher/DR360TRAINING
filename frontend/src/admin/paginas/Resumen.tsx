import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CircleAlert,
  LayoutGrid,
  ListChecks,
  MapPin,
  Rocket,
  Send,
  ShoppingCart,
  Tags,
  TriangleAlert,
  UserPlus,
  UserRoundCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { Azulejo, RejillaAzulejos } from '../../ui/Azulejo'
import { Ficha, FichaCabecera } from '../../ui/Ficha'
import { cn } from '../../ui/cn'
import { useSesion } from '../../app/sesion'
import { useConsulta } from '../../datos/consulta'
import { Cifras, EncabezadoPagina, EstadoDeInscripcion } from '../piezas'
import { dinero, fechaLegible, type Categoria, type Curso } from '../catalogo'
import type { Inscripcion } from '../inscripciones'
import { invitaciones, personas } from '../datos'

type Lista = { inscripciones: Inscripcion[]; total: number }

/*
  La primera pantalla del administrador no es un tablero de métricas bonitas: es
  una lista de lo que está pendiente. Nadie abre el panel para saber cuántos
  usuarios tiene, lo abre porque algo hay que resolver. Por eso "Hay que
  atender" va arriba y las cifras, que casi nunca cambian de un día para otro,
  van debajo como contexto.
*/
export function Resumen() {
  const { usuario, institucion } = useSesion()

  const { datos: cat } = useConsulta<{ cursos: Curso[] }>('/catalogo/cursos')
  const { datos: cats } = useConsulta<{ categorias: Categoria[] }>('/catalogo/categorias')
  const { datos: ultimas } = useConsulta<Lista>('/inscripciones?porPagina=6')
  const { datos: deudoras } = useConsulta<Lista>('/inscripciones?conDeuda=true&porPagina=1')

  const cursos = cat?.cursos ?? []
  const disponibles = cursos.filter((c) => c.estado !== 'graduado')
  const sinInstructor = cursos.filter((c) => !c.instructorMembresiaId)
  const pendientes = invitaciones.filter((i) => i.estado === 'pendiente')
  const conDeuda = deudoras?.total ?? 0

  /*
    La puesta en marcha se calcula de lo que hay de verdad en la base, no de una
    lista fija. Una checklist que sigue diciendo "pendiente" después de hacerlo,
    o "hecho" antes, deja de leerse a la semana.
  */
  const puestaEnMarcha = [
    {
      paso: 'Crear la institución',
      hecho: Boolean(institucion),
      ruta: '/admin/institucion',
    },
    {
      paso: 'Organizar el catálogo en categorías',
      hecho: (cats?.categorias.length ?? 0) > 0,
      ruta: '/admin/categorias',
    },
    {
      paso: 'Registrar a los instructores',
      hecho: cursos.some((c) => c.instructorMembresiaId),
      ruta: '/admin/personas/nueva',
    },
    {
      paso: 'Crear el primer curso',
      hecho: cursos.length > 0,
      ruta: '/admin/cursos',
    },
    {
      paso: 'Completar la programación del curso',
      hecho: cursos.some(
        (c) => c.instructorMembresiaId && c.iniciaEn && c.duracionSemanas && c.horarios.length > 0,
      ),
      ruta: '/admin/cursos',
    },
    {
      paso: 'Inscribir a la primera persona',
      hecho: (ultimas?.total ?? 0) > 0,
      ruta: '/admin/inscripciones',
    },
  ]

  const hechos = puestaEnMarcha.filter((p) => p.hecho).length
  const avance = Math.round((hechos / puestaEnMarcha.length) * 100)

  const atender = [
    sinInstructor.length > 0 && {
      texto: `${sinInstructor.length} curso${sinInstructor.length > 1 ? 's' : ''} sin instructor asignado`,
      detalle: sinInstructor.map((c) => c.codigo).join(' · '),
      ruta: '/admin/cursos',
      accion: 'Asignar',
      grave: true,
    },
    conDeuda > 0 && {
      texto: `${conDeuda} inscripci${conDeuda > 1 ? 'ones' : 'ón'} con saldo pendiente`,
      detalle: 'El cargo se generó y todavía no se ha cobrado del todo',
      ruta: '/admin/inscripciones',
      accion: 'Cobrar',
      grave: true,
    },
    pendientes.length > 0 && {
      texto: `${pendientes.length} invitaciones sin aceptar`,
      detalle: 'Caducan a los siete días de enviarse',
      ruta: '/admin/invitaciones',
      accion: 'Ver',
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
        icono={LayoutGrid}
        color="azul"
        titulo={`Buen día, ${usuario?.nombres?.split(' ')[0] ?? ''}`}
        descripcion={`Estás administrando ${institucion?.nombre ?? 'tu institución'}. ${
          disponibles.length > 0
            ? `${disponibles.length} curso${disponibles.length > 1 ? 's' : ''} disponible${disponibles.length > 1 ? 's' : ''}.`
            : 'Todavía no hay cursos disponibles.'
        }`}
      />

      {/*
        Los atajos van arriba del todo y no escondidos en la barra lateral. Son
        las ocho cosas que se hacen a diario -cobrar, inscribir, imprimir- y
        tenerlas a un clic desde la primera pantalla es la diferencia entre un
        panel que se usa y un menu que se recorre.
      */}
      <RejillaAzulejos>
        <Azulejo icono={ShoppingCart} color="menta" titulo="Cobrar en caja" pie="Vender un certificado" ruta="/admin/pos" />
        <Azulejo icono={Award} color="ambar" titulo="Certificados" pie="Buscar curso e imprimir" ruta="/admin/certificados" />
        <Azulejo icono={UserPlus} color="azul" titulo="Inscribir" pie="Matrícula y clave" ruta="/admin/inscripciones" />
        <Azulejo icono={BookOpen} color="violeta" titulo="Cursos" pie="Catálogo del centro" ruta="/admin/cursos" />
        <Azulejo icono={Users} color="cian" titulo="Usuarios" pie="Personas y roles" ruta="/admin/personas" />
        <Azulejo icono={Wallet} color="coral" titulo="Cobros pendientes" pie={`${conDeuda} con saldo`} ruta="/admin/inscripciones" />
        <Azulejo icono={Tags} color="magenta" titulo="Categorías" pie="Organizar el catálogo" ruta="/admin/categorias" />
        <Azulejo icono={MapPin} color="azul" titulo="Sedes" pie="Dónde se imparte" ruta="/admin/sedes" />
      </RejillaAzulejos>

      <Ficha>
        <FichaCabecera
          titulo="Hay que atender"
          icono={TriangleAlert}
          color="coral"
          descripcion="Lo que impide que el centro funcione del todo"
        />
        {atender.length === 0 ? (
          <p className="flex items-center gap-2.5 px-5 py-4 text-[13.5px] text-tinta-media">
            <span className="flex h-7 w-7 items-center justify-center rounded-xs bg-rotulador-menta-tenue text-rotulador-menta">
              <Check size={15} strokeWidth={2.25} />
            </span>
            Nada pendiente. Los cursos están programados y las cuentas al día.
          </p>
        ) : (
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
                  <p className="mt-0.5 truncate text-[12.5px] text-tinta-suave">{item.detalle}</p>
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
        )}
      </Ficha>

      <Ficha>
        <Cifras
          datos={[
            {
              etiqueta: 'Cursos disponibles',
              valor: String(disponibles.length),
              pie: `${cursos.length} en el catálogo`,
              icono: BookOpen,
              color: 'violeta',
            },
            {
              etiqueta: 'Inscripciones',
              valor: String(ultimas?.total ?? 0),
              pie: 'Desde que abrió el centro',
              icono: UserRoundCheck,
              color: 'azul',
            },
            {
              etiqueta: 'Con saldo pendiente',
              valor: String(conDeuda),
              pie: 'Cargos sin cobrar del todo',
              alerta: conDeuda > 0,
              icono: Wallet,
              color: 'coral',
            },
            {
              etiqueta: 'Personas',
              valor: String(personas.filter((p) => p.estado === 'activa').length),
              pie: 'Membresías activas',
              icono: Users,
              color: 'cian',
            },
          ]}
        />
      </Ficha>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Ficha>
          <FichaCabecera
            icono={UserRoundCheck}
            color="azul"
            titulo="Últimas inscripciones"
            accion={
              <Link
                to="/admin/inscripciones"
                className="text-[13px] font-medium text-pizarra underline-offset-4 hover:underline"
              >
                Ver todas
              </Link>
            }
          />
          {(ultimas?.inscripciones.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
              <UserPlus size={20} strokeWidth={1.5} className="text-tinta-suave" />
              <p className="max-w-sm text-[13px] leading-relaxed text-tinta-media">
                Todavía no se ha inscrito nadie. Al inscribir a una persona nueva el sistema le
                emite su matrícula y su clave, y genera el cargo del curso.
              </p>
              <Link
                to="/admin/inscripciones"
                className="text-[13px] font-medium text-pizarra underline-offset-4 hover:underline"
              >
                Inscribir a alguien
              </Link>
            </div>
          ) : (
            <ul>
              {ultimas?.inscripciones.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center gap-3 border-b border-regla px-5 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-tinta">{i.nombre}</p>
                    <p className="mt-0.5 truncate text-[12px] text-tinta-suave">
                      <span className="font-dato text-pizarra">{i.codigoCurso}</span> {i.curso} ·{' '}
                      {fechaLegible(i.inscritoEn)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 font-dato text-[12.5px] tabular-nums',
                      Number(i.deuda) > 0 ? 'text-correccion' : 'text-tinta-suave',
                    )}
                  >
                    {Number(i.deuda) > 0 ? dinero(i.deuda) : 'Al día'}
                  </span>
                  <EstadoDeInscripcion estado={i.estado} />
                </li>
              ))}
            </ul>
          )}
        </Ficha>

        <Ficha>
          <FichaCabecera
            titulo="Puesta en marcha"
            icono={Rocket}
            color="menta"
            descripcion={`${avance}% completado`}
          />
          {/* La barra dice de un vistazo lo que la lista dice leyendo seis
              lineas. Va aqui y no en la cabecera para no apretarla. */}
          <div className="h-1.5 w-full bg-regla">
            <div
              className="h-full bg-linear-to-r from-rotulador-menta to-pizarra-vivo transition-[width] duration-500"
              style={{ width: `${avance}%` }}
            />
          </div>
          <ul>
            {puestaEnMarcha.map((paso) => (
              <li
                key={paso.paso}
                className="flex items-center gap-3 border-b border-regla px-5 py-2.5 last:border-b-0"
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    paso.hecho
                      ? 'border-rotulador-menta bg-rotulador-menta text-white'
                      : 'border-regla-fuerte bg-superficie',
                  )}
                >
                  {paso.hecho && <Check size={11} strokeWidth={3} />}
                </span>
                <Link
                  to={paso.ruta}
                  className={cn(
                    'flex-1 text-[13px] underline-offset-4 hover:underline',
                    paso.hecho ? 'text-tinta-suave' : 'text-tinta',
                  )}
                >
                  {paso.paso}
                </Link>
              </li>
            ))}
          </ul>
        </Ficha>
      </div>

      <Ficha>
        <FichaCabecera
          titulo="El flujo, de principio a fin"
          icono={ListChecks}
          color="cian"
          descripcion="Las tres pantallas que sostienen el sistema"
        />
        <ol className="grid gap-px bg-regla sm:grid-cols-3">
          {[
            {
              icono: BookOpen,
              titulo: 'Crear el curso',
              texto: 'Precio, duración, categoría, horario, instructor e imagen.',
              ruta: '/admin/cursos',
            },
            {
              icono: UserPlus,
              titulo: 'Inscribir a alguien',
              texto: 'Se emite matrícula y clave, y se genera el cargo del curso.',
              ruta: '/admin/inscripciones',
            },
            {
              icono: Send,
              titulo: 'Cobrar y dar seguimiento',
              texto: 'Pagos, abonos parciales y estado de cada inscripción.',
              ruta: '/admin/inscripciones',
            },
          ].map((paso, i) => (
            <li key={paso.titulo} className="bg-superficie px-5 py-4">
              <span className="etiqueta-dato text-tinta-suave">Paso {i + 1}</span>
              <p className="mt-2 flex items-center gap-2 text-[13.5px] font-medium text-tinta">
                <paso.icono size={15} strokeWidth={1.75} className="text-pizarra" />
                {paso.titulo}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-tinta-suave">{paso.texto}</p>
              <Link
                to={paso.ruta}
                className="mt-2 inline-block text-[12.5px] font-medium text-pizarra underline-offset-4 hover:underline"
              >
                Ir
              </Link>
            </li>
          ))}
        </ol>
      </Ficha>
    </div>
  )
}
