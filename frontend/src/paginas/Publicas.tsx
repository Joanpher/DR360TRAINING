import {
  BarChart3, BookOpenCheck, Building2, CalendarDays, Check,
  Database, GraduationCap, KeyRound, LayoutDashboard, LockKeyhole, MessageSquareText,
  School, ShieldCheck, Sparkles, UsersRound,
} from 'lucide-react'
import { LlamadaFinal } from '../publico/SitioPublico'

function Cabecera({
  etiqueta,
  titulo,
  texto,
  imagen,
  descripcionImagen,
  posicion = 'center',
}: {
  etiqueta: string
  titulo: string
  texto: string
  imagen: string
  descripcionImagen: string
  posicion?: string
}) {
  return (
    <section className="fondo-marca relative overflow-hidden border-b border-regla">
      <div className="trama-marca absolute -right-10 top-0 h-full w-[44%] opacity-50" aria-hidden="true" />
      <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-pizarra/10 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-14 sm:px-8 sm:py-18 lg:min-h-[590px] lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-20">
        <div className="hero-entrada max-w-2xl">
          <p className="etiqueta-dato flex items-center gap-2 text-pizarra"><span className="h-2 w-2 bg-pizarra-vivo" />{etiqueta}</p>
          <h1 className="mt-6 font-display text-[clamp(2.7rem,4.5vw,4.65rem)] font-bold leading-[0.98] tracking-[-0.055em]">{titulo}</h1>
          <p className="mt-7 max-w-xl text-[17px] leading-8 text-tinta-media">{texto}</p>
        </div>
        <div className="hero-producto relative lg:pl-5">
          <div className="absolute -bottom-5 -right-5 h-full w-[88%] bg-pizarra" aria-hidden="true" />
          <div className="absolute -left-3 -top-3 h-24 w-24 bg-pizarra-vivo" aria-hidden="true" />
          <figure className="relative overflow-hidden border border-regla-fuerte bg-white p-2 shadow-[0_28px_70px_-30px_rgba(1,37,101,0.5)]">
            <img
              src={imagen}
              alt={descripcionImagen}
              className="aspect-[3/2] w-full object-cover"
              style={{ objectPosition: posicion }}
              loading="eager"
              fetchPriority="high"
            />
          </figure>
        </div>
      </div>
    </section>
  )
}

export function ProductoPublico() {
  const bloques = [
    ['Cursos que se entienden', 'Unidades, materiales y actividades siguen el orden real de la clase.', BookOpenCheck],
    ['Agenda que prioriza', 'Cada persona sabe qué ocurre hoy, qué sigue y qué requiere atención.', CalendarDays],
    ['Evaluación transparente', 'Puntajes, categorías y progreso visibles sin hojas de cálculo paralelas.', BarChart3],
    ['Comunicación con contexto', 'Anuncios, foros y mensajes vinculados a la actividad académica.', MessageSquareText],
  ] as const
  return <main>
    <Cabecera etiqueta="Producto" titulo="Una plataforma que organiza el trabajo académico." texto="DR360TRAINING conecta las tareas cotidianas de una institución en una experiencia consistente, rápida y fácil de aprender." imagen="/images/producto-conectado.jpg" descripcionImagen="Herramientas académicas digitales conectadas alrededor de una plataforma de aprendizaje" />
    <section className="bg-lienzo" data-reveal><div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-24"><div className="grid gap-px border border-regla bg-regla md:grid-cols-2">{bloques.map(([titulo, texto, Icono], indice) => <article key={titulo} className="grupo-fila min-h-64 bg-lienzo p-7 sm:p-9"><div className="flex items-center justify-between"><Icono size={24} strokeWidth={1.4} className="text-pizarra" /><span className="font-dato text-xs text-tinta-suave">0{indice + 1}</span></div><h2 className="mt-14 font-display text-2xl font-semibold tracking-tight">{titulo}</h2><p className="mt-3 max-w-md text-sm leading-7 text-tinta-media">{texto}</p></article>)}</div></div></section>
    <section className="border-y border-regla bg-white" data-reveal><div className="mx-auto grid max-w-[1200px] lg:grid-cols-[0.85fr_1.15fr]"><div className="px-5 py-20 sm:px-8 lg:border-r lg:border-regla lg:py-24"><p className="etiqueta-dato text-pizarra">Un solo flujo</p><h2 className="mt-5 font-display text-3xl font-bold tracking-[-0.04em] sm:text-5xl">Desde la planificación hasta el resultado.</h2></div><ol className="divide-y divide-regla px-5 sm:px-8 lg:py-8 lg:pl-16">{['La institución configura su estructura académica.','El docente publica clases, recursos y actividades.','El estudiante trabaja con prioridades claras.','El progreso vuelve como información útil.'].map((paso, i) => <li key={paso} className="flex gap-5 py-6"><span className="font-dato text-xs text-pizarra">0{i + 1}</span><p className="text-base font-medium">{paso}</p></li>)}</ol></div></section>
    <LlamadaFinal titulo="Lleva el trabajo académico a un solo lugar." texto="Conoce una plataforma que respeta la forma en que tu institución enseña." />
  </main>
}

