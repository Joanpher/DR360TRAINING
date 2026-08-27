import { useState } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { pedir } from '../datos/api'
import { useConsulta } from '../datos/consulta'
import { Boton } from '../ui/Boton'
import { DocumentoCertificado } from '../ui/DocumentoCertificado'
import type { MiCertificado } from '../portal/certificados'

/*
  El estudiante imprimiendo lo suyo. Es la misma hoja que saca el mostrador
  -mismo componente, mismas reglas de @media print- y cambia solo de dónde se
  piden los datos y a dónde vuelve el enlace de atrás.

  Va fuera del Shell, como la sala de clase: la barra de navegación alrededor de
  algo que se va a imprimir estorba en pantalla y no aporta nada en papel.
*/
export function ImprimirMiCertificado() {
  const { id = '' } = useParams()
  const { datos, cargando, error } = useConsulta<MiCertificado>(
    `/portal/certificados/${id}`,
  )
  const [registrando, setRegistrando] = useState(false)
  const [errorImpresion, setErrorImpresion] = useState<string | null>(null)

  async function imprimir() {
    if (!datos || datos.estado !== 'emitido') return
    setRegistrando(true)
    setErrorImpresion(null)
    try {
      await pedir(`/portal/certificados/${datos.id}/impresiones`, { metodo: 'POST' })
      window.print()
    } catch (e) {
      /*
        Si la anotación falla, la impresión sigue adelante. El registro es para
        el centro; el papel es de la persona, y no vale la pena negárselo por un
        apunte que no salió.
      */
      setErrorImpresion(
        e instanceof Error ? e.message : 'No se pudo registrar la impresión.',
      )
      window.print()
    } finally {
      setRegistrando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-tinta-suave">
        Preparando tu certificado…
      </div>
    )
  }

  if (error || !datos) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-correccion">{error ?? 'No se encontró el certificado.'}</p>
        <Link to="/certificados" className="text-pizarra underline-offset-4 hover:underline">
          Volver a mis certificados
        </Link>
      </div>
    )
  }

  return (
    <main className="certificado-pagina min-h-screen bg-lienzo px-6 py-6">
      <div className="certificado-controles mx-auto mb-5 flex max-w-[1120px] flex-wrap items-center justify-between gap-3">
        <Link
          to="/certificados"
          className="flex items-center gap-2 text-[13px] font-semibold text-tinta-media transition-colors hover:text-pizarra"
        >
          <ArrowLeft size={15} /> Volver a mis certificados
        </Link>
        {errorImpresion && <p className="text-[12px] text-aviso">{errorImpresion}</p>}
        <Boton
          variante="primario"
          iconoIzq={<Printer size={16} />}
          onClick={() => void imprimir()}
          disabled={registrando || datos.estado !== 'emitido'}
        >
          {registrando ? 'Preparando…' : 'Imprimir / Guardar PDF'}
        </Boton>
      </div>

      <DocumentoCertificado documento={datos} />
    </main>
  )
}
