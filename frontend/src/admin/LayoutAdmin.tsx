import { Outlet } from 'react-router-dom'
import { BarraIdentidad } from '../layout/BarraIdentidad'
import { NavegacionAdmin } from './NavegacionAdmin'

/*
  El marco del panel de administracion.

  Comparte la banda de identidad con el resto de la plataforma -quien eres y en
  que institucion estas no cambia por entrar aqui- y todo lo demas es propio:
  barra lateral en vez de navegacion horizontal, y sin la columna de "lo
  proximo". Un administrador no viene a ver que tiene encima hoy; viene a
  cambiar como funciona la institucion.
*/
export function LayoutAdmin() {
  return (
    <div className="min-h-screen">
      <BarraIdentidad inicio="/admin" buscar="Buscar personas, cursos o programas" />

      <div className="flex">
        <NavegacionAdmin />
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
