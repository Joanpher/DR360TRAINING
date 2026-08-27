import { useState } from 'react'
import { ArrowLeft, Mail, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { pedir } from '../../datos/api'
import { useConsulta } from '../../datos/consulta'
import { Boton } from '../../ui/Boton'
import { DocumentoCertificado } from '../../ui/DocumentoCertificado'
import type { DetalleCertificado } from '../certificados'

/*
  La hoja que sale por la impresora del mostrador. El documento en sí lo dibuja
  DocumentoCertificado, compartido con la pantalla del estudiante: son dos
  rutas con dos permisos, pero tiene que ser un único papel.

  Lo que sí es propio de aquí es la barra de arriba, que no se imprime: cuántas
  veces se ha impreso y a cuántos correos se ha enviado. Ese historial es del
  centro, no del alumno.
*/
export function ImprimirCertificado() {
  const { id = '' } = useParams()
  const { datos, cargando, error } = useConsulta<DetalleCertificado>(
    `/certificados/${id}`,
  )
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
      setErrorImpresion(
        e instanceof Error ? e.message : 'No se pudo registrar la impresión.',
      )
    } finally {
      setRegistrando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-tinta-suave">
        Preparando certificado…
      </div>
    )
  }

  if (error || !datos) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-correccion">{error ?? 'No se encontró el certificado.'}</p>
        <Link
          to="/admin/certificados"
          className="text-pizarra underline-offset-4 hover:underline"
        >
          Volver a certificados
        </Link>
      </div>
    )
  }

  return (
    <main className="certificado-pagina min-h-screen bg-lienzo px-6 py-6">
      <div className="certificado-controles mx-auto mb-5 flex max-w-[1120px] flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/certificados"
          className="flex items-center gap-2 text-[13px] font-semibold text-tinta-media transition-colors hover:text-pizarra"
        >
          <ArrowLeft size={15} /> Volver a certificados
        </Link>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-3 font-dato text-[11.5px] text-tinta-suave">
            <span className="flex items-center gap-1">
              <Printer size={13} /> {datos.impresiones}
            </span>
            <span className="flex items-center gap-1">
              <Mail size={13} /> {datos.correosEnviados}
            </span>
          </span>
          {errorImpresion && <p className="text-[12px] text-correccion">{errorImpresion}</p>}
          <Boton
            variante="primario"
            iconoIzq={<Printer size={16} />}
            onClick={() => void imprimir()}
            disabled={registrando || datos.estado !== 'emitido'}
          >
            {registrando ? 'Registrando…' : 'Imprimir / Guardar PDF'}
          </Boton>
        </div>
      </div>

      <DocumentoCertificado documento={datos} />
    </main>
  )
}
