import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Award, Mail, Printer, SearchCheck, ShieldCheck } from 'lucide-react'
import { pedir } from '../../datos/api'
import { useConsulta, useGuardar } from '../../datos/consulta'
import { Boton } from '../../ui/Boton'
import { Buscador } from '../../ui/Buscador'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import { EstadoVacio } from '../../ui/EstadoVacio'
import { Etiqueta } from '../../ui/Etiqueta'
import { Ficha, FichaCabecera } from '../../ui/Ficha'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../../ui/Tabla'
import type { FilaCertificado } from '../certificados'
import { Cifras, EncabezadoPagina, Nota } from '../piezas'

type Respuesta = {
  certificados: FilaCertificado[]
  resumen: { listos: number; emitidos: number; pendientesPago: number; pendientesCurso: number }
}

export function Certificados() {
  const consulta = useConsulta<Respuesta>('/certificados')
  const guardado = useGuardar()
  const [busqueda, setBusqueda] = useState('')
  const [enviar, setEnviar] = useState<FilaCertificado | null>(null)
  const filas = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase()
    if (!q) return consulta.datos?.certificados ?? []
    return (consulta.datos?.certificados ?? []).filter((f) =>
      [f.estudiante, f.matricula, f.curso, f.codigoCurso, f.numeroCertificado]
        .some((x) => x?.toLocaleLowerCase().includes(q)),
    )
  }, [busqueda, consulta.datos])

  async function emitir(fila: FilaCertificado) {
    const r = await guardado.guardar(() => pedir<{ certificado: { id: string } }>('/certificados/emitir', {
      metodo: 'POST', cuerpo: { ventaId: fila.ventaId },
    }))
    if (r) await consulta.recargar()
  }

  async function revocar(fila: FilaCertificado) {
    if (!fila.certificadoId) return
    const motivo = window.prompt(`Motivo para revocar el certificado de ${fila.estudiante}:`)
    if (!motivo?.trim()) return
    const r = await guardado.guardar(() => pedir(`/certificados/${fila.certificadoId}/revocar`, {
      metodo: 'POST', cuerpo: { motivo },
    }))
    if (r) await consulta.recargar()
  }

  return <div className="space-y-6">
    <EncabezadoPagina titulo="Certificados" descripcion="Emite, imprime y entrega certificados. La autorización nace exclusivamente de una venta saldada en el POS." />
    <Ficha><Cifras datos={[
      { etiqueta: 'Listos para emitir', valor: String(consulta.datos?.resumen.listos ?? 0), pie: 'Pagados y completados' },
      { etiqueta: 'Emitidos', valor: String(consulta.datos?.resumen.emitidos ?? 0), pie: 'Documentos vigentes' },
      { etiqueta: 'Pendientes de pago', valor: String(consulta.datos?.resumen.pendientesPago ?? 0), pie: 'Bloqueados por el POS', alerta: (consulta.datos?.resumen.pendientesPago ?? 0) > 0 },
      { etiqueta: 'Curso en progreso', valor: String(consulta.datos?.resumen.pendientesCurso ?? 0), pie: 'Pagados, aún no elegibles' },
    ]} /></Ficha>
    <Ficha>
      <FichaCabecera titulo="Control de emisión" descripcion="Un certificado solo se emite una vez por inscripción" />
      <div className="border-b border-regla px-4 py-3"><Buscador valor={busqueda} alCambiar={setBusqueda} placeholder="Estudiante, matrícula, curso o número" className="max-w-md" /></div>
      {guardado.error && <div className="border-b border-regla p-4"><Nota tono="error">{guardado.error}</Nota></div>}
      {!consulta.datos ? <div className="p-5"><Nota tono={consulta.error ? 'error' : 'aviso'}>{consulta.error ?? 'Cargando certificados…'}</Nota></div>
      : filas.length === 0 ? <EstadoVacio icono={Award} titulo="No hay certificados vendidos" texto="Cuando el POS registre una venta, aparecerá aquí con su condición de pago y finalización." />
      : <Tabla><Encabezado><Th>Estudiante</Th><Th>Curso</Th><Th>Venta</Th><Th>Certificado</Th><Th>Condición</Th><Th /></Encabezado><tbody>
        {filas.map((f) => <Fila key={f.ventaId}>
          <Td><p className="font-medium text-tinta">{f.estudiante}</p><p className="mt-0.5 font-dato text-[11px] text-tinta-suave">{f.matricula ?? 'SIN MATRÍCULA'}</p></Td>
          <Td><p className="text-[13px] text-tinta">{f.curso}</p><p className="mt-0.5 font-dato text-[11px] text-pizarra">{f.codigoCurso}</p></Td>
          <TdDato><span className="text-tinta">#{f.numeroVenta.padStart(6, '0')}</span><p className={`mt-0.5 text-[11px] ${Number(f.saldo) > 0 ? 'text-correccion' : 'text-tinta-suave'}`}>{Number(f.saldo) > 0 ? `Saldo ${f.saldo}` : 'Saldada'}</p></TdDato>
          <TdDato>{f.numeroCertificado ? `N.º ${f.numeroCertificado.padStart(6, '0')}` : '—'}</TdDato>
          <Td><Condicion disponibilidad={f.disponibilidad} /></Td>
          <Td><div className="flex justify-end gap-1.5">
            {f.disponibilidad === 'listo' && <Boton tamano="sm" variante="primario" iconoIzq={<ShieldCheck size={14} />} onClick={() => void emitir(f)} disabled={guardado.guardando}>Emitir</Boton>}
            {f.disponibilidad === 'emitido' && f.certificadoId && <><Link to={`/admin/certificados/${f.certificadoId}/imprimir`} className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-regla-fuerte px-3 text-[13px] font-medium text-tinta hover:bg-lienzo"><Printer size={14} /> Imprimir</Link><Boton tamano="sm" variante="fantasma" iconoIzq={<Mail size={14} />} onClick={() => setEnviar(f)}>Correo</Boton><button type="button" onClick={() => void revocar(f)} className="px-2 text-[12px] text-tinta-suave hover:text-correccion">Revocar</button></>}
          </div></Td>
        </Fila>)}
      </tbody></Tabla>}
    </Ficha>
    {enviar && <DialogoCorreo fila={enviar} alCerrar={() => setEnviar(null)} alGuardar={async () => { setEnviar(null); await consulta.recargar() }} />}
  </div>
}

