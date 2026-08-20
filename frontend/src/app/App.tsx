import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {
  Calendar,
  ChartColumn,
  MessageSquare,
  UserRound,
  Video,
} from 'lucide-react'
import { Shell } from '../layout/Shell'
import { Acceso } from '../paginas/Acceso'
import { Landing } from '../paginas/Landing'
import {
  NosotrosPublico,
  ProductoPublico,
  SeguridadPublica,
  SolucionesPublicas,
} from '../paginas/Publicas'
import { SitioPublico } from '../publico/SitioPublico'
import { CrearCuenta } from '../paginas/CrearCuenta'
import { ElegirInstitucion } from '../paginas/ElegirInstitucion'
import { Onboarding } from '../paginas/Onboarding'
import { Inicio } from '../paginas/Inicio'
import { Cursos } from '../paginas/Cursos'
import { Curso } from '../paginas/Curso'
import { Pendiente } from '../paginas/Pendiente'
import { LayoutAdmin } from '../admin/LayoutAdmin'
import { Resumen } from '../admin/paginas/Resumen'
import { Personas } from '../admin/paginas/Personas'
import { Invitaciones } from '../admin/paginas/Invitaciones'
import { Cursos as CursosAdmin } from '../admin/paginas/Cursos'
import { Unidades } from '../admin/paginas/Unidades'
import { AnoEscolar } from '../admin/paginas/AnoEscolar'
import { Grados } from '../admin/paginas/Grados'
import { Materias } from '../admin/paginas/Materias'
import { Secciones } from '../admin/paginas/Secciones'
import { Sedes } from '../admin/paginas/Sedes'
import { Institucion } from '../admin/paginas/Institucion'
import { Bitacora } from '../admin/paginas/Bitacora'
import { Marca } from '../ui/Marca'
import { traducirRoles } from './rol'
import { useSesion } from './sesion'

/*
  Entrar a Educa son tres preguntas encadenadas: quién eres, desde qué
  institución, y qué eres dentro de ella. Este componente es el que las ordena,
  y por eso las redirecciones viven aquí y no repartidas por cada formulario:
  cada pantalla se limita a hacer su llamada, y el sitio al que se va después
  lo decide el estado de la sesión.

    sin sesión ................. /acceso
    sesión sin instituciones ... /crear-institucion
    sesión sin elegir .......... /elegir-institucion
    membresía de administración  el panel de administración
    el resto ................... la plataforma de aprendizaje

  La tercera pregunta antes se respondía dentro de la aplicación, con un
  selector de rol en la barra superior. Estaba mal: hacía parecer que el panel
  era una preferencia cuando es una consecuencia de lo que la persona es en su
  institución. Ahora el rol llega con la sesión y decide el árbol de rutas
  entero; no hay ninguna dirección compartida entre un panel y otro.
*/
export default function App() {
  const { estado, instituciones, institucion, roles } = useSesion()
  const { pathname } = useLocation()

  if (['/', '/producto', '/soluciones', '/seguridad', '/nosotros'].includes(pathname)) {
    return <RutasPublicas />
  }

  if (estado === 'cargando') return <Cargando />

  if (estado === 'fuera') {
    return (
      <Routes>
        <Route path="/acceso" element={<Acceso />} />
        <Route path="/crear-cuenta" element={<CrearCuenta />} />
        <Route path="*" element={<Navigate to="/acceso" replace state={{ desde: pathname }} />} />
      </Routes>
    )
  }

  // Con sesión abierta pero sin institución elegida solo existen las pantallas
  // que llevan a elegirla. El resto de la aplicación no tendría nada que
  // mostrar: sin institución en el contexto, las políticas de la base no
  // devuelven ni una fila.
  if (!institucion) {
    const sinNinguna = instituciones.length === 0
    return (
      <Routes>
        <Route path="/crear-institucion" element={<Onboarding />} />
        {!sinNinguna && (
          <Route path="/elegir-institucion" element={<ElegirInstitucion />} />
        )}
        <Route
          path="*"
          element={
            <Navigate
              to={sinNinguna ? '/crear-institucion' : '/elegir-institucion'}
              replace
            />
          }
        />
      </Routes>
    )
  }

  return traducirRoles(roles) === 'admin' ? <RutasAdmin /> : <RutasAprendizaje />
}

