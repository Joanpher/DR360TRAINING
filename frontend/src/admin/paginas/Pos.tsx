import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, Plus, ReceiptText, Settings2, ShoppingCart } from 'lucide-react'
import { pedir } from '../../datos/api'
import { useConsulta, useGuardar } from '../../datos/consulta'
import { Boton } from '../../ui/Boton'
import { Buscador } from '../../ui/Buscador'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import { Etiqueta } from '../../ui/Etiqueta'
import { EstadoVacio } from '../../ui/EstadoVacio'
import { Ficha, FichaCabecera } from '../../ui/Ficha'
import { Selector } from '../../ui/Selector'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../../ui/Tabla'
import { dinero } from '../catalogo'
import type { CandidatoPos, ProductoPos, RespuestaVentasPos, VentaPos } from '../pos'
import { metodosPagoPos } from '../pos'
import { Cifras, Nota } from '../piezas'

export function Pos() {
  const ventas = useConsulta<RespuestaVentasPos>('/pos/ventas')
  const productos = useConsulta<{ productos: ProductoPos[] }>('/pos/productos')
  const operacion = useGuardar()
  const [nueva, setNueva] = useState(false)
  const [editandoProducto, setEditandoProducto] = useState(false)
  const [cobrar, setCobrar] = useState<VentaPos | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase()
    if (!q) return ventas.datos?.ventas ?? []
    return (ventas.datos?.ventas ?? []).filter((v) =>
      [v.numero, v.estudiante, v.matricula, v.curso, v.codigoCurso]
        .some((x) => x?.toLocaleLowerCase().includes(q)),
    )
  }, [busqueda, ventas.datos])
  const producto = productos.datos?.productos.find((p) => p.tipo === 'certificado')

  async function anular(venta: VentaPos) {
    const motivo = window.prompt(`Motivo para anular la venta #${venta.numero}:`)
    if (!motivo?.trim()) return
    const resultado = await operacion.guardar(() => pedir(`/pos/ventas/${venta.id}/anular`, { metodo: 'POST', cuerpo: { motivo } }))
    if (resultado) await ventas.recargar()
  }

  return (
    <div className="space-y-6">
      <EncabezadoPaginaPos alCrear={() => setNueva(true)} />
      <Ficha>
        <Cifras datos={[
          { etiqueta: 'Ventas cobradas', valor: String(ventas.datos?.resumen.pagadas ?? 0), pie: 'Certificados saldados' },
          { etiqueta: 'Pendientes', valor: String(ventas.datos?.resumen.pendientes ?? 0), pie: 'Con balance abierto', alerta: (ventas.datos?.resumen.pendientes ?? 0) > 0 },
          { etiqueta: 'Ingresos', valor: dinero(ventas.datos?.resumen.cobrado ?? '0'), pie: 'Ventas pagadas' },
          { etiqueta: 'Precio certificado', valor: producto ? dinero(producto.precio, producto.moneda) : '—', pie: producto?.activo ? 'Producto activo' : 'Producto inactivo' },
        ]} />
      </Ficha>

      <Ficha>
        <FichaCabecera
          titulo="Caja de certificados"
          descripcion="Cada ticket corresponde a un estudiante y uno de sus cursos"
          accion={<Boton tamano="sm" variante="fantasma" iconoIzq={<Settings2 size={14} />} onClick={() => setEditandoProducto(true)}>Configurar precio</Boton>}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-regla px-4 py-3">
          <Buscador valor={busqueda} alCambiar={setBusqueda} placeholder="Ticket, estudiante, matrícula o curso" className="w-full max-w-md" />
          <span className="font-dato text-[11px] text-tinta-suave">{filtradas.length} ventas</span>
        </div>
        {operacion.error && <div className="border-b border-regla p-4"><Nota tono="error">{operacion.error}</Nota></div>}
        {!ventas.datos ? (
          <div className="p-5"><Nota tono={ventas.error ? 'error' : 'aviso'}>{ventas.error ?? 'Cargando ventas…'}</Nota></div>
        ) : filtradas.length === 0 ? (
          <EstadoVacio icono={ReceiptText} titulo="No hay ventas" texto="Abre una venta, busca al estudiante y selecciona el curso de su certificado." />
        ) : (
          <Tabla>
            <Encabezado><Th>Ticket</Th><Th>Estudiante / curso</Th><Th>Fecha</Th><Th className="text-right">Total</Th><Th className="text-right">Saldo</Th><Th>Estado</Th><Th /></Encabezado>
            <tbody>
              {filtradas.map((v) => (
                <Fila key={v.id}>
                  <TdDato className="text-pizarra">#{v.numero.padStart(6, '0')}</TdDato>
                  <Td><p className="font-medium text-tinta">{v.estudiante}</p><p className="mt-0.5 text-[12px] text-tinta-suave"><span className="font-dato">{v.codigoCurso}</span> · {v.curso}</p></Td>
                  <TdDato className="text-tinta-suave">{new Date(v.creadoEn).toLocaleDateString('es-DO')}</TdDato>
                  <TdDato className="text-right">{dinero(v.total, v.moneda)}</TdDato>
                  <TdDato className={Number(v.saldo) > 0 ? 'text-right text-correccion' : 'text-right text-tinta-suave'}>{dinero(v.saldo, v.moneda)}</TdDato>
                  <Td><EstadoVenta estado={v.estado} /></Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      {v.estado === 'pendiente' && <Boton tamano="sm" variante="secundario" onClick={() => setCobrar(v)}>Cobrar saldo</Boton>}
                      {v.estado === 'pagada' && <Link to="/admin/certificados" className="inline-flex h-8 items-center rounded-sm px-3 text-[13px] font-medium text-pizarra hover:bg-pizarra-tenue">Certificado</Link>}
                      {v.estado !== 'anulada' && <button type="button" onClick={() => void anular(v)} className="px-2 text-[12px] text-tinta-suave hover:text-correccion">Anular</button>}
                    </div>
                  </Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        )}
      </Ficha>

      {nueva && producto && <DialogoVenta producto={producto} alCerrar={() => setNueva(false)} alGuardar={async () => { setNueva(false); await ventas.recargar() }} />}
      {cobrar && <DialogoCobro venta={cobrar} alCerrar={() => setCobrar(null)} alGuardar={async () => { setCobrar(null); await ventas.recargar() }} />}
      {editandoProducto && producto && <DialogoProducto producto={producto} alCerrar={() => setEditandoProducto(false)} alGuardar={async () => { setEditandoProducto(false); await productos.recargar() }} />}
    </div>
  )
}

function EncabezadoPaginaPos({ alCrear }: { alCrear: () => void }) {
  return <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-[26px] font-bold tracking-[-0.02em] text-tinta">POS</h1><p className="mt-1.5 max-w-2xl text-[13.5px] text-tinta-media">Vende y cobra certificados sin mezclar el dinero con la inscripción del curso.</p></div><Boton variante="primario" iconoIzq={<Plus size={16} />} onClick={alCrear}>Nueva venta</Boton></header>
}

function EstadoVenta({ estado }: { estado: VentaPos['estado'] }) {
  if (estado === 'pagada') return <Etiqueta tono="aprobado">Pagada</Etiqueta>
  if (estado === 'pendiente') return <Etiqueta tono="aviso">Pendiente</Etiqueta>
  return <Etiqueta>Cancelada</Etiqueta>
}

function DialogoVenta({ producto, alCerrar, alGuardar }: { producto: ProductoPos; alCerrar: () => void; alGuardar: () => Promise<void> }) {
  const candidatos = useConsulta<{ candidatos: CandidatoPos[] }>('/pos/candidatos')
  const guardado = useGuardar()
  const [buscar, setBuscar] = useState('')
  const [seleccion, setSeleccion] = useState<CandidatoPos | null>(null)
  const [metodo, setMetodo] = useState('efectivo')
  const [monto, setMonto] = useState(producto.precio)
  const [referencia, setReferencia] = useState('')
  const disponibles = (candidatos.datos?.candidatos ?? []).filter((c) => {
    const q = buscar.trim().toLocaleLowerCase()
    return !c.ventaId && !c.certificadoId && (!q || [c.estudiante, c.matricula, c.curso, c.codigoCurso].some((x) => x?.toLocaleLowerCase().includes(q)))
  })
  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!seleccion) return
    const r = await guardado.guardar(() => pedir('/pos/ventas', { metodo: 'POST', cuerpo: { inscripcionId: seleccion.inscripcionId, productoId: producto.id, montoRecibido: Number(monto), metodo, referencia } }))
    if (r) await alGuardar()
  }
  return <Dialogo abierto alCerrar={alCerrar} titulo="Nueva venta" descripcion="Selecciona primero a la persona y el curso que realmente le pertenece." ancho="lg">
    <form onSubmit={(e) => void enviar(e)} className="space-y-5">
      <div><p className="etiqueta-dato mb-2 text-tinta">1 · Estudiante y curso</p><Buscador valor={buscar} alCambiar={setBuscar} placeholder="Buscar por nombre, matrícula o curso" /></div>
      <div className="max-h-56 overflow-y-auto rounded-sm border border-regla">
        {disponibles.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-tinta-suave">No hay inscripciones disponibles para esta búsqueda.</p> : disponibles.map((c) => <button key={c.inscripcionId} type="button" onClick={() => setSeleccion(c)} className={`flex w-full items-center gap-3 border-b border-regla px-4 py-3 text-left last:border-0 ${seleccion?.inscripcionId === c.inscripcionId ? 'bg-pizarra-tenue' : 'hover:bg-lienzo'}`}><span className="flex h-9 w-9 items-center justify-center rounded-sm bg-lienzo text-pizarra"><ShoppingCart size={16} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium text-tinta">{c.estudiante}</span><span className="block truncate text-[12px] text-tinta-suave">{c.matricula ?? 'Sin matrícula'} · <span className="font-dato">{c.codigoCurso}</span> {c.curso}</span></span><Etiqueta tono={c.estadoInscripcion === 'completada' ? 'aprobado' : 'aviso'}>{c.estadoInscripcion === 'completada' ? 'Completado' : 'En curso'}</Etiqueta></button>)}
      </div>
      {seleccion && <div className="rounded-sm border border-pizarra/25 bg-pizarra-tenue px-4 py-3 text-[13px]"><strong>{producto.nombre}</strong><span className="float-right font-dato font-semibold">{dinero(producto.precio, producto.moneda)}</span><p className="mt-1 text-tinta-media">{seleccion.estudiante} · {seleccion.curso}</p></div>}
      <div className="grid gap-4 sm:grid-cols-3"><Campo etiqueta="Monto recibido" type="number" step="0.01" min="0" max={producto.precio} value={monto} onChange={(e) => setMonto(e.target.value)} /><Selector etiqueta="Método" value={metodo} onChange={(e) => setMetodo(e.target.value)} opciones={metodosPagoPos} /><Campo etiqueta="Referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Opcional" /></div>
      {guardado.error && <Nota tono="error">{guardado.error}</Nota>}
      <div className="flex justify-end gap-2"><Boton type="button" variante="fantasma" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" variante="primario" disabled={!seleccion || guardado.guardando} iconoIzq={<Banknote size={16} />}>{guardado.guardando ? 'Procesando…' : Number(monto) === Number(producto.precio) ? 'Cobrar y cerrar' : 'Registrar abono'}</Boton></div>
    </form>
  </Dialogo>
}

