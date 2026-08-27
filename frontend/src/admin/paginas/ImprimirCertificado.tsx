import { useState } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { pedir } from '../../datos/api'
import { useConsulta } from '../../datos/consulta'
import { Boton } from '../../ui/Boton'
import type { DetalleCertificado } from '../certificados'

export function ImprimirCertificado() {
  const { id = '' } = useParams()
  const { datos, cargando, error } = useConsulta<DetalleCertificado>(`/certificados/${id}`)
  const [registrando, setRegistrando] = useState(false)
  const [errorImpresion, setErrorImpresion] = useState<string | null>(null)
  async function imprimir() {
    if (!datos || datos.estado !== 'emitido') return
    setRegistrando(true)
    setErrorImpresion(null)
    try {
      await pedir(`/certificados/${datos.id}/impresiones`, { metodo: 'POST' })
      window.print()
    } catch (e) {
      setErrorImpresion(e instanceof Error ? e.message : 'No se pudo registrar la impresión.')
    } finally { setRegistrando(false) }
  }
  if (cargando) return <div className="flex min-h-screen items-center justify-center text-sm text-tinta-suave">Preparando certificado…</div>
  if (error || !datos) return <div className="flex min-h-screen flex-col items-center justify-center gap-4"><p className="text-correccion">{error ?? 'No se encontró el certificado.'}</p><Link to="/admin/certificados">Volver</Link></div>
  const fecha = new Date(datos.emitidoEn).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })
  return <main className="certificado-pagina min-h-screen bg-lienzo px-6 py-6">
    <div className="certificado-controles mx-auto mb-5 flex max-w-[1120px] flex-wrap items-center justify-between gap-3"><Link to="/admin/certificados" className="flex items-center gap-2 text-[13px] font-medium text-tinta-media hover:text-pizarra"><ArrowLeft size={15} /> Volver a certificados</Link>{errorImpresion && <p className="text-[12px] text-correccion">{errorImpresion}</p>}<Boton variante="primario" iconoIzq={<Printer size={16} />} onClick={() => void imprimir()} disabled={registrando || datos.estado !== 'emitido'}>{registrando ? 'Registrando…' : 'Imprimir / Guardar PDF'}</Boton></div>
    <article className="certificado-documento relative mx-auto flex aspect-[1.414/1] max-w-[1120px] flex-col overflow-hidden bg-white p-[7%] text-center shadow-lg">
      <div className="absolute inset-4 border-[3px] border-pizarra-fondo" /><div className="absolute inset-7 border border-pizarra-vivo" />
      <div className="relative z-10 flex h-full flex-col items-center justify-between">
        <header><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pizarra-fondo font-display text-xl font-bold text-white">{(datos.siglas ?? datos.institucion).slice(0, 3).toUpperCase()}</div><p className="mt-4 font-dato text-[12px] font-semibold uppercase tracking-[0.24em] text-pizarra">{datos.institucion}</p></header>
        <section><p className="font-display text-[clamp(18px,2vw,28px)] font-medium uppercase tracking-[0.16em] text-tinta-media">Certificado de finalización</p><p className="mt-5 text-[clamp(13px,1.3vw,18px)] text-tinta-media">Se hace constar que</p><h1 className="mx-auto mt-3 min-w-[65%] border-b border-regla-fuerte pb-3 font-display text-[clamp(30px,4vw,54px)] font-bold tracking-tight text-pizarra-fondo">{datos.estudiante}</h1><p className="mt-5 text-[clamp(13px,1.3vw,18px)] text-tinta-media">completó satisfactoriamente el curso</p><h2 className="mt-3 font-display text-[clamp(24px,3vw,42px)] font-semibold text-tinta">{datos.curso}</h2><p className="mt-2 font-dato text-[clamp(10px,1vw,14px)] text-tinta-suave">{datos.codigoCurso}{datos.duracionHoras ? ` · ${Number(datos.duracionHoras)} horas académicas` : ''}</p></section>
        <footer className="grid w-full grid-cols-3 items-end gap-6 text-[11px] text-tinta-suave"><div className="border-t border-regla-fuerte pt-2">Emitido el {fecha}</div><div><Shield codigo={datos.codigoVerificacion} /></div><div className="border-t border-regla-fuerte pt-2">Certificado N.º {datos.numero.padStart(6, '0')}</div></footer>
      </div>
      {datos.estado === 'revocado' && <div className="absolute inset-0 z-20 flex rotate-[-12deg] items-center justify-center bg-white/70 font-display text-[72px] font-bold uppercase tracking-[0.2em] text-correccion">Revocado</div>}
    </article>
  </main>
}

function Shield({ codigo }: { codigo: string }) { return <div><div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 border-pizarra text-pizarra">✓</div><p className="mt-1 font-dato text-[9px] uppercase tracking-wider">Verificación<br />{codigo}</p></div> }