export function SolucionesPublicas() {
  const perfiles = [
    ['Estudiantes', 'Todo lo importante a la vista', 'Agenda, cursos, entregas, clases y calificaciones sin perderse entre menús.', GraduationCap, ['Prioridades diarias','Progreso visible','Acceso a materiales']],
    ['Docentes', 'Más tiempo para acompañar', 'Organización del curso, evaluación y comunicación desde el mismo contexto.', School, ['Gestión de contenidos','Seguimiento de entregas','Clases y asistencia']],
    ['Instituciones', 'Una operación bajo control', 'Personas, sedes, programas y periodos con permisos y responsabilidades claras.', Building2, ['Administración central','Estructura académica','Datos institucionales']],
  ] as const
  return <main>
    <Cabecera etiqueta="Soluciones" titulo="Una experiencia para cada rol. Una visión para todos." texto="La misma información se presenta de forma distinta según la responsabilidad de cada persona dentro de la institución." imagen="/images/comunidad-aprendizaje.jpg" descripcionImagen="Estudiantes y docente colaborando alrededor de herramientas digitales de aprendizaje" posicion="center 44%" />
    <section className="bg-pizarra-fondo text-white" data-reveal><div className="mx-auto max-w-[1200px] divide-y divide-white/15 px-5 sm:px-8">{perfiles.map(([perfil, titulo, texto, Icono, puntos], indice) => <article key={perfil} className="grid gap-8 py-14 lg:grid-cols-[80px_0.75fr_1fr] lg:items-start lg:py-20"><div className="flex h-14 w-14 items-center justify-center border border-white/20 text-pizarra-vivo"><Icono size={25} strokeWidth={1.4} /></div><div><p className="font-dato text-xs text-pizarra-vivo">0{indice + 1} · {perfil}</p><h2 className="mt-4 font-display text-3xl font-semibold tracking-tight">{titulo}</h2><p className="mt-4 max-w-md text-sm leading-7 text-white/55">{texto}</p></div><ul className="divide-y divide-white/15 border-y border-white/15">{puntos.map((punto) => <li key={punto} className="flex items-center gap-3 py-4 text-sm"><Check size={15} className="text-pizarra-vivo" />{punto}</li>)}</ul></article>)}</div></section>
    <section className="bg-white px-5 py-20 sm:px-8 lg:py-24" data-reveal><div className="mx-auto max-w-[1200px] text-center"><p className="etiqueta-dato text-pizarra">Crece contigo</p><h2 className="mx-auto mt-5 max-w-3xl font-display text-3xl font-bold tracking-[-0.04em] sm:text-5xl">Desde una facultad hasta una institución completa.</h2><p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-tinta-media">DR360TRAINING permite organizar múltiples sedes, unidades y programas sin mezclar sus responsabilidades ni perder una visión institucional.</p></div></section>
    <LlamadaFinal titulo="Dale a cada persona las herramientas correctas." texto="Construye una experiencia académica coherente para toda tu comunidad." />
  </main>
}

