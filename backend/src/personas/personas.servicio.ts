import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, diferencias, type Origen } from '../comun/auditoria';
import { contextoDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type {
  ActualizarPersonaDto,
  ListarPersonasDto,
  RolesDto,
} from './dto/personas.dto';

export type Persona = {
  id: string;
  usuarioId: string;
  nombre: string;
  correo: string;
  codigo: string | null;
  estado: string;
  roles: string[];
  unidadAcademicaId: string | null;
  unidad: string | null;
  sedeId: string | null;
  sede: string | null;
  ingresoEn: string | null;
  ultimoAcceso: Date | null;
  /* Nunca ha entrado: la cuenta existe pero no se ha usado todavia. */
  nuncaEntro: boolean;
};

const POR_PAGINA = 25;

/*
  Una institucion real tiene miles de estudiantes, asi que esta lista se filtra
  y se pagina en el servidor. Es la unica del panel que lo hace: las demas
  -sedes, materias, grados- son decenas de filas y traerlas enteras sale mas
  barato que paginarlas.

  El filtro por rol usa un exists y no el array agregado a proposito: exists se
  resuelve con el indice de membresia_roles y corta antes de agrupar; filtrar
  sobre el resultado del array_agg obligaria a construir el array de todas las
  filas para luego tirar casi todas.
*/
const CAMPOS = `
  m.id, m.usuario_id as "usuarioId", u.nombre_completo as nombre,
  u.correo::text as correo, m.codigo, m.estado::text as estado,
  m.unidad_academica_id as "unidadAcademicaId", ua.nombre as unidad,
  m.sede_id as "sedeId", s.nombre as sede,
  to_char(m.ingreso_en, 'YYYY-MM-DD') as "ingresoEn",
  u.ultimo_acceso_en as "ultimoAcceso",
  (u.ultimo_acceso_en is null) as "nuncaEntro",
  coalesce(
    array_agg(r.rol::text order by r.rol) filter (where r.rol is not null),
    '{}'
  ) as roles
`;

const DESDE = `
  from membresias m
  join usuarios u on u.id = m.usuario_id
  left join unidades_academicas ua
         on ua.id = m.unidad_academica_id and ua.eliminado_en is null
  left join sedes s on s.id = m.sede_id and s.eliminado_en is null
  left join membresia_roles r on r.membresia_id = m.id
`;

const AGRUPAR = `
  group by m.id, m.usuario_id, u.nombre_completo, u.correo, m.codigo, m.estado,
           m.unidad_academica_id, ua.nombre,
           m.sede_id, s.nombre, m.ingreso_en, u.ultimo_acceso_en
`;

@Injectable()
export class PersonasServicio {
  constructor(private readonly bd: BaseDatos) {}

  async listar(sesion: Sesion, filtros: ListarPersonasDto) {
    const pagina = filtros.pagina ?? 1;
    const porPagina = filtros.porPagina ?? POR_PAGINA;

    const condiciones: string[] = ['m.eliminado_en is null'];
    const valores: unknown[] = [];

    if (filtros.busqueda) {
      valores.push(`%${filtros.busqueda}%`);
      const n = valores.length;
      condiciones.push(
        `(u.nombre_completo ilike $${n} or u.correo ilike $${n} or m.codigo ilike $${n})`,
      );
    }

    if (filtros.estado) {
      valores.push(filtros.estado);
      condiciones.push(`m.estado = $${valores.length}::estado_membresia`);
    }


    if (filtros.rol) {
      // "administracion" no es un rol de la base: es la pregunta "quien puede
      // administrar", que responden dos roles distintos.
      const roles =
        filtros.rol === 'administracion'
          ? ['propietario', 'administrador']
          : [filtros.rol];
      valores.push(roles);
      condiciones.push(
        `exists (select 1 from membresia_roles mr
                  where mr.membresia_id = m.id
                    and mr.rol = any ($${valores.length}::rol_institucional[]))`,
      );
    }

    const donde = `where ${condiciones.join(' and ')}`;

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows: conteo } = await cliente.query<{ total: number }>(
        `select count(distinct m.id)::int as total ${DESDE} ${donde}`,
        valores,
      );

      const { rows: personas } = await cliente.query<Persona>(
        `select ${CAMPOS} ${DESDE} ${donde} ${AGRUPAR}
          order by u.nombre_completo
          limit $${valores.length + 1} offset $${valores.length + 2}`,
        [...valores, porPagina, (pagina - 1) * porPagina],
      );

      // Los conteos por estado se calculan sobre el total y no sobre la pagina:
      // "3 suspendidas" tiene que seguir diciendo 3 aunque no se vea ninguna.
      const { rows: resumen } = await cliente.query<{
        estado: string;
        total: number;
      }>(
        `select estado::text as estado, count(*)::int as total
           from membresias where eliminado_en is null group by estado`,
      );

      return {
        personas,
        total: conteo[0].total,
        pagina,
        porPagina,
        resumen: Object.fromEntries(resumen.map((r) => [r.estado, r.total])),
      };
    });
  }

  async actualizar(sesion: Sesion, id: string, datos: ActualizarPersonaDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leer(cliente, id);

      /*
        Suspenderse o retirarse a uno mismo deja a la institucion con un
        administrador menos y a quien lo hizo fuera en el siguiente refresco.
        No hay ningun caso en que sea lo que se pretendia.
      */
      if (
        datos.estado &&
        datos.estado !== 'activa' &&
        antes.usuarioId === sesion.usuarioId
      ) {
        throw new BadRequestException(
          'No puedes cambiar el estado de tu propia membresia. Pideselo a otra persona que administre.',
        );
      }

      const cambios = diferencias(
        {
          codigo: antes.codigo,
          unidadAcademicaId: antes.unidadAcademicaId,
          sedeId: antes.sedeId,
          ingresoEn: antes.ingresoEn,
          estado: antes.estado,
        },
        datos as Record<string, unknown>,
      );

      if (Object.keys(cambios).length > 0) {
        await cliente.query(
          `update membresias set
              codigo = $2, unidad_academica_id = $3,
              sede_id = $4, ingreso_en = $5::date, estado = $6::estado_membresia
            where id = $1`,
          [
            id,
            'codigo' in datos ? (datos.codigo ?? null) : antes.codigo,
            'unidadAcademicaId' in datos
              ? (datos.unidadAcademicaId ?? null)
              : antes.unidadAcademicaId,
            'sedeId' in datos ? (datos.sedeId ?? null) : antes.sedeId,
            'ingresoEn' in datos ? (datos.ingresoEn ?? null) : antes.ingresoEn,
            datos.estado ?? antes.estado,
          ],
        );

        await anotar(
          cliente,
          {
            accion:
              datos.estado && datos.estado !== antes.estado
                ? `membresia.${datos.estado}`
                : 'membresia.actualizada',
            entidad: 'membresias',
            entidadId: id,
            datos: { persona: antes.nombre, cambios },
          },
          origen,
        );
      }

      return { persona: await this.leerCompleta(cliente, id) };
    });
  }

  /*
    Los roles se calculan como una diferencia de conjuntos: lo que sobra se
    borra y lo que falta se inserta. Lo que ya estaba no se toca, para no perder
    quien lo asigno y cuando.

    Quitar el ultimo propietario lo impide un disparador de la base, no este
    codigo. Es la unica forma de que la regla valga tambien para quien entre por
    SQL directo, y el filtro de errores traduce ese P0001 al mensaje que el
    disparador ya trae escrito.
  */
  async cambiarRoles(sesion: Sesion, id: string, datos: RolesDto, origen: Origen) {
    const pedidos = [...new Set(datos.roles)];

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leer(cliente, id);

      const { rows: actuales } = await cliente.query<{ rol: string }>(
        `select rol::text as rol from membresia_roles where membresia_id = $1`,
        [id],
      );
      const tenia = actuales.map((r) => r.rol);

      const quitar = tenia.filter((rol) => !pedidos.includes(rol));
      const anadir = pedidos.filter((rol) => !tenia.includes(rol));

      if (quitar.length === 0 && anadir.length === 0) {
        return { persona: await this.leerCompleta(cliente, id) };
      }

      /*
        Quitarse a uno mismo la administracion es la forma mas rapida de
        quedarse fuera del panel sin que nadie pueda devolverte la entrada.
      */
      if (
        antes.usuarioId === sesion.usuarioId &&
        quitar.some((rol) => rol === 'administrador' || rol === 'propietario') &&
        !pedidos.some((rol) => rol === 'administrador' || rol === 'propietario')
      ) {
        throw new BadRequestException(
          'No puedes quitarte a ti mismo la administracion: te quedarias sin acceso al panel.',
        );
      }

      if (quitar.length > 0) {
        await cliente.query(
          `delete from membresia_roles
            where membresia_id = $1 and rol = any ($2::rol_institucional[])`,
          [id, quitar],
        );
      }

      if (anadir.length > 0) {
        await cliente.query(
          `insert into membresia_roles (membresia_id, institucion_id, rol, asignado_por)
           select $1, institucion_id, unnest($2::rol_institucional[]), $3
             from membresias where id = $1`,
          [id, anadir, sesion.usuarioId],
        );
      }

      await anotar(
        cliente,
        {
          accion: 'membresia.roles_cambiados',
          entidad: 'membresias',
          entidadId: id,
          datos: { persona: antes.nombre, antes: tenia, despues: pedidos },
        },
        origen,
      );

      return { persona: await this.leerCompleta(cliente, id) };
    });
  }

  private async leer(cliente: PoolClient, id: string) {
    const { rows } = await cliente.query<{
      usuarioId: string;
      nombre: string;
      codigo: string | null;
      estado: string;
      unidadAcademicaId: string | null;
      sedeId: string | null;
      ingresoEn: string | null;
    }>(
      `select m.usuario_id as "usuarioId", u.nombre_completo as nombre,
              m.codigo, m.estado::text as estado,
              m.unidad_academica_id as "unidadAcademicaId",
              m.sede_id as "sedeId",
              to_char(m.ingreso_en, 'YYYY-MM-DD') as "ingresoEn"
         from membresias m
         join usuarios u on u.id = m.usuario_id
        where m.id = $1 and m.eliminado_en is null
        for update of m`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Esa persona no pertenece a la institucion.');
    return rows[0];
  }

  /* Una sola fila con la misma forma que las de la lista, para reemplazarla. */
  private async leerCompleta(cliente: PoolClient, id: string): Promise<Persona> {
    const { rows } = await cliente.query<Persona>(
      `select ${CAMPOS} ${DESDE} where m.id = $1 and m.eliminado_en is null ${AGRUPAR}`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Esa persona ya no existe.');
    return rows[0];
  }
}
