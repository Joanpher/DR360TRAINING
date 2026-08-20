import { Link } from 'react-router-dom'
import { ArrowRight, Video } from 'lucide-react'
import { agenda, proximaClase, type EstadoEntrega } from '../datos/demo'
import { cn } from '../ui/cn'

const colorEstado: Record<EstadoEntrega, string> = {
  vencida: 'bg-correccion',
  pendiente: 'bg-aviso',
  entregada: 'bg-pizarra',
  calificada: 'bg-regla-fuerte',
}

/*
  "Lo proximo" responde la unica pregunta con la que la gente abre la
  plataforma: que tengo encima ahora. Por eso es una columna fija y no
  una tarjeta mas del tablero.
*/
export function PanelProximo() {
  return (
    <aside className="hidden w-[300px] shrink-0 xl:block">
      <div className="sticky top-[124px] space-y-4">
        <h2 className="etiqueta-dato text-tinta-suave">Lo próximo</h2>

        <div className="reglado bg-pizarra-fondo p-4 rounded-md">
          <p className="etiqueta-dato text-pizarra-vivo">Clase en vivo</p>
          <p className="mt-2 font-dato text-[30px] font-medium leading-none tabular-nums text-white">
            {proximaClase.faltan}
          </p>
          <p className="mt-2.5 text-[13px] leading-snug text-white/80">
            <span className="font-dato text-[12px] text-pizarra-vivo">
              {proximaClase.curso}
            </span>{' '}
            · {proximaClase.asignatura}
          </p>
          <p className="mt-0.5 text-[12px] text-white/50">
            {proximaClase.docente} · comienza {proximaClase.inicio}
          </p>
          <button className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-sm bg-white text-[13px] font-medium text-pizarra-fondo hover:bg-pizarra-vivo">
            <Video size={15} strokeWidth={1.5} />
            Entrar a la clase
          </button>
        </div>

        <div className="border border-regla bg-superficie rounded-md">
          <p className="etiqueta-dato border-b border-regla px-4 py-2.5 text-tinta-suave">
            Esta semana
          </p>
          <ul>
            {agenda.map((item) => (
              <li
                key={item.titulo}
                className="flex gap-3 border-b border-regla px-4 py-3 last:border-b-0"
              >
                <span
                  className={cn(
                    'mt-1.5 h-1.5 w-1.5 shrink-0',
                    colorEstado[item.estado],
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="font-dato text-[12px] tabular-nums text-tinta-media">
                    {item.fecha} · {item.hora}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] leading-snug text-tinta">
                    {item.titulo}
                  </p>
                  <p className="font-dato text-[11px] text-tinta-suave">
                    {item.curso}
                  </p>
                </div>
              </li>
            ))}
          </ul>
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
