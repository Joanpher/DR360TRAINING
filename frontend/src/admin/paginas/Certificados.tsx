import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  BadgeCheck,
  Banknote,
  BookOpen,
  ChevronLeft,
  GraduationCap,
  Mail,
  Printer,
  Receipt,
  SearchCheck,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { pedir } from '../../datos/api'
import { useConsulta, useGuardar } from '../../datos/consulta'
import { Boton } from '../../ui/Boton'
import { Buscador } from '../../ui/Buscador'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import { EstadoVacio } from '../../ui/EstadoVacio'
import { Etiqueta } from '../../ui/Etiqueta'
import { Ficha, FichaCabecera } from '../../ui/Ficha'
import { Selector } from '../../ui/Selector'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../../ui/Tabla'
import { cn } from '../../ui/cn'
import {
  fondoRotulador,
  rotuladorDe,
  textoRotulador,
} from '../../ui/rotulador'
import { dinero } from '../catalogo'
import type {
  CursoCertificado,
  DisponibilidadCertificado,
  EstudianteDeCurso,
  FilaCertificado,
  ListaDeClase,
} from '../certificados'
import { metodosPagoPos, type ProductoPos } from '../pos'
import { Cifras, EncabezadoPagina, Nota } from '../piezas'

/*
  Certificados tiene dos formas de entrar y las dos son legítimas.

  Por curso es como se trabaja de verdad: alguien llega al mostrador diciendo
  "soy del HVAC de los lunes", se busca el curso, sale la lista de clase entera
  y se cobra e imprime desde la misma fila. Es la vista por defecto porque es la
  que se usa veinte veces al día.

  Por venta es la vista contable: todos los tickets de certificado, saldados o
  no, para cuadrar la caja. Se mira una vez al día, así que va segunda.

  Las dos leen del mismo sitio y muestran el mismo estado; lo único que cambia
  es por dónde se entra.
*/

type Vista = 'cursos' | 'ventas'

export function Certificados() {
  const [vista, setVista] = useState<Vista>('cursos')

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Certificados"
        icono={Award}
        color="ambar"
        descripcion="Busca el curso, cobra el certificado e imprímelo desde la misma fila. La autorización nace siempre de una venta saldada."
        accion={
          <div className="flex rounded-sm border border-regla bg-lienzo p-1">
            <Pestana activa={vista === 'cursos'} alPulsar={() => setVista('cursos')} icono={BookOpen}>
              Por curso
            </Pestana>
            <Pestana activa={vista === 'ventas'} alPulsar={() => setVista('ventas')} icono={Receipt}>
              Por venta
            </Pestana>
          </div>
        }
      />
      {vista === 'cursos' ? <PorCurso /> : <PorVenta />}
    </div>
  )
}

function Pestana({
  activa,
  alPulsar,
  icono: Icono,
  children,
}: {
  activa: boolean
  alPulsar: () => void
  icono: typeof BookOpen
  children: string
}) {
  return (
    <button
      type="button"
      onClick={alPulsar}
      className={cn(
        'flex items-center gap-1.5 rounded-xs px-3 py-1.5 text-[13px] font-semibold transition-all',
        activa
          ? 'bg-superficie text-pizarra shadow-apoyo'
          : 'text-tinta-media hover:text-tinta',
      )}
    >
      <Icono size={14} strokeWidth={2} />
      {children}
    </button>
  )
}

/* --- Vista por curso ---------------------------------------------------- */

function PorCurso() {
  const [cursoId, setCursoId] = useState<string | null>(null)
  return cursoId ? (
    <ListaDeClaseDeCurso cursoId={cursoId} alVolver={() => setCursoId(null)} />
  ) : (
    <BuscadorDeCursos alElegir={setCursoId} />
  )
}

