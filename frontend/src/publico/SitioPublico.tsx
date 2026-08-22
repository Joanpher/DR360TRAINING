import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Marca } from '../ui/Marca'
import { cn } from '../ui/cn'

const enlaces = [
  ['Producto', '/producto'],
  ['Soluciones', '/soluciones'],
  ['Seguridad', '/seguridad'],
  ['Nosotros', '/nosotros'],
] as const

export function SitioPublico() {
  const [menu, setMenu] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setMenu(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
    const titulos: Record<string, string> = {
      '/': 'DR360TRAINING · Plataforma académica',
      '/producto': 'Producto · DR360TRAINING',
      '/soluciones': 'Soluciones · DR360TRAINING',
      '/seguridad': 'Seguridad · DR360TRAINING',
      '/nosotros': 'Nosotros · DR360TRAINING',
    }
    document.title = titulos[pathname] ?? 'DR360TRAINING'
  }, [pathname])

  useEffect(() => {
    const elementos = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const observador = new IntersectionObserver(
      (entradas) => entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('revelado')
          observador.unobserve(entrada.target)
        }
      }),
      { threshold: 0.12 },
    )
    elementos.forEach((elemento) => observador.observe(elemento))
    return () => observador.disconnect()
  }, [pathname])

  return (
    <div className="min-h-screen bg-lienzo text-tinta">
      <header className="sticky top-0 z-50 border-b border-regla bg-lienzo/95 backdrop-blur-md">
        <div className="mx-auto flex h-[78px] max-w-[1200px] items-center px-5 sm:px-8">
          <Link to="/" aria-label="DR360TRAINING, inicio"><Marca tono="oscuro" className="[&_img]:h-12" /></Link>
          <nav className="mx-auto hidden items-center gap-1 md:flex" aria-label="Navegación principal">
            {enlaces.map(([etiqueta, ruta]) => (
              <NavLink key={ruta} to={ruta} className={({ isActive }) => cn(
                'relative px-4 py-2 text-[13px] font-medium transition-colors after:absolute after:inset-x-4 after:-bottom-[19px] after:h-0.5 after:transition-transform',
                isActive ? 'text-pizarra after:scale-x-100 after:bg-pizarra' : 'text-tinta-media after:scale-x-0 after:bg-pizarra hover:text-tinta hover:after:scale-x-100',
              )}>{etiqueta}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/acceso" className="hidden px-3 py-2 text-[13px] font-semibold text-tinta hover:text-pizarra sm:block">Entrar</Link>
            <Link to="/crear-cuenta" className="publico-boton inline-flex h-10 items-center gap-2 bg-pizarra px-4 text-[13px] font-semibold text-white">Empezar <ArrowRight size={14} /></Link>
            <button onClick={() => setMenu((valor) => !valor)} className="flex h-10 w-10 items-center justify-center md:hidden" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menu}>
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        <div className={cn('overflow-hidden border-t border-regla bg-white transition-[max-height,opacity] duration-300 md:hidden', menu ? 'max-h-96 opacity-100' : 'max-h-0 border-t-transparent opacity-0')}>
          <nav className="px-5 py-3" aria-label="Navegación móvil">
            {enlaces.map(([etiqueta, ruta]) => <NavLink key={ruta} to={ruta} className={({ isActive }) => cn('flex border-b border-regla py-3 text-sm font-medium last:border-0', isActive ? 'text-pizarra' : 'text-tinta-media')}>{etiqueta}</NavLink>)}
            <Link to="/acceso" className="mt-3 flex h-11 items-center justify-center border border-regla-fuerte text-sm font-semibold sm:hidden">Iniciar sesión</Link>
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="border-t border-white/10 bg-pizarra-fondo text-white">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1fr_auto_auto]">
          <div><Marca tono="claro" className="[&_img]:h-10" /><p className="mt-4 max-w-sm text-sm leading-6 text-white/50">Una plataforma académica clara para instituciones que ponen el aprendizaje primero.</p></div>
          <div><p className="etiqueta-dato text-white/35">Plataforma</p><div className="mt-4 grid gap-3 text-sm text-white/60"><Link to="/producto" className="hover:text-white">Producto</Link><Link to="/soluciones" className="hover:text-white">Soluciones</Link><Link to="/seguridad" className="hover:text-white">Seguridad</Link></div></div>
          <div><p className="etiqueta-dato text-white/35">DR360TRAINING</p><div className="mt-4 grid gap-3 text-sm text-white/60"><Link to="/nosotros" className="hover:text-white">Nosotros</Link><Link to="/acceso" className="hover:text-white">Iniciar sesión</Link><Link to="/crear-cuenta" className="hover:text-white">Crear cuenta</Link></div></div>
        </div>
        <div className="border-t border-white/10 px-5 py-5 sm:px-8"><div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-3 font-dato text-[10px] uppercase tracking-widest text-white/30"><span>© 2026 DR360TRAINING</span><span>República Dominicana</span></div></div>
      </footer>
    </div>
  )
}

export function LlamadaFinal({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <section className="bg-pizarra-tenue px-5 py-20 sm:px-8" data-reveal>
      <div className="mx-auto max-w-3xl text-center"><p className="etiqueta-dato text-pizarra">El siguiente paso</p><h2 className="mt-5 font-display text-3xl font-bold tracking-[-0.04em] sm:text-5xl">{titulo}</h2><p className="mx-auto mt-5 max-w-xl text-base leading-7 text-tinta-media">{texto}</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/crear-cuenta" className="publico-boton inline-flex h-12 items-center justify-center gap-2 bg-pizarra px-6 text-sm font-semibold text-white">Crear mi institución <ArrowRight size={16} /></Link><Link to="/acceso" className="inline-flex h-12 items-center justify-center border border-regla-fuerte bg-white/55 px-6 text-sm font-semibold hover:border-pizarra hover:text-pizarra">Ya tengo una cuenta</Link></div></div>
    </section>
  )
}
