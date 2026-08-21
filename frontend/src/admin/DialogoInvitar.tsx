import { useState } from 'react'
import { Boton } from '../ui/Boton'
import { Campo } from '../ui/Campo'
import { Dialogo } from '../ui/Dialogo'
import { Selector } from '../ui/Selector'
import { AreaTexto } from '../ui/AreaTexto'
import { programas } from './datos'

/*
  Invitar es la unica forma de que alguien entre a una institucion. No hay
  "crear usuario y ponerle una contrasena": la persona acepta y elige su clave,
  asi que nadie -ni el administrador- conoce credenciales ajenas.

  Vive en su propio archivo porque se abre desde dos sitios: la lista de
  usuarios y la de invitaciones. Son la misma accion vista desde dos angulos.
*/
export function DialogoInvitar({
  abierto,
  alCerrar,
}: {
  abierto: boolean
  alCerrar: () => void
}) {
  const [rol, setRol] = useState('estudiante')
  const necesitaPrograma = rol === 'estudiante' || rol === 'docente' || rol === 'coordinador'

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Invitar a la institución"
      descripcion="La persona recibirá un correo con un enlace válido por 7 días. Si ya tiene cuenta en DR360TRAINING solo tendrá que aceptar; si no, la creará al aceptar."
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={alCerrar}>
            Enviar invitación
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo
          etiqueta="Correo"
          type="email"
          placeholder="nombre@uce.edu.do"
          ayuda="Debe pertenecer a un dominio verificado de la institución."
          autoFocus
        />

        <Selector
          etiqueta="Rol en la institución"
          value={rol}
          onChange={(e) => setRol(e.target.value)}
          opciones={[
            { valor: 'estudiante', texto: 'Estudiante' },
            { valor: 'docente', texto: 'Instructor' },
            { valor: 'coordinador', texto: 'Coordinador' },
            { valor: 'administrador', texto: 'Administrador' },
            { valor: 'invitado', texto: 'Invitado (solo lectura)' },
          ]}
          ayuda={
            rol === 'administrador'
              ? 'Podrá crear cursos, invitar personas y cambiar la configuración de toda la institución.'
              : undefined
          }
        />

        {necesitaPrograma && (
          <Selector
            etiqueta="Programa"
            vacio="Sin programa asignado"
            opciones={programas
              .filter((p) => p.activo)
              .map((p) => ({ valor: p.id, texto: p.nombre }))}
          />
        )}

        <Campo
          etiqueta={rol === 'estudiante' ? 'Matrícula' : 'Código de empleado'}
          placeholder={rol === 'estudiante' ? '2026-1234' : 'EMP-0000'}
          ayuda="Opcional. Debe ser único dentro de la institución."
        />

        <AreaTexto
          etiqueta="Mensaje"
          placeholder="Se incluye en el correo de invitación."
          rows={2}
        />
      </div>
    </Dialogo>
  )
}