function BuscadorDeCursos({ alElegir }: { alElegir: (id: string) => void }) {
  const [busqueda, setBusqueda] = useState('')
  const consulta = useConsulta<{ cursos: CursoCertificado[] }>('/certificados/cursos')

  /*
    El filtro es local aunque el endpoint acepte búsqueda: sesenta cursos caben
    de sobra en memoria y filtrar mientras se teclea, sin ir al servidor por
    cada letra, es lo que hace que el buscador se sienta instantáneo.
  */
  const cursos = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase()
    const todos = consulta.datos?.cursos ?? []
    if (!q) return todos
    return todos.filter((c) =>
      [c.nombre, c.codigo, c.instructor, c.sede].some((x) =>
        x?.toLocaleLowerCase().includes(q),
      ),
    )
  }, [busqueda, consulta.datos])

  return (
    <Ficha>
      <FichaCabecera
        titulo="Buscar un curso"
        icono={BookOpen}
        color="violeta"
        descripcion="Escribe el nombre, el código, el instructor o la sede"
      />
      <div className="border-b border-regla px-4 py-3.5">
        <Buscador
          valor={busqueda}
          alCambiar={setBusqueda}
          placeholder="HVAC, ELE-102, Miguel Aybar, North Bergen…"
          className="max-w-xl"
        />
      </div>

      {!consulta.datos ? (
        <div className="p-5">
          <Nota tono={consulta.error ? 'error' : 'aviso'}>
            {consulta.error ?? 'Cargando cursos…'}
          </Nota>
        </div>
      ) : cursos.length === 0 ? (
        <EstadoVacio
          icono={BookOpen}
          color="violeta"
          titulo="Ningún curso coincide"
          texto="Prueba con otra parte del nombre, o revisa el catálogo por si el curso todavía no está creado."
        />
      ) : (
        <ul className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {cursos.map((curso) => (
            <li key={curso.id}>
              <TarjetaCurso curso={curso} alElegir={() => alElegir(curso.id)} />
            </li>
          ))}
        </ul>
      )}
    </Ficha>
  )
}

function TarjetaCurso({
  curso,
  alElegir,
}: {
  curso: CursoCertificado
  alElegir: () => void
}) {
  /* Color estable por código: el mismo curso siempre se reconoce por el mismo. */
  const color = rotuladorDe(curso.codigo)
  const porCobrar = curso.inscritos - curso.emitidos

  return (
    <button
      type="button"
      onClick={alElegir}
      className="tarjeta-viva group flex h-full w-full flex-col gap-3 rounded-md border border-regla bg-superficie p-4 text-left shadow-apoyo"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-sm transition-transform duration-200 group-hover:scale-105',
            fondoRotulador[color],
            textoRotulador[color],
          )}
        >
          <GraduationCap size={22} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-snug text-tinta">
            {curso.nombre}
          </p>
          <p className="mt-0.5 font-dato text-[11.5px] text-pizarra">{curso.codigo}</p>
        </div>
      </div>

      <p className="truncate text-[12.5px] text-tinta-media">
        {curso.instructor ?? 'Sin instructor'}
        {curso.sede ? ` · ${curso.sede}` : ''}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <Etiqueta tono="info" icono={<Users size={11} />}>
          {curso.inscritos} inscritos
        </Etiqueta>
        {curso.emitidos > 0 && (
          <Etiqueta tono="documento" icono={<Award size={11} />}>
            {curso.emitidos} emitidos
          </Etiqueta>
        )}
        {curso.pendientesPago > 0 && (
          <Etiqueta tono="aviso">{curso.pendientesPago} sin saldar</Etiqueta>
        )}
        {!curso.certificado && <Etiqueta tono="neutro">No certifica</Etiqueta>}
        {curso.certificado && porCobrar > 0 && curso.pendientesPago === 0 && (
          <Etiqueta tono="dinero">{porCobrar} por cobrar</Etiqueta>
        )}
      </div>
    </button>
  )
}

/* --- La lista de clase, que es donde se trabaja ------------------------- */

