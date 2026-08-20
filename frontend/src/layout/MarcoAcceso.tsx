import type { ReactNode } from 'react'
import { Marca } from '../ui/Marca'

/*
  El marco que comparten acceso, alta de cuenta, eleccion de institucion y
  onboarding. Los cuatro son la misma pantalla en momentos distintos, asi que
  el encuadre no cambia: solo el panel de la derecha.

  A la izquierda, una muestra real del producto en vez de un eslogan: un
  fragmento de libro de calificaciones. Es el objeto del que nace toda la
  interfaz, y decirlo asi ahorra el parrafo que lo explicaria.
*/

const renglones = [
  ['ISW-126-1', 'Proyecto parcial', '28/30', 'A'],
  ['ISW-115-1', 'Práctica 4', '—', '—'],
  ['ISW-132-1', 'Informe', '26/30', 'B'],
]

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
    <div className="flex min-h-screen flex-col">
      <header className="flex h-13 shrink-0 items-center justify-between bg-pizarra-fondo px-6">
        <Marca tono="claro" />
        <span className="etiqueta-dato text-white/50">
          Acceso seguro · Plataforma educativa
        </span>
      </header>

      <div className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
        <section className="reglado relative hidden flex-col justify-between bg-pizarra-fondo p-12 lg:flex">
          <div className="max-w-xl">
            <p className="etiqueta-dato text-pizarra-vivo">
              Una plataforma, muchas instituciones
            </p>
            <h1 className="mt-5 font-display text-[46px] font-bold leading-[1.04] tracking-[-0.025em] text-white">
              Las clases, las entregas y las notas en un solo registro.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60">
              Cada institución opera dentro de Educa con sus datos separados de
              las demás. Crea la tuya o entra con la cuenta que te asignaron.
            </p>
          </div>

          <table className="w-full max-w-md border-collapse">
            <thead>
              <tr>
                {['Código', 'Entrega', 'Puntos', 'Nota'].map((t) => (
                  <th
                    key={t}
                    className="etiqueta-dato border-b border-white/20 pb-2 text-left font-medium text-white/40"
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renglones.map((fila) => (
                <tr key={fila[0]} className="border-b border-white/10">
                  {fila.map((celda, i) => (
                    <td
                      key={i}
                      className="py-2.5 font-dato text-[13px] tabular-nums text-white/70"
                    >
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="flex flex-col justify-between bg-superficie px-6 py-10 sm:px-12">
          <div className="mx-auto w-full max-w-[400px] flex-1 lg:pt-12">
            <p className="etiqueta-dato text-pizarra">{entrada}</p>
            <h2 className="mt-3 font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-tinta">
              {titulo}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-tinta-media">
              {descripcion}
            </p>

            <div className="mt-8">{children}</div>

            {pie && <div className="mt-8 border-t border-regla pt-5">{pie}</div>}
          </div>

          <footer className="mx-auto mt-10 flex w-full max-w-[400px] items-center justify-between">
            <span className="etiqueta-dato text-tinta-suave">Educa v0.1</span>
            <span className="etiqueta-dato text-tinta-suave">
              República Dominicana
            </span>
          </footer>
        </section>
      </div>
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
