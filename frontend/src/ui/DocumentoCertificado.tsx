import { BadgeCheck } from 'lucide-react'

/*
  El certificado, dibujado una sola vez.

  Existen dos pantallas que lo imprimen -la del mostrador y la del propio
  estudiante- y son dos rutas distintas con dos permisos distintos. Lo que no
  puede haber es dos documentos: el papel que se lleva la persona tiene que
  salir igual se imprima desde donde se imprima, o el centro acaba con dos
  formatos de certificado circulando y ninguno es "el bueno".

  Por eso este componente no sabe de dónde vienen los datos ni quién los pidió.
  Recibe el documento y lo pinta. Las reglas de @media print de index.css están
  escritas contra estas dos clases -`certificado-pagina` y
  `certificado-documento`-, así que cualquier pantalla que lo use imprime bien
  sin escribir una línea de CSS.
*/

export type Documento = {
  numero: string
  codigoVerificacion: string
  estado: 'emitido' | 'revocado'
  emitidoEn: string
  estudiante: string
  curso: string
  codigoCurso: string
  duracionHoras: string | null
  institucion: string
  siglas: string | null
  matricula: string | null
  calificacion: string | null
}

export function DocumentoCertificado({ documento }: { documento: Documento }) {
  const fecha = new Date(documento.emitidoEn).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <article className="certificado-documento relative mx-auto flex aspect-[1.414/1] max-w-[1120px] flex-col overflow-hidden bg-white p-[6.5%] text-center shadow-realce">
      {/*
        Las esquinas y el doble filete son lo que hace que un rectángulo blanco
        con texto centrado parezca un documento. Van en capas absolutas para que
        el contenido siga centrándose respecto a la hoja entera y no respecto al
        hueco que dejaría un borde real.
      */}
      <div className="absolute inset-[2.2%] border-[3px] border-pizarra-fondo" />
      <div className="absolute inset-[3.6%] border border-pizarra-vivo" />
      <div className="absolute inset-[2.2%] bg-linear-to-br from-pizarra/[0.04] via-transparent to-pizarra-vivo/[0.07]" />
      <Esquina clases="left-[2.2%] top-[2.2%]" />
      <Esquina clases="right-[2.2%] top-[2.2%] rotate-90" />
      <Esquina clases="right-[2.2%] bottom-[2.2%] rotate-180" />
      <Esquina clases="left-[2.2%] bottom-[2.2%] -rotate-90" />

      <div className="relative z-10 flex h-full flex-col items-center justify-between">
        <header>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-pizarra to-pizarra-fondo font-display text-xl font-bold text-white shadow-[0_8px_20px_-8px_rgba(1,37,101,0.8)]">
            {(documento.siglas ?? documento.institucion).slice(0, 3).toUpperCase()}
          </div>
          <p className="mt-4 font-dato text-[12px] font-semibold uppercase tracking-[0.24em] text-pizarra">
            {documento.institucion}
          </p>
        </header>

        <section>
          <p className="font-display text-[clamp(18px,2vw,28px)] font-medium uppercase tracking-[0.16em] text-tinta-media">
            Certificado de finalización
          </p>
          <span className="mx-auto mt-3 block h-[3px] w-24 rounded-full bg-linear-to-r from-transparent via-pizarra-vivo to-transparent" />
          <p className="mt-5 text-[clamp(13px,1.3vw,18px)] text-tinta-media">
            Se hace constar que
          </p>
          <h1 className="mx-auto mt-3 min-w-[65%] border-b border-regla-fuerte pb-3 font-display text-[clamp(30px,4vw,54px)] font-bold tracking-tight text-pizarra-fondo">
            {documento.estudiante}
          </h1>
          <p className="mt-5 text-[clamp(13px,1.3vw,18px)] text-tinta-media">
            completó satisfactoriamente el curso
          </p>
          <h2 className="mt-3 font-display text-[clamp(24px,3vw,42px)] font-semibold text-tinta">
            {documento.curso}
          </h2>
          <p className="mt-2 font-dato text-[clamp(10px,1vw,14px)] text-tinta-suave">
            {documento.codigoCurso}
            {documento.duracionHoras
              ? ` · ${Number(documento.duracionHoras)} horas académicas`
              : ''}
            {documento.calificacion
              ? ` · Calificación ${Number(documento.calificacion)}`
              : ''}
          </p>
        </section>

        <footer className="grid w-full grid-cols-3 items-end gap-6 text-[11px] text-tinta-suave">
          <div className="border-t border-regla-fuerte pt-2">Emitido el {fecha}</div>
          <div>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-pizarra bg-pizarra-tenue text-pizarra">
              <BadgeCheck size={20} strokeWidth={2} />
            </div>
            <p className="mt-1 font-dato text-[9px] uppercase tracking-wider">
              Verificación
              <br />
              {documento.codigoVerificacion}
            </p>
          </div>
          <div className="border-t border-regla-fuerte pt-2">
            Certificado N.º {documento.numero.padStart(6, '0')}
          </div>
        </footer>
      </div>

      {/*
        Un certificado revocado se sigue pudiendo abrir, y se ve tachado. La
        alternativa -esconderlo- deja a quien lo tenía sin saber qué pasó, y a
        quien lo revocó sin poder enseñar que está revocado.
      */}
      {documento.estado === 'revocado' && (
        <div className="absolute inset-0 z-20 flex rotate-[-12deg] items-center justify-center bg-white/70 font-display text-[clamp(40px,8vw,72px)] font-bold uppercase tracking-[0.2em] text-correccion">
          Revocado
        </div>
      )}
    </article>
  )
}

/* Filigrana de esquina: dos trazos finos, nada más. */
function Esquina({ clases }: { clases: string }) {
  return (
    <span className={`absolute h-12 w-12 ${clases}`} aria-hidden>
      <span className="absolute left-3 top-3 h-[1px] w-9 bg-pizarra-vivo/70" />
      <span className="absolute left-3 top-3 h-9 w-[1px] bg-pizarra-vivo/70" />
    </span>
  )
}
