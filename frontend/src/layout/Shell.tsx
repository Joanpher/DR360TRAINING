import { Outlet, useLocation } from 'react-router-dom'
import { BarraIdentidad } from './BarraIdentidad'
import { NavegacionPrincipal } from './NavegacionPrincipal'
import { PanelProximo } from './PanelProximo'

export function Shell() {
  const { pathname } = useLocation()

  /* Dentro de un curso el contenido manda: la agenda cede el ancho. */
  const conPanel = !/^\/cursos\/.+/.test(pathname)

  return (
    <div className="min-h-screen">
      <BarraIdentidad />
      <NavegacionPrincipal />

      <div className="mx-auto flex w-full max-w-[1500px] gap-8 px-6 py-7">
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
        {conPanel && <PanelProximo />}
      </div>
    </div>
  )
}
