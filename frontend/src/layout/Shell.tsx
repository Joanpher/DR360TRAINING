import { Outlet } from 'react-router-dom'
import { BarraIdentidad } from './BarraIdentidad'
import { NavegacionPrincipal } from './NavegacionPrincipal'
import { ProveedorPortal } from '../portal/PortalContexto'
import { useRol } from '../app/rol'

export function Shell() {
  const { rol } = useRol()

  return (
    <ProveedorPortal>
      <div className="min-h-screen">
        <BarraIdentidad buscar={rol === 'estudiante' ? 'Buscar en mis cursos' : 'Buscar cursos, tareas o personas'} />
        <NavegacionPrincipal />

        <div className="mx-auto flex w-full max-w-[1500px] gap-8 px-6 py-7">
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </ProveedorPortal>
  )
}
