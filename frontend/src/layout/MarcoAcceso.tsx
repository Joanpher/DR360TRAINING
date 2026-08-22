import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Marca } from '../ui/Marca'

/*
  El marco compartido mantiene el acceso, el alta y el onboarding dentro de
  una misma experiencia. La columna visual comunica la marca; la derecha deja
  todo el protagonismo a la tarea que la persona vino a completar.
*/

export function MarcoAcceso({
  titulo,
  entrada,
  descripcion,
  children,
  pie,
}: {
  titulo: string
  entrada: string
  descripcion: string
  children: ReactNode
  pie?: ReactNode
}) {
  return (
    <div className="grid min-h-screen bg-lienzo lg:grid-cols-[0.92fr_1.08fr]">
      <aside className="relative hidden h-screen overflow-hidden bg-pizarra-fondo px-9 py-8 text-white lg:sticky lg:top-0 lg:flex lg:flex-col xl:px-12 xl:py-10">
        <div className="trama-marca absolute inset-0 opacity-15" aria-hidden="true" />
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-pizarra-vivo/20 blur-3xl" aria-hidden="true" />

        <Link to="/" aria-label="DR360TRAINING, inicio" className="relative w-fit">
          <Marca tono="claro" className="[&_img]:h-12" />
        </Link>

        <div className="relative my-auto py-8">
          <p className="etiqueta-dato flex items-center gap-2 text-pizarra-vivo">
            <span className="h-2 w-2 bg-pizarra-vivo" />
            Tu comunidad conectada
          </p>
          <h1 className="mt-5 max-w-xl font-display text-[clamp(2.25rem,3.4vw,3.7rem)] font-bold leading-[1.02] tracking-[-0.04em]">
            Todo tu campus, en un solo lugar.
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-7 text-white/65">
            Aprende, enseña y gestiona con una experiencia clara para toda la institución.
          </p>

          <div className="relative mt-8 max-w-[620px]">
            <div className="absolute -bottom-3 -right-3 h-full w-[82%] bg-pizarra" aria-hidden="true" />
            <div className="absolute -left-2 -top-2 h-20 w-20 bg-pizarra-vivo" aria-hidden="true" />
            <figure className="relative overflow-hidden border border-white/20 bg-white/10 p-1.5">
              <img
                src="/images/comunidad-aprendizaje.jpg"
                alt="Estudiantes y docente colaborando con herramientas digitales"
                className="aspect-[16/9] w-full object-cover object-[center_42%]"
              />
            </figure>
          </div>
        </div>

        <p className="relative text-[11px] text-white/40">
          Plataforma educativa creada en República Dominicana
        </p>
      </aside>

      <main className="fondo-marca flex min-h-screen flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12 xl:px-16">
        <header className="flex items-center justify-between lg:justify-end">
          <Link to="/" aria-label="DR360TRAINING, inicio" className="lg:hidden">
            <Marca tono="oscuro" className="[&_img]:h-11" />
          </Link>
          <span className="etiqueta-dato flex items-center gap-2 text-tinta-suave">
            <span className="h-1.5 w-1.5 rounded-full bg-pizarra-vivo ring-4 ring-pizarra-vivo/15" />
            Acceso protegido
          </span>
        </header>

        <section className="mx-auto flex w-full max-w-[500px] flex-1 items-center py-8 lg:py-10">
          <div className="w-full border border-regla bg-white p-6 shadow-[0_30px_80px_-45px_rgba(1,37,101,0.45)] sm:p-9">
            <p className="etiqueta-dato text-pizarra">{entrada}</p>
            <h2 className="mt-3 font-display text-[32px] font-bold leading-tight tracking-[-0.03em] text-tinta sm:text-[36px]">
              {titulo}
            </h2>
            <p className="mt-3 text-[14px] leading-6 text-tinta-media">
              {descripcion}
            </p>

            <div className="mt-7">{children}</div>

            {pie && <div className="mt-7 border-t border-regla pt-5">{pie}</div>}
          </div>
        </section>

        <footer className="mx-auto w-full max-w-[500px] text-center">
          <span className="text-[11px] text-tinta-suave">© 2026 DR360 Training</span>
        </footer>
      </main>
    </div>
  )
}

/* Aviso de error de formulario: un bloque, no un toast que desaparece solo. */
export function Aviso({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-sm border border-correccion/30 bg-correccion-tenue px-3 py-2 text-[13px] leading-relaxed text-correccion"
    >
      {children}
    </p>
  )
}
