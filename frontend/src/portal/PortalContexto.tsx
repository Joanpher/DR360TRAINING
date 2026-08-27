import { useEffect, useMemo, type ReactNode } from 'react'
import type { Curso } from '../admin/catalogo'
import { useConsulta } from '../datos/consulta'
import { ContextoPortal } from './contexto'
import type { RespuestaAgenda } from './reuniones'

/*
  Cada cuanto se pregunta por las salas abiertas. Es el unico sondeo del
  sistema, y existe porque una clase que empieza no llega por ningun canal en
  vivo: sin el, el aviso de "en vivo" aparecería solo al recargar la pagina.

  Medio minuto es el equilibrio entre enterarse pronto y no hacerle una
  consulta por segundo a una base compartida. Quien esta esperando la clase
  suele tener la pantalla de Clases delante, que ademas se refresca por su
  cuenta mas a menudo.
*/
const CADA = 30_000

export function ProveedorPortal({ children }: { children: ReactNode }) {
  const cursos = useConsulta<{ cursos: Curso[] }>('/portal/cursos')
  const vivo = useConsulta<RespuestaAgenda>('/reuniones/en-vivo')

  const recargarVivo = vivo.recargar
  useEffect(() => {
    const reloj = setInterval(() => void recargarVivo(), CADA)
    return () => clearInterval(reloj)
  }, [recargarVivo])

  const valor = useMemo(
    () => ({
      cursos: cursos.datos?.cursos ?? [],
      cargando: cursos.cargando,
      error: cursos.error,
      recargar: cursos.recargar,
      enVivo: vivo.datos?.reuniones ?? [],
    }),
    [cursos.datos, cursos.cargando, cursos.error, cursos.recargar, vivo.datos],
  )

  return <ContextoPortal.Provider value={valor}>{children}</ContextoPortal.Provider>
}