function Condicion({ disponibilidad }: { disponibilidad: FilaCertificado['disponibilidad'] }) {
  const mapa = {
    listo: { texto: 'Listo para emitir', tono: 'aprobado' }, emitido: { texto: 'Emitido', tono: 'aprobado' },
    revocado: { texto: 'Revocado', tono: 'correccion' }, pendiente_pago: { texto: 'Pago pendiente', tono: 'aviso' },
    pendiente_curso: { texto: 'Curso en progreso', tono: 'info' },
  } as const
  const dato = mapa[disponibilidad]
  return <Etiqueta tono={dato.tono}>{dato.texto}</Etiqueta>
}

function DialogoCorreo({ fila, alCerrar, alGuardar }: { fila: FilaCertificado; alCerrar: () => void; alGuardar: () => Promise<void> }) {
  const guardado = useGuardar(); const [correo, setCorreo] = useState(fila.correo ?? '')
  async function enviar(e: FormEvent) { e.preventDefault(); if (!fila.certificadoId) return; const r = await guardado.guardar(() => pedir(`/certificados/${fila.certificadoId}/correo`, { metodo: 'POST', cuerpo: { correo } })); if (r) await alGuardar() }
  return <Dialogo abierto alCerrar={alCerrar} titulo="Enviar certificado" descripcion={`${fila.estudiante} · ${fila.curso}`}><form onSubmit={(e) => void enviar(e)} className="space-y-4"><Campo etiqueta="Correo de destino" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />{guardado.error && <Nota tono="error">{guardado.error}</Nota>}<p className="flex gap-2 text-[12px] leading-relaxed text-tinta-suave"><SearchCheck size={16} className="mt-0.5 shrink-0" />El envío queda registrado con destinatario, fecha y usuario responsable.</p><div className="flex justify-end gap-2"><Boton type="button" variante="fantasma" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" variante="primario" iconoIzq={<Mail size={15} />} disabled={guardado.guardando}>{guardado.guardando ? 'Enviando…' : 'Enviar'}</Boton></div></form></Dialogo>
}