export function SeguridadPublica() {
  const controles = [
    ['Aislamiento institucional', 'Los datos de una organización no se mezclan con los de otra.', Database],
    ['Permisos por responsabilidad', 'Cada rol accede únicamente a las acciones y datos que necesita.', KeyRound],
    ['Sesiones protegidas', 'Credenciales, renovación de sesión y cierre se gestionan de forma segura.', LockKeyhole],
    ['Actividad auditable', 'Las acciones administrativas importantes dejan un registro verificable.', ShieldCheck],
  ] as const
  return <main>
    <Cabecera etiqueta="Seguridad" titulo="La confianza no es una función adicional." texto="La separación de datos y el control de acceso forman parte de la arquitectura de DR360TRAINING desde el primer día." imagen="/images/seguridad-institucional.jpg" descripcionImagen="Infraestructura académica y datos institucionales protegidos por una capa de seguridad" />
    <section className="bg-lienzo" data-reveal><div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:py-24"><div><div className="flex h-24 w-24 items-center justify-center bg-pizarra text-white"><ShieldCheck size={42} strokeWidth={1.25} /></div><h2 className="mt-8 font-display text-3xl font-bold tracking-[-0.04em]">Seguridad por diseño.</h2><p className="mt-4 text-sm leading-7 text-tinta-media">Controles simples de entender, difíciles de eludir y alineados con el funcionamiento real de una institución.</p></div><div className="divide-y divide-regla border-y border-regla">{controles.map(([titulo, texto, Icono]) => <article key={titulo} className="grid grid-cols-[42px_1fr] gap-4 py-6 sm:grid-cols-[42px_0.7fr_1fr]"><Icono size={21} strokeWidth={1.5} className="text-pizarra" /><h3 className="font-display text-lg font-semibold">{titulo}</h3><p className="text-sm leading-6 text-tinta-media sm:col-auto col-start-2">{texto}</p></article>)}</div></div></section>
    <section className="border-y border-regla bg-white px-5 py-20 sm:px-8" data-reveal><div className="mx-auto max-w-[900px]"><p className="etiqueta-dato text-pizarra">Principios</p><blockquote className="mt-6 font-display text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">“Quien no tiene una razón para ver un dato, no debería poder verlo.”</blockquote><p className="mt-6 max-w-2xl text-base leading-7 text-tinta-media">Ese principio guía las decisiones de acceso, separación institucional y trazabilidad de la plataforma.</p></div></section>
    <LlamadaFinal titulo="Protege la operación sin complicar el trabajo." texto="Conoce cómo DR360TRAINING mantiene separados los datos y claras las responsabilidades." />
  </main>
}

export function NosotrosPublico() {
  return <main>
    <Cabecera etiqueta="Nosotros" titulo="Tecnología educativa con criterio y cercanía." texto="Creamos DR360TRAINING para reducir la distancia entre lo que una institución necesita hacer y lo que su software le permite hacer." imagen="/images/comunidad-aprendizaje.jpg" descripcionImagen="Comunidad educativa caribeña colaborando con tecnología" posicion="center 42%" />
    <section className="bg-pizarra-fondo text-white" data-reveal><div className="mx-auto grid max-w-[1200px] lg:grid-cols-2"><div className="px-5 py-20 sm:px-8 lg:border-r lg:border-white/15 lg:py-24 lg:pr-20"><Sparkles size={27} className="text-pizarra-vivo" /><h2 className="mt-8 font-display text-3xl font-bold tracking-[-0.04em] sm:text-5xl">Diseñar menos, resolver mejor.</h2><p className="mt-6 text-base leading-8 text-white/55">No medimos el producto por la cantidad de funciones. Lo medimos por cuántas decisiones y tareas vuelve más claras.</p></div><div className="divide-y divide-white/15 px-5 sm:px-8 lg:py-10 lg:pl-20">{[['Claridad','Cada pantalla tiene una pregunta que responder.'],['Responsabilidad','Los datos y permisos reflejan el trabajo real.'],['Cercanía','Construimos para el contexto de nuestras instituciones.']].map(([titulo,texto], i) => <div key={titulo} className="py-8"><span className="font-dato text-xs text-pizarra-vivo">0{i+1}</span><h3 className="mt-3 text-lg font-semibold">{titulo}</h3><p className="mt-2 text-sm leading-6 text-white/55">{texto}</p></div>)}</div></div></section>
    <section className="bg-white px-5 py-20 sm:px-8 lg:py-24" data-reveal><div className="mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[0.8fr_1.2fr]"><div><p className="etiqueta-dato text-pizarra">Nuestra dirección</p><h2 className="mt-5 font-display text-3xl font-bold tracking-[-0.04em] sm:text-5xl">Una infraestructura común para aprender mejor.</h2></div><div className="grid gap-px border border-regla bg-regla sm:grid-cols-2">{[['Producto','Herramientas coherentes, no módulos aislados.',LayoutDashboard],['Comunidad','Decisiones informadas por quienes usan la plataforma.',UsersRound]].map(([titulo,texto,Icono]) => <article key={titulo as string} className="bg-white p-7"><Icono size={23} className="text-pizarra" /><h3 className="mt-10 font-display text-xl font-semibold">{titulo as string}</h3><p className="mt-3 text-sm leading-6 text-tinta-media">{texto as string}</p></article>)}</div></div></section>
    <LlamadaFinal titulo="Construyamos una experiencia académica más humana." texto="DR360TRAINING está lista para acompañar la siguiente etapa de tu institución." />
  </main>
}
