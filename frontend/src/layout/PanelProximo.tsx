import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { usePortal } from '../portal/contexto'
import { fechaClase, horaClase, proximasClases } from '../portal/cursoPortal'

/*
  "Lo proximo" responde la unica pregunta con la que la gente abre la
  plataforma: que tengo encima ahora. Por eso es una columna fija y no
  una tarjeta mas del tablero.
*/
export function PanelProximo() {
  const { cursos, cargando } = usePortal()
  const clases = proximasClases(cursos)
  const proxima = clases[0]

  return (
    <aside className="hidden w-[300px] shrink-0 xl:block">
      <div className="sticky top-[124px] space-y-4">
        <h2 className="etiqueta-dato text-tinta-suave">Lo próximo</h2>

        <div className="reglado bg-pizarra-fondo p-4 rounded-md">
          <p className="etiqueta-dato text-pizarra-vivo">Próxima clase</p>
          {proxima ? (
            <>
              <p className="mt-2 font-dato text-[22px] font-medium leading-tight text-white">
                {fechaClase(proxima.inicio)}
              </p>
              <p className="mt-1 font-dato text-[14px] tabular-nums text-white/70">
                {horaClase(proxima.inicio)} – {horaClase(proxima.fin)}
              </p>
              <p className="mt-3 text-[13px] leading-snug text-white/85">
                <span className="font-dato text-[12px] text-pizarra-vivo">{proxima.curso.codigo}</span>{' '}
                · {proxima.curso.nombre}
              </p>
              <p className="mt-1 text-[12px] text-white/55">
                {[proxima.curso.sede, proxima.curso.aula].filter(Boolean).join(' · ') || 'Modalidad virtual'}
              </p>
            </>
          ) : (
            <div className="py-6 text-center">
              <CalendarClock size={22} className="mx-auto text-white/45" />
              <p className="mt-2 text-[13px] text-white/65">
                {cargando ? 'Cargando horario…' : 'No hay clases programadas.'}
              </p>
            </div>
          )}
        </div>

        <div className="border border-regla bg-superficie rounded-md">
          <p className="etiqueta-dato border-b border-regla px-4 py-2.5 text-tinta-suave">
            Siguientes clases
          </p>
          {clases.length > 0 ? <ul>
            {clases.slice(0, 5).map((clase) => (
              <li
                key={clase.clave}
                className="flex gap-3 border-b border-regla px-4 py-3 last:border-b-0"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-pizarra" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-dato text-[12px] tabular-nums text-tinta-media">
                    {fechaClase(clase.inicio)} · {horaClase(clase.inicio)}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] leading-snug text-tinta">
                    {clase.curso.nombre}
                  </p>
                  <p className="font-dato text-[11px] text-tinta-suave">
                    {clase.curso.codigo}
                  </p>
                </div>
              </li>
            ))}
          </ul> : (
            <p className="px-4 py-6 text-center text-[13px] text-tinta-suave">Sin horarios próximos.</p>
          )}
          <Link
            to="/calendario"
            className="flex items-center justify-between border-t border-regla px-4 py-2.5 text-[13px] text-tinta-media hover:bg-lienzo hover:text-pizarra"
          >
            Ver calendario completo
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </aside>
  )
}
