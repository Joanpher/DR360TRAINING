import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, BookOpen, CalendarCheck, Check, Clock3, Play, UsersRound } from 'lucide-react'
import { LlamadaFinal } from '../publico/SitioPublico'

export function Landing() {
  return (
    <main>
      <section className="overflow-hidden border-b border-regla bg-[#f7f8f5]">
        <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:min-h-[650px] lg:grid-cols-[0.92fr_1.08fr] lg:py-24">
          <div className="hero-entrada">
            <p className="etiqueta-dato flex items-center gap-2 text-pizarra"><span className="h-2 w-2 bg-pizarra" />Plataforma académica integral</p>
            <h1 className="mt-6 max-w-[620px] font-display text-[clamp(2.8rem,5.5vw,5.1rem)] font-bold leading-[0.97] tracking-[-0.055em]">La educación fluye mejor cuando todo está conectado.</h1>
            <p className="mt-6 max-w-xl text-[17px] leading-8 text-tinta-media">Cursos, clases, entregas y seguimiento en una experiencia clara para estudiantes, docentes e instituciones.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/crear-cuenta" className="publico-boton inline-flex h-12 items-center justify-center gap-2 bg-pizarra px-6 text-sm font-semibold text-white">Comenzar ahora <ArrowRight size={16} /></Link>
              <Link to="/producto" className="inline-flex h-12 items-center justify-center gap-2 border border-regla-fuerte bg-white px-6 text-sm font-semibold hover:border-tinta">Ver cómo funciona</Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs text-tinta-media">{['Implementación guiada', 'Control por roles', 'Soporte cercano'].map((texto) => <span key={texto} className="flex items-center gap-2"><Check size={13} className="text-pizarra" />{texto}</span>)}</div>
          </div>
          <VistaProducto />
        </div>
      </section>

      <section className="border-b border-regla bg-white" data-reveal>
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div><p className="etiqueta-dato text-pizarra">Hecha para el día a día</p><h2 className="mt-4 max-w-md font-display text-3xl font-bold leading-tight tracking-[-0.04em] sm:text-5xl">Menos fricción. Más aprendizaje.</h2></div>
            <p className="max-w-xl self-end text-base leading-8 text-tinta-media lg:justify-self-end">DR360TRAINING organiza cada momento del proceso académico para que las personas encuentren lo que necesitan sin perder tiempo navegando sistemas distintos.</p>
          </div>
          <div className="mt-14 grid border-y border-regla md:grid-cols-3 md:divide-x md:divide-regla">
            {[
              ['01', 'Una agenda que prioriza', 'Clases y entregas ordenadas por lo que requiere atención hoy.', CalendarCheck],
              ['02', 'Progreso que se entiende', 'Indicadores simples que convierten datos en decisiones útiles.', BarChart3],
              ['03', 'Personas bien conectadas', 'Comunicación con el contexto de cada curso e institución.', UsersRound],
            ].map(([numero, titulo, texto, Icono]) => (
              <article key={numero as string} className="border-b border-regla py-8 last:border-0 md:border-0 md:px-8 md:first:pl-0 md:last:pr-0">
                <div className="flex items-center justify-between"><span className="font-dato text-xs text-tinta-suave">{numero as string}</span><Icono size={21} strokeWidth={1.5} className="text-pizarra" /></div>
                <h3 className="mt-9 font-display text-xl font-semibold">{titulo as string}</h3><p className="mt-3 text-sm leading-6 text-tinta-media">{texto as string}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#12302a] text-white" data-reveal>
        <div className="mx-auto grid max-w-[1200px] lg:grid-cols-2">
          <div className="px-5 py-20 sm:px-8 lg:border-r lg:border-white/15 lg:py-24 lg:pr-20"><p className="etiqueta-dato text-pizarra-vivo">Una visión compartida</p><h2 className="mt-5 font-display text-3xl font-bold leading-tight tracking-[-0.04em] sm:text-5xl">Cada persona ve exactamente lo que necesita.</h2><Link to="/soluciones" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-pizarra-vivo hover:text-white">Explorar soluciones <ArrowRight size={15} /></Link></div>
          <div className="divide-y divide-white/15 px-5 sm:px-8 lg:py-10 lg:pl-20">{[
            ['Estudiantes', 'Claridad sobre sus cursos, pendientes y progreso.'],
            ['Docentes', 'Herramientas para enseñar, evaluar y acompañar.'],
            ['Administración', 'Control institucional con datos separados y auditables.'],
          ].map(([titulo, texto], indice) => <div key={titulo} className="grupo-fila flex gap-5 py-7"><span className="font-dato text-xs text-pizarra-vivo">0{indice + 1}</span><div><h3 className="text-base font-semibold">{titulo}</h3><p className="mt-2 text-sm leading-6 text-white/55">{texto}</p></div></div>)}</div>
        </div>
      </section>
      <LlamadaFinal titulo="Tu comunidad merece una plataforma más clara." texto="Empieza a organizar la experiencia académica de tu institución con DR360TRAINING." />
    </main>
  )
}

function VistaProducto() {
  return (
    <div className="hero-producto relative" aria-label="Vista previa de la plataforma DR360TRAINING">
      <div className="absolute -left-5 top-10 hidden h-20 w-20 border border-[#a9b8ad] bg-[#dce8df] lg:block" />
      <div className="relative border border-[#afbbb2] bg-white shadow-[10px_10px_0_#c8d4cb]">
        <div className="flex h-12 items-center border-b border-regla bg-[#12302a] px-4 text-white"><BookOpen size={17} /><span className="ml-2 text-sm font-semibold">DR360TRAINING</span><span className="ml-auto font-dato text-[9px] uppercase tracking-widest text-white/45">Inicio</span></div>
        <div className="p-5 sm:p-7"><div className="flex items-end justify-between border-b border-regla pb-5"><div><p className="etiqueta-dato text-tinta-suave">Martes, 19 de agosto</p><p className="mt-2 font-display text-xl font-bold sm:text-2xl">Buen día, Joanpher</p></div><span className="font-dato text-xs text-pizarra">82%</span></div>
          <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_170px]"><div className="divide-y divide-regla border-y border-regla">{[
            ['08:00', 'Diseño de interfaces', 'Aula B-204'],
            ['11:30', 'Arquitectura de software', 'Clase en vivo'],
            ['15:00', 'Gestión de proyectos', 'Entrega hoy'],
          ].map(([hora, titulo, detalle]) => <div key={hora} className="flex gap-4 py-4"><span className="font-dato text-xs text-tinta-suave">{hora}</span><div><p className="text-sm font-semibold">{titulo}</p><p className="mt-1 text-xs text-tinta-media">{detalle}</p></div></div>)}</div>
            <div className="bg-[#e8eee9] p-4"><Clock3 size={18} className="text-pizarra" /><p className="etiqueta-dato mt-5 text-tinta-suave">Próxima clase</p><p className="mt-2 font-display text-2xl font-bold">24 min</p><button className="mt-5 flex h-9 w-full items-center justify-center gap-2 bg-pizarra text-xs font-semibold text-white"><Play size={13} />Entrar</button></div>
          </div>
        </div>
      </div>
    </div>
  )
}
