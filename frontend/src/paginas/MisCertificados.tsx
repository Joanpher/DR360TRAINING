import { Link } from 'react-router-dom'
import {
  Award,
  BadgeCheck,
  CalendarDays,
  Clock,
  Printer,
  ShieldOff,
} from 'lucide-react'
import { useConsulta } from '../datos/consulta'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Etiqueta } from '../ui/Etiqueta'
import { Ficha } from '../ui/Ficha'
import { cn } from '../ui/cn'
import { fondoRotulador, rotuladorDe, textoRotulador } from '../ui/rotulador'
import type { MiCertificado } from '../portal/certificados'
import { Nota } from '../admin/piezas'

/*
  Los certificados del estudiante.

  Aquí solo aparece lo que ya está pagado y emitido, y no hace falta filtrar por
  ello: el certificado no existe hasta que la venta está saldada, así que la
  lista vacía y "todavía no has comprado ninguno" son la misma cosa. Por eso
  esta pantalla no habla de precios ni de saldos: comprar se hace en el centro,
  aquí solo se recoge.

  Un certificado revocado se sigue mostrando, tachado y con su motivo. Que
  desapareciera sin más dejaría a la persona creyendo que lo perdió.
*/
export function MisCertificados() {
  const { datos, cargando, error } = useConsulta<{ certificados: MiCertificado[] }>(
    '/portal/certificados',
  )
  const certificados = datos?.certificados ?? []
  const vigentes = certificados.filter((c) => c.estado === 'emitido')

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-rotulador-ambar-tenue text-rotulador-ambar">
            <Award size={22} strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-tinta">
              Mis certificados
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-tinta-media">
              {vigentes.length > 0
                ? `Tienes ${vigentes.length} certificado${vigentes.length > 1 ? 's' : ''} disponible${vigentes.length > 1 ? 's' : ''} para ver, imprimir o guardar en PDF.`
                : 'Aquí aparecerán los certificados de los cursos que hayas completado.'}
            </p>
          </div>
        </div>
      </header>

      {cargando && !datos ? (
        <Ficha>
          <div className="p-5">
            <Nota tono="aviso">Cargando tus certificados…</Nota>
          </div>
        </Ficha>
      ) : error ? (
        <Ficha>
          <div className="p-5">
            <Nota tono="error">{error}</Nota>
          </div>
        </Ficha>
      ) : certificados.length === 0 ? (
        <Ficha>
          <EstadoVacio
            icono={Award}
            color="ambar"
            titulo="Todavía no tienes ningún certificado"
            texto="El certificado se emite cuando terminas el curso y lo adquieres en el centro. En cuanto esté listo, lo verás aquí para imprimirlo."
          />
        </Ficha>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {certificados.map((certificado) => (
            <li key={certificado.id}>
              <Tarjeta certificado={certificado} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Tarjeta({ certificado }: { certificado: MiCertificado }) {
  const revocado = certificado.estado === 'revocado'
  const color = revocado ? 'coral' : rotuladorDe(certificado.codigoCurso)
  const emitido = new Date(certificado.emitidoEn).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Ficha className={cn('h-full overflow-hidden', !revocado && 'tarjeta-viva')}>
      {/* La franja de color es lo que hace que dos certificados apilados se
          distingan antes de leer el nombre del curso. */}
      <span
        className={cn(
          'block h-1',
          revocado ? 'bg-correccion' : 'bg-linear-to-r from-pizarra to-pizarra-vivo',
        )}
      />
      <div className="flex items-start gap-3.5 p-5">
        <span
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-md',
            fondoRotulador[color],
            textoRotulador[color],
          )}
        >
          {revocado ? (
            <ShieldOff size={24} strokeWidth={1.75} />
          ) : (
            <Award size={24} strokeWidth={1.75} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2
                className={cn(
                  'text-[15.5px] font-semibold leading-snug text-tinta',
                  revocado && 'line-through decoration-correccion/60',
                )}
              >
                {certificado.curso}
              </h2>
              <p className="mt-0.5 font-dato text-[11.5px] text-pizarra">
                {certificado.codigoCurso}
              </p>
            </div>
            <Etiqueta tono={revocado ? 'correccion' : 'documento'}>
              {revocado ? 'Revocado' : 'Vigente'}
            </Etiqueta>
          </div>

          <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
            <Dato icono={CalendarDays} etiqueta="Emitido" valor={emitido} />
            <Dato
              icono={BadgeCheck}
              etiqueta="Número"
              valor={`N.º ${certificado.numero.padStart(6, '0')}`}
            />
            {certificado.duracionHoras && (
              <Dato
                icono={Clock}
                etiqueta="Duración"
                valor={`${Number(certificado.duracionHoras)} horas`}
              />
            )}
            {certificado.calificacion && (
              <Dato
                icono={Award}
                etiqueta="Calificación"
                valor={String(Number(certificado.calificacion))}
              />
            )}
          </dl>

          {revocado ? (
            <p className="mt-4 rounded-sm border border-rotulador-coral-borde bg-correccion-tenue px-3 py-2 text-[12.5px] leading-relaxed text-correccion">
              {certificado.motivoRevocacion
                ? `Este certificado fue revocado: ${certificado.motivoRevocacion}`
                : 'Este certificado fue revocado. Consulta en el centro.'}
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                to={`/certificados/${certificado.id}`}
                className="inline-flex h-9 items-center gap-2 rounded-sm border border-transparent bg-linear-to-b from-pizarra to-[#0046d4] px-4 text-[13px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_16px_-8px_rgba(0,85,252,0.9)] transition-all hover:from-[#0d61ff] hover:to-pizarra"
              >
                <Printer size={15} strokeWidth={2} />
                Ver e imprimir
              </Link>
              <span className="font-dato text-[11px] text-tinta-suave">
                Verificación {certificado.codigoVerificacion}
              </span>
            </div>
          )}
        </div>
      </div>
    </Ficha>
  )
}

function Dato({
  icono: Icono,
  etiqueta,
  valor,
}: {
  icono: typeof Award
  etiqueta: string
  valor: string
}) {
  return (
    <div className="flex items-start gap-2">
      <Icono size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-tinta-suave" />
      <div className="min-w-0">
        <dt className="text-[11px] text-tinta-suave">{etiqueta}</dt>
        <dd className="truncate font-medium text-tinta">{valor}</dd>
      </div>
    </div>
  )
}