function ListaDeClaseDeCurso({
  cursoId,
  alVolver,
}: {
  cursoId: string
  alVolver: () => void
}) {
  const consulta = useConsulta<ListaDeClase>(`/certificados/cursos/${cursoId}`)
  const productos = useConsulta<{ productos: ProductoPos[] }>('/pos/productos')
  const operacion = useGuardar()
  const [cobrando, setCobrando] = useState<EstudianteDeCurso | null>(null)
  const [enviando, setEnviando] = useState<EstudianteDeCurso | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const producto = productos.datos?.productos.find((p) => p.tipo === 'certificado')
  const curso = consulta.datos?.curso
  const estudiantes = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase()
    const todos = consulta.datos?.estudiantes ?? []
    if (!q) return todos
    return todos.filter((e) =>
      [e.estudiante, e.matricula, e.correo].some((x) =>
        x?.toLocaleLowerCase().includes(q),
      ),
    )
  }, [busqueda, consulta.datos])

  const resumen = useMemo(() => {
    const todos = consulta.datos?.estudiantes ?? []
    return {
      inscritos: todos.length,
      completados: todos.filter((e) => e.estadoInscripcion === 'completada').length,
      emitidos: todos.filter((e) => e.disponibilidad === 'emitido').length,
      porCobrar: todos.filter((e) =>
        ['sin_vender', 'pendiente_pago'].includes(e.disponibilidad),
      ).length,
    }
  }, [consulta.datos])

  /*
    Marcar completado desde aquí y no obligar a ir a Inscripciones: es el paso
    que bloquea la emisión más veces, y mandarte a otra pantalla a resolverlo
    para volver es exactamente el viaje que esta pantalla existe para evitar.
  */
  async function completar(fila: EstudianteDeCurso) {
    const r = await operacion.guardar(() =>
      pedir(`/inscripciones/${fila.inscripcionId}`, {
        metodo: 'PATCH',
        cuerpo: { estado: 'completada' },
      }),
    )
    if (r) await consulta.recargar()
  }

  async function emitir(fila: EstudianteDeCurso) {
    if (!fila.ventaId) return
    const r = await operacion.guardar(() =>
      pedir('/certificados/emitir', { metodo: 'POST', cuerpo: { ventaId: fila.ventaId } }),
    )
    if (r) await consulta.recargar()
  }

  async function revocar(fila: EstudianteDeCurso) {
    if (!fila.certificadoId) return
    const motivo = window.prompt(`Motivo para revocar el certificado de ${fila.estudiante}:`)
    if (!motivo?.trim()) return
    const r = await operacion.guardar(() =>
      pedir(`/certificados/${fila.certificadoId}/revocar`, {
        metodo: 'POST',
        cuerpo: { motivo },
      }),
    )
    if (r) await consulta.recargar()
  }

  if (!consulta.datos || !curso) {
    return (
      <Ficha>
        <div className="p-5">
          <Nota tono={consulta.error ? 'error' : 'aviso'}>
            {consulta.error ?? 'Cargando la lista de clase…'}
          </Nota>
        </div>
      </Ficha>
    )
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={alVolver}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-tinta-media transition-colors hover:text-pizarra"
      >
        <ChevronLeft size={16} strokeWidth={2} />
        Volver a los cursos
      </button>

      {/* Cabecera del curso: azul de marca, para que se lea como el título de
          la pantalla y no como una fila más de la tabla. */}
      <Ficha className="overflow-hidden border-transparent">
        <div className="fondo-cabecera px-6 py-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-dato text-[11px] uppercase tracking-[0.18em] text-white/70">
                {curso.codigo}
                {curso.sede ? ` · ${curso.sede}` : ''}
              </p>
              <h2 className="mt-1.5 font-display text-[24px] font-bold leading-tight tracking-tight">
                {curso.nombre}
              </h2>
              <p className="mt-1.5 text-[13px] text-white/80">
                {curso.instructor ?? 'Sin instructor asignado'}
                {curso.duracionHoras ? ` · ${Number(curso.duracionHoras)} horas` : ''}
              </p>
            </div>
            {!curso.certificado && (
              <span className="rounded-sm bg-white/15 px-3 py-1.5 text-[12px] font-semibold">
                Este curso no entrega certificado
              </span>
            )}
          </div>
        </div>
        <Cifras
          datos={[
            {
              etiqueta: 'Inscritos',
              valor: String(resumen.inscritos),
              pie: 'Sin retiradas ni canceladas',
              icono: Users,
              color: 'azul',
            },
            {
              etiqueta: 'Completaron',
              valor: String(resumen.completados),
              pie: 'Elegibles para certificado',
              icono: GraduationCap,
              color: 'violeta',
            },
            {
              etiqueta: 'Certificados',
              valor: String(resumen.emitidos),
              pie: 'Emitidos y vigentes',
              icono: Award,
              color: 'ambar',
            },
            {
              etiqueta: 'Por cobrar',
              valor: String(resumen.porCobrar),
              pie: 'Sin vender o sin saldar',
              icono: Banknote,
              color: 'menta',
              alerta: resumen.porCobrar > 0,
            },
          ]}
        />
      </Ficha>

      <Ficha>
        <FichaCabecera
          titulo="Lista de clase"
          icono={Users}
          color="azul"
          descripcion="Cobra, emite e imprime sin salir de la fila"
          accion={
            producto && (
              <span className="font-dato text-[12px] text-tinta-media">
                Certificado ·{' '}
                <strong className="text-tinta">
                  {dinero(producto.precio, producto.moneda)}
                </strong>
              </span>
            )
          }
        />
        <div className="border-b border-regla px-4 py-3">
          <Buscador
            valor={busqueda}
            alCambiar={setBusqueda}
            placeholder="Filtrar por nombre, matrícula o correo"
            className="max-w-md"
          />
        </div>
        {operacion.error && (
          <div className="border-b border-regla p-4">
            <Nota tono="error">{operacion.error}</Nota>
          </div>
        )}

        {estudiantes.length === 0 ? (
          <EstadoVacio
            icono={Users}
            color="azul"
            titulo="Nadie inscrito todavía"
            texto="Cuando se inscriba la primera persona en este curso aparecerá aquí con su estado de pago y de certificado."
          />
        ) : (
          <Tabla>
            <Encabezado>
              <Th>Estudiante</Th>
              <Th>Curso</Th>
              <Th className="text-right">Certificado</Th>
              <Th>Situación</Th>
              <Th />
            </Encabezado>
            <tbody>
              {estudiantes.map((e) => (
                <Fila key={e.inscripcionId}>
                  <Td>
                    <p className="font-medium text-tinta">{e.estudiante}</p>
                    <p className="mt-0.5 font-dato text-[11px] text-tinta-suave">
                      {e.matricula ?? 'SIN MATRÍCULA'}
                    </p>
                  </Td>
                  <Td>
                    <EstadoDelCurso fila={e} />
                  </Td>
                  <TdDato className="text-right">
                    {e.numeroCertificado ? (
                      <span className="text-tinta">
                        N.º {e.numeroCertificado.padStart(6, '0')}
                      </span>
                    ) : e.ventaId ? (
                      <span
                        className={cn(
                          Number(e.saldoVenta) > 0 ? 'text-correccion' : 'text-tinta-suave',
                        )}
                      >
                        {Number(e.saldoVenta) > 0
                          ? `Debe ${dinero(e.saldoVenta, e.moneda ?? undefined)}`
                          : 'Pagado'}
                      </span>
                    ) : (
                      <span className="text-tinta-suave">—</span>
                    )}
                  </TdDato>
                  <Td>
                    <Condicion disponibilidad={e.disponibilidad} />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Acciones
                        fila={e}
                        certifica={curso.certificado}
                        ocupado={operacion.guardando}
                        alCobrar={() => setCobrando(e)}
                        alCompletar={() => void completar(e)}
                        alEmitir={() => void emitir(e)}
                        alEnviar={() => setEnviando(e)}
                        alRevocar={() => void revocar(e)}
                      />
                    </div>
                  </Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        )}
      </Ficha>

      {cobrando && producto && (
        <DialogoCobro
          fila={cobrando}
          producto={producto}
          alCerrar={() => setCobrando(null)}
          alGuardar={async () => {
            setCobrando(null)
            await consulta.recargar()
          }}
        />
      )}
      {enviando && (
        <DialogoCorreo
          certificadoId={enviando.certificadoId ?? ''}
          estudiante={enviando.estudiante}
          curso={curso.nombre}
          correo={enviando.correo}
          alCerrar={() => setEnviando(null)}
          alGuardar={async () => {
            setEnviando(null)
            await consulta.recargar()
          }}
        />
      )}
    </div>
  )
}

function EstadoDelCurso({ fila }: { fila: EstudianteDeCurso }) {
  const textos: Record<string, string> = {
    preinscrita: 'Preinscrita',
    activa: 'Cursando',
    completada: 'Completado',
  }
  return (
    <span className="flex items-center gap-2">
      <Etiqueta tono={fila.estadoInscripcion === 'completada' ? 'aprobado' : 'info'}>
        {textos[fila.estadoInscripcion] ?? fila.estadoInscripcion}
      </Etiqueta>
      {fila.calificacion && (
        <span className="font-dato text-[12px] text-tinta-media">
          {Number(fila.calificacion)}
        </span>
      )}
    </span>
  )
}

/*
  Los botones de una fila son siempre el siguiente paso, nunca todos los pasos.
  Enseñar "Cobrar", "Emitir" e "Imprimir" a la vez en una fila donde solo uno
  funciona convierte la tabla en un campo de minas: se pulsa el que toca por
  memoria y el sistema contesta con un error que no era necesario.
*/
function Acciones({
  fila,
  certifica,
  ocupado,
  alCobrar,
  alCompletar,
  alEmitir,
  alEnviar,
  alRevocar,
}: {
  fila: EstudianteDeCurso
  certifica: boolean
  ocupado: boolean
  alCobrar: () => void
  alCompletar: () => void
  alEmitir: () => void
  alEnviar: () => void
  alRevocar: () => void
}) {
  if (!certifica) {
    return <span className="text-[12px] text-tinta-suave">—</span>
  }

  if (fila.disponibilidad === 'emitido' && fila.certificadoId) {
    return (
      <>
        <Link
          to={`/admin/certificados/${fila.certificadoId}/imprimir`}
          className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-regla-fuerte bg-superficie px-3 text-[13px] font-semibold text-tinta shadow-[0_1px_2px_rgba(11,24,51,0.04)] transition-colors hover:border-pizarra/45 hover:bg-pizarra-tenue hover:text-pizarra"
        >
          <Printer size={14} /> Imprimir
        </Link>
        <Boton tamano="sm" variante="fantasma" iconoIzq={<Mail size={14} />} onClick={alEnviar}>
          Correo
        </Boton>
        <button
          type="button"
          onClick={alRevocar}
          className="px-2 text-[12px] text-tinta-suave transition-colors hover:text-correccion"
        >
          Revocar
        </button>
      </>
    )
  }

  if (fila.disponibilidad === 'revocado') {
    return <span className="text-[12px] text-tinta-suave">Revocado</span>
  }

  if (fila.disponibilidad === 'listo') {
    return (
      <Boton
        tamano="sm"
        variante="emitir"
        iconoIzq={<ShieldCheck size={14} />}
        onClick={alEmitir}
        disabled={ocupado}
      >
        Emitir
      </Boton>
    )
  }

  if (fila.disponibilidad === 'pendiente_curso') {
    return (
      <Boton
        tamano="sm"
        variante="secundario"
        iconoIzq={<BadgeCheck size={14} />}
        onClick={alCompletar}
        disabled={ocupado}
      >
        Marcar completado
      </Boton>
    )
  }

  return (
    <Boton
      tamano="sm"
      variante="exito"
      iconoIzq={<Banknote size={14} />}
      onClick={alCobrar}
      disabled={ocupado}
    >
      {fila.disponibilidad === 'pendiente_pago' ? 'Cobrar saldo' : 'Cobrar certificado'}
    </Boton>
  )
}

/*
  Un solo diálogo para las dos formas de cobrar. Si no hay venta abre una nueva
  -que es lo normal-, y si la hay abona sobre ella. Desde fuera es la misma
  acción y por eso se pide lo mismo: cuánto, cómo y con qué referencia.
*/
function DialogoCobro({
  fila,
  producto,
  alCerrar,
  alGuardar,
}: {
  fila: EstudianteDeCurso
  producto: ProductoPos
  alCerrar: () => void
  alGuardar: () => Promise<void>
}) {
  const guardado = useGuardar()
  const abono = Boolean(fila.ventaId)
  const total = abono ? fila.saldoVenta : producto.precio
  const [monto, setMonto] = useState(total)
  const [metodo, setMetodo] = useState('efectivo')
  const [referencia, setReferencia] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const r = await guardado.guardar(() =>
      abono
        ? pedir(`/pos/ventas/${fila.ventaId}/pagos`, {
            metodo: 'POST',
            cuerpo: { monto: Number(monto), metodo, referencia },
          })
        : pedir('/certificados/cobrar', {
            metodo: 'POST',
            cuerpo: {
              inscripcionId: fila.inscripcionId,
              montoRecibido: Number(monto),
              metodo,
              referencia,
            },
          }),
    )
    if (r) await alGuardar()
  }

  const completo = Number(monto) === Number(total)

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      titulo={abono ? 'Cobrar el saldo' : 'Cobrar el certificado'}
      descripcion={`${fila.estudiante}${fila.matricula ? ` · ${fila.matricula}` : ''}`}
    >
      <form onSubmit={(e) => void enviar(e)} className="space-y-5">
        <div className="flex items-center justify-between rounded-sm border border-rotulador-menta-borde bg-rotulador-menta-tenue px-4 py-3">
          <div>
            <p className="text-[13.5px] font-semibold text-tinta">{producto.nombre}</p>
            <p className="mt-0.5 text-[12px] text-tinta-media">
              {abono ? 'Saldo pendiente de la venta abierta' : 'Venta nueva, se cobra completa'}
            </p>
          </div>
          <span className="font-dato text-[19px] font-semibold text-rotulador-menta">
            {dinero(total, producto.moneda)}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            etiqueta="Monto recibido"
            type="number"
            step="0.01"
            min="0"
            max={total}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <Selector
            etiqueta="Método"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            opciones={metodosPagoPos}
          />
          <Campo
            etiqueta="Referencia"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Opcional"
          />
        </div>

        {/* Se dice antes de cobrar, no después de fallar: si el curso no está
            completado la emisión no va a salir, y conviene saberlo ahora. */}
        {completo && fila.estadoInscripcion !== 'completada' && (
          <Nota tono="aviso">
            Se cobrará, pero el certificado no se emite hasta marcar la inscripción como
            completada.
          </Nota>
        )}
        {completo && fila.estadoInscripcion === 'completada' && !abono && (
          <Nota tono="exito">El certificado queda emitido en el mismo paso.</Nota>
        )}
        {guardado.error && <Nota tono="error">{guardado.error}</Nota>}

        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            variante="exito"
            iconoIzq={<Banknote size={16} />}
            disabled={guardado.guardando}
          >
            {guardado.guardando ? 'Cobrando…' : completo ? 'Cobrar y cerrar' : 'Registrar abono'}
          </Boton>
        </div>
      </form>
    </Dialogo>
  )
}