function RutasPublicas() {
  return (
    <Routes>
      <Route element={<SitioPublico />}>
        <Route path="/" element={<Landing />} />
        <Route path="/producto" element={<ProductoPublico />} />
        <Route path="/soluciones" element={<SolucionesPublicas />} />
        <Route path="/seguridad" element={<SeguridadPublica />} />
        <Route path="/nosotros" element={<NosotrosPublico />} />
      </Route>
    </Routes>
  )
}

/*
  Rutas comunes a los dos paneles: cambiar de institución y crear otra. Se
  devuelven en un fragmento porque el router lo atraviesa igual que si los
  <Route> estuvieran escritos a mano dentro de <Routes>. Las de acceso no hacen
  falta: la ruta comodín de cada árbol ya se las lleva a su panel.
*/
function rutasDeContexto() {
  return (
    <>
      <Route path="/elegir-institucion" element={<ElegirInstitucion />} />
      <Route path="/crear-institucion" element={<Onboarding />} />
    </>
  )
}

/*
  El panel de administración. Es la aplicación entera para quien administra: no
  comparte ni una ruta con la plataforma de aprendizaje, así que no hay forma
  de aterrizar por accidente en una pantalla que no le corresponde.
*/
function RutasAdmin() {
  return (
    <Routes>
      {rutasDeContexto()}

      <Route element={<LayoutAdmin />}>
        <Route path="/admin" element={<Resumen />} />
        <Route path="/admin/personas" element={<Personas />} />
        <Route path="/admin/invitaciones" element={<Invitaciones />} />
        <Route path="/admin/cursos" element={<CursosAdmin />} />
        <Route path="/admin/unidades" element={<Unidades />} />
        <Route path="/admin/ano-escolar" element={<AnoEscolar />} />
        <Route path="/admin/grados" element={<Grados />} />
        <Route path="/admin/materias" element={<Materias />} />
        <Route path="/admin/secciones" element={<Secciones />} />
        <Route path="/admin/sedes" element={<Sedes />} />
        <Route path="/admin/institucion" element={<Institucion />} />
        <Route path="/admin/bitacora" element={<Bitacora />} />
        <Route
          path="/perfil"
          element={
            <Pendiente
              titulo="Mi perfil"
              icono={UserRound}
              texto="Tus datos de cuenta, contraseña y sesiones abiertas. Es lo único de esta plataforma que no pertenece a una institución sino a ti."
            />
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

/* La plataforma que usan estudiantes y docentes. */
function RutasAprendizaje() {
  return (
    <Routes>
      {rutasDeContexto()}

      <Route element={<Shell />}>
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/cursos" element={<Cursos />} />
        <Route path="/cursos/:codigo" element={<Curso />} />
        <Route
          path="/calendario"
          element={
            <Pendiente
              titulo="Calendario"
              icono={Calendar}
              texto="Reúne clases, fechas límite y eventos de la institución. No guarda datos propios: proyecta los de cursos, tareas y sesiones."
            />
          }
        />
        <Route
          path="/clases"
          element={
            <Pendiente
              titulo="Clases"
              icono={Video}
              texto="Programación, sala en vivo, asistencia y grabaciones. Se conecta a Jitsi a través del módulo de reuniones del backend."
            />
          }
        />
        <Route
          path="/mensajes"
          element={
            <Pendiente
              titulo="Mensajes"
              icono={MessageSquare}
              texto="Conversaciones directas y foros por curso, con moderación para el equipo docente."
            />
          }
        />
        <Route
          path="/reportes"
          element={
            <Pendiente
              titulo="Reportes"
              icono={ChartColumn}
              texto="Rendimiento, asistencia, entregas y uso de la plataforma. Lee de vistas propias, nunca de las tablas transaccionales."
            />
          }
        />
        <Route
          path="/perfil"
          element={
            <Pendiente
              titulo="Mi perfil"
              icono={UserRound}
              texto="Tus datos de cuenta, contraseña y sesiones abiertas. Es lo único de esta plataforma que no pertenece a una institución sino a ti."
            />
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/inicio" replace />} />
    </Routes>
  )
}

/*
  Al abrir la página todavía no se sabe si hay sesión: hay que preguntárselo al
  servidor con la cookie de refresco. Este intervalo dura milisegundos, pero sin
  algo que ocupe la pantalla se ve un parpadeo del formulario de acceso a quien
  sí tenía la sesión abierta.
*/
function Cargando() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-superficie">
      <Marca tono="oscuro" />
      <p className="etiqueta-dato text-tinta-suave">Recuperando tu sesión…</p>
    </div>
  )
}