function DialogoCobro({ venta, alCerrar, alGuardar }: { venta: VentaPos; alCerrar: () => void; alGuardar: () => Promise<void> }) {
  const guardado = useGuardar(); const [monto, setMonto] = useState(venta.saldo); const [metodo, setMetodo] = useState('efectivo'); const [referencia, setReferencia] = useState('')
  async function enviar(e: FormEvent) { e.preventDefault(); const r = await guardado.guardar(() => pedir(`/pos/ventas/${venta.id}/pagos`, { metodo: 'POST', cuerpo: { monto: Number(monto), metodo, referencia } })); if (r) await alGuardar() }
  return <Dialogo abierto alCerrar={alCerrar} titulo={`Cobrar ticket #${venta.numero}`} descripcion={`${venta.estudiante} · ${venta.curso}`}><form onSubmit={(e) => void enviar(e)} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Campo etiqueta="Monto" type="number" min="0.01" step="0.01" max={venta.saldo} value={monto} onChange={(e) => setMonto(e.target.value)} /><Selector etiqueta="Método" value={metodo} onChange={(e) => setMetodo(e.target.value)} opciones={metodosPagoPos} /><Campo etiqueta="Referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} /></div>{guardado.error && <Nota tono="error">{guardado.error}</Nota>}<div className="flex justify-end gap-2"><Boton type="button" variante="fantasma" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" variante="primario" disabled={guardado.guardando}>Registrar pago</Boton></div></form></Dialogo>
}

function DialogoProducto({ producto, alCerrar, alGuardar }: { producto: ProductoPos; alCerrar: () => void; alGuardar: () => Promise<void> }) {
  const guardado = useGuardar(); const [precio, setPrecio] = useState(producto.precio); const [nombre, setNombre] = useState(producto.nombre)
  async function enviar(e: FormEvent) { e.preventDefault(); const r = await guardado.guardar(() => pedir(`/pos/productos/${producto.id}`, { metodo: 'PATCH', cuerpo: { nombre, precio: Number(precio) } })); if (r) await alGuardar() }
  return <Dialogo abierto alCerrar={alCerrar} titulo="Configurar certificado" descripcion="El nuevo precio se aplica solo a ventas futuras."><form onSubmit={(e) => void enviar(e)} className="space-y-4"><Campo etiqueta="Nombre en el ticket" value={nombre} onChange={(e) => setNombre(e.target.value)} required /><Campo etiqueta={`Precio (${producto.moneda})`} type="number" min="0" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} required />{guardado.error && <Nota tono="error">{guardado.error}</Nota>}<div className="flex justify-end gap-2"><Boton type="button" variante="fantasma" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" variante="primario" disabled={guardado.guardando}>Guardar precio</Boton></div></form></Dialogo>
}