/* --- Vista por venta, la de siempre ------------------------------------- */

function PorVenta() {
  const consulta = useConsulta<{
    certificados: FilaCertificado[]
    resumen: {
      listos: number
      emitidos: number
      pendientesPago: number
      pendientesCurso: number
    }
  }>('/certificados')
  const guardado = useGuardar()
  const [busqueda, setBusqueda] = useState('')
  const [enviar, setEnviar] = useState<FilaCertificado | null>(null)

  const filas = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase()
    if (!q) return consulta.datos?.certificados ?? []
    return (consulta.datos?.certificados ?? []).filter((f) =>
      [f.estudiante, f.matricula, f.curso, f.codigoCurso, f.numeroCertificado].some((x) =>
        x?.toLocaleLowerCase().includes(q),
      ),
    )
  }, [busqueda, consulta.datos])

  async function emitir(fila: FilaCertificado) {
    const r = await guardado.guardar(() =>
      pedir('/certificados/emitir', { metodo: 'POST', cuerpo: { ventaId: fila.ventaId } }),
    )
    if (r) await consulta.recargar()
  }

  async function revocar(fila: FilaCertificado) {
    if (!fila.certificadoId) return
    const motivo = window.prompt(`Motivo para revocar el certificado de ${fila.estudiante}:`)
    if (!motivo?.trim()) return
    const r = await guardado.guardar(() =>
      pedir(`/certificados/${fila.certificadoId}/revocar`, {
        metodo: 'POST',
        cuerpo: { motivo },
      }),
    )
    if (r) await consulta.recargar()
  }

  return (
    <div className="space-y-6">
      <Ficha>
        <Cifras
          datos={[
            {
              etiqueta: 'Listos para emitir',
              valor: String(consulta.datos?.resumen.listos ?? 0),
              pie: 'Pagados y completados',
              icono: ShieldCheck,
              color: 'menta',
            },
            {
              etiqueta: 'Emitidos',
              valor: String(consulta.datos?.resumen.emitidos ?? 0),
              pie: 'Documentos vigentes',
              icono: Award,
              color: 'ambar',
            },
            {
              etiqueta: 'Pendientes de pago',
              valor: String(consulta.datos?.resumen.pendientesPago ?? 0),
              pie: 'Bloqueados por el POS',
              icono: Banknote,
              color: 'coral',
              alerta: (consulta.datos?.resumen.pendientesPago ?? 0) > 0,
            },
            {
              etiqueta: 'Curso en progreso',
              valor: String(consulta.datos?.resumen.pendientesCurso ?? 0),
              pie: 'Pagados, aún no elegibles',
              icono: GraduationCap,
              color: 'violeta',
            },
          ]}
        />
      </Ficha>

      <Ficha>
        <FichaCabecera
          titulo="Control de emisión"
          icono={Receipt}
          color="cian"
          descripcion="Un certificado solo se emite una vez por inscripción"
        />
        <div className="border-b border-regla px-4 py-3">
          <Buscador
            valor={busqueda}
            alCambiar={setBusqueda}
            placeholder="Estudiante, matrícula, curso o número"
            className="max-w-md"
          />
        </div>
        {guardado.error && (
          <div className="border-b border-regla p-4">
            <Nota tono="error">{guardado.error}</Nota>
          </div>
        )}
        {!consulta.datos ? (
          <div className="p-5">
            <Nota tono={consulta.error ? 'error' : 'aviso'}>
              {consulta.error ?? 'Cargando certificados…'}
            </Nota>
          </div>
        ) : filas.length === 0 ? (
          <EstadoVacio
            icono={Award}
            color="ambar"
            titulo="No hay certificados vendidos"
            texto="Cuando el POS registre una venta, aparecerá aquí con su condición de pago y finalización."
          />
        ) : (
          <Tabla>
            <Encabezado>
              <Th>Estudiante</Th>
              <Th>Curso</Th>
              <Th>Venta</Th>
              <Th>Certificado</Th>
              <Th>Condición</Th>
              <Th />
            </Encabezado>
            <tbody>
              {filas.map((f) => (
                <Fila key={f.ventaId}>
                  <Td>
                    <p className="font-medium text-tinta">{f.estudiante}</p>
                    <p className="mt-0.5 font-dato text-[11px] text-tinta-suave">
                      {f.matricula ?? 'SIN MATRÍCULA'}
                    </p>
                  </Td>
                  <Td>
                    <p className="text-[13px] text-tinta">{f.curso}</p>
                    <p className="mt-0.5 font-dato text-[11px] text-pizarra">{f.codigoCurso}</p>
                  </Td>
                  <TdDato>
                    <span className="text-tinta">#{f.numeroVenta.padStart(6, '0')}</span>
                    <p
                      className={cn(
                        'mt-0.5 text-[11px]',
                        Number(f.saldo) > 0 ? 'text-correccion' : 'text-tinta-suave',
                      )}
                    >
                      {Number(f.saldo) > 0 ? `Saldo ${f.saldo}` : 'Saldada'}
                    </p>
                  </TdDato>
                  <TdDato>
                    {f.numeroCertificado ? `N.º ${f.numeroCertificado.padStart(6, '0')}` : '—'}
                  </TdDato>
                  <Td>
                    <Condicion disponibilidad={f.disponibilidad} />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {f.disponibilidad === 'listo' && (
                        <Boton
                          tamano="sm"
                          variante="emitir"
                          iconoIzq={<ShieldCheck size={14} />}
                          onClick={() => void emitir(f)}
                          disabled={guardado.guardando}
                        >
                          Emitir
                        </Boton>
                      )}
                      {f.disponibilidad === 'emitido' && f.certificadoId && (
                        <>
                          <Link
                            to={`/admin/certificados/${f.certificadoId}/imprimir`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-regla-fuerte bg-superficie px-3 text-[13px] font-semibold text-tinta transition-colors hover:border-pizarra/45 hover:bg-pizarra-tenue hover:text-pizarra"
                          >
                            <Printer size={14} /> Imprimir
                          </Link>
                          <Boton
                            tamano="sm"
                            variante="fantasma"
                            iconoIzq={<Mail size={14} />}
                            onClick={() => setEnviar(f)}
                          >
                            Correo
                          </Boton>
                          <button
                            type="button"
                            onClick={() => void revocar(f)}
                            className="px-2 text-[12px] text-tinta-suave transition-colors hover:text-correccion"
                          >
                            Revocar
                          </button>
                        </>
                      )}
                    </div>
                  </Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        )}
      </Ficha>

      {enviar && (
        <DialogoCorreo
          certificadoId={enviar.certificadoId ?? ''}
          estudiante={enviar.estudiante}
          curso={enviar.curso}
          correo={enviar.correo}
          alCerrar={() => setEnviar(null)}
          alGuardar={async () => {
            setEnviar(null)
            await consulta.recargar()
          }}
        />
      )}
    </div>
  )
}

function Condicion({ disponibilidad }: { disponibilidad: DisponibilidadCertificado }) {
  const mapa = {
    sin_vender: { texto: 'Sin vender', tono: 'neutro' },
    listo: { texto: 'Listo para emitir', tono: 'dinero' },
    emitido: { texto: 'Emitido', tono: 'documento' },
    revocado: { texto: 'Revocado', tono: 'correccion' },
    pendiente_pago: { texto: 'Pago pendiente', tono: 'aviso' },
    pendiente_curso: { texto: 'Curso en progreso', tono: 'info' },
  } as const
  const dato = mapa[disponibilidad]
  return <Etiqueta tono={dato.tono}>{dato.texto}</Etiqueta>
}

function DialogoCorreo({
  certificadoId,
  estudiante,
  curso,
  correo: inicial,
  alCerrar,
  alGuardar,
}: {
  certificadoId: string
  estudiante: string
  curso: string
  correo: string | null
  alCerrar: () => void
  alGuardar: () => Promise<void>
}) {
  const guardado = useGuardar()
  const [correo, setCorreo] = useState(inicial ?? '')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!certificadoId) return
    const r = await guardado.guardar(() =>
      pedir(`/certificados/${certificadoId}/correo`, { metodo: 'POST', cuerpo: { correo } }),
    )
    if (r) await alGuardar()
  }

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      titulo="Enviar certificado"
      descripcion={`${estudiante} · ${curso}`}
    >
      <form onSubmit={(e) => void enviar(e)} className="space-y-4">
        <Campo
          etiqueta="Correo de destino"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          required
        />
        {guardado.error && <Nota tono="error">{guardado.error}</Nota>}
        <p className="flex gap-2 text-[12px] leading-relaxed text-tinta-suave">
          <SearchCheck size={16} className="mt-0.5 shrink-0" />
          El envío queda registrado con destinatario, fecha y usuario responsable.
        </p>
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            variante="primario"
            iconoIzq={<Mail size={15} />}
            disabled={guardado.guardando}
          >
            {guardado.guardando ? 'Enviando…' : 'Enviar'}
          </Boton>
        </div>
      </form>
    </Dialogo>
  )
}
