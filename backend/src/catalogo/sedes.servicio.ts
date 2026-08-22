import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, diferencias, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type { ActualizarSedeDto, CrearSedeDto } from './dto/academico.dto';

export type Sede = {
  id: string;
  codigo: string;
  nombre: string;
  ciudad: string | null;
  direccion: string | null;
  esPrincipal: boolean;
  activa: boolean;
  personas: number;
};

/*
  El conteo de personas va en la misma consulta que la lista y no en una
  llamada aparte. Son tres o cuatro sedes: pedirlas y luego pedir sus conteos
  seria una segunda ida a la base para pintar una columna.
*/
const LISTA = `
  select s.id, s.codigo, s.nombre, s.ciudad, s.direccion,
         s.es_principal as "esPrincipal", s.activa,
         (select count(*)::int
            from membresias m
           where m.sede_id = s.id
             and m.estado = 'activa'
             and m.eliminado_en is null) as personas
    from sedes s
   where s.eliminado_en is null
   order by s.es_principal desc, s.nombre
`;

@Injectable()
export class SedesServicio {
  constructor(private readonly bd: BaseDatos) {}

  async listar(sesion: Sesion): Promise<{ sedes: Sede[] }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Sede>(LISTA);
      return { sedes: rows };
    });
  }

  /*
    La primera sede de una institucion nace como principal. No es un detalle
    de comodidad: el indice unico permite cero sedes principales, asi que sin
    esto una institucion podria terminar con tres sedes y ninguna marcada, y
    entonces "la sede por defecto" no tendria respuesta.
  */
  async crear(sesion: Sesion, datos: CrearSedeDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows: existentes } = await cliente.query<{ total: number }>(
        `select count(*)::int as total from sedes where eliminado_en is null`,
      );
      const primera = existentes[0].total === 0;

      const { rows } = await cliente.query<{ id: string }>(
        `insert into sedes (institucion_id, codigo, nombre, ciudad, direccion, es_principal)
         values ($1, $2, $3, $4, $5, $6)
         returning id`,
        [
          institucionDe(sesion),
          datos.codigo,
          datos.nombre,
          datos.ciudad ?? null,
          datos.direccion ?? null,
          primera,
        ],
      );

      await anotar(
        cliente,
        {
          accion: 'sede.creada',
          entidad: 'sedes',
          entidadId: rows[0].id,
          datos: { codigo: datos.codigo, nombre: datos.nombre, esPrincipal: primera },
        },
        origen,
      );

      const { rows: sedes } = await cliente.query<Sede>(LISTA);
      return { sedes };
    });
  }

  async actualizar(sesion: Sesion, id: string, datos: ActualizarSedeDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leer(cliente, id);

      const cambios = diferencias(
        {
          codigo: antes.codigo,
          nombre: antes.nombre,
          ciudad: antes.ciudad,
          direccion: antes.direccion,
          activa: antes.activa,
        },
        datos as Record<string, unknown>,
      );

      if (Object.keys(cambios).length > 0) {
        await cliente.query(
          `update sedes set
              codigo = $2, nombre = $3, ciudad = $4, direccion = $5, activa = $6
            where id = $1`,
          [
            id,
            datos.codigo ?? antes.codigo,
            datos.nombre ?? antes.nombre,
            datos.ciudad === undefined ? antes.ciudad : datos.ciudad,
            datos.direccion === undefined ? antes.direccion : datos.direccion,
            datos.activa ?? antes.activa,
          ],
        );

        await anotar(
          cliente,
          { accion: 'sede.actualizada', entidad: 'sedes', entidadId: id, datos: { cambios } },
          origen,
        );
      }

      const { rows: sedes } = await cliente.query<Sede>(LISTA);
      return { sedes };
    });
  }

  /*
    Marcar una principal exige desmarcar la anterior antes, no despues: el
    indice unico parcial no admite dos a la vez ni por un instante dentro de la
    transaccion.
  */
  async marcarPrincipal(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const sede = await this.leer(cliente, id);
      if (sede.esPrincipal) {
        const { rows: sedes } = await cliente.query<Sede>(LISTA);
        return { sedes };
      }

      await cliente.query(
        `update sedes set es_principal = false where es_principal and eliminado_en is null`,
      );
      await cliente.query(`update sedes set es_principal = true where id = $1`, [id]);

      await anotar(
        cliente,
        {
          accion: 'sede.marcada_principal',
          entidad: 'sedes',
          entidadId: id,
          datos: { nombre: sede.nombre },
        },
        origen,
      );

      const { rows: sedes } = await cliente.query<Sede>(LISTA);
      return { sedes };
    });
  }

  /*
    Borrado logico. La sede aparece en el historial de quien estudio ahi y en
    las unidades academicas que la referencian; borrarla de verdad dejaria esas
    filas apuntando al vacio o, con la clave foranea puesta a restrict, haria
    fallar el delete sin explicar por que.
  */
  async eliminar(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const sede = await this.leer(cliente, id);

      if (sede.esPrincipal) {
        throw new BadRequestException(
          'No se puede eliminar la sede principal. Marca otra como principal antes.',
        );
      }

      const { rows: usos } = await cliente.query<{ unidades: number; personas: number }>(
        `select (select count(*)::int from unidades_academicas
                  where sede_id = $1 and eliminado_en is null) as unidades,
                (select count(*)::int from membresias
                  where sede_id = $1 and eliminado_en is null) as personas`,
        [id],
      );

      if (usos[0].unidades > 0 || usos[0].personas > 0) {
        throw new BadRequestException(
          `Esa sede todavia tiene ${usos[0].unidades} unidades y ${usos[0].personas} personas asignadas. Muevelas antes de eliminarla.`,
        );
      }

      await cliente.query(`update sedes set eliminado_en = now() where id = $1`, [id]);

      await anotar(
        cliente,
        {
          accion: 'sede.eliminada',
          entidad: 'sedes',
          entidadId: id,
          datos: { codigo: sede.codigo, nombre: sede.nombre },
        },
        origen,
      );

      const { rows: sedes } = await cliente.query<Sede>(LISTA);
      return { sedes };
    });
  }

  private async leer(cliente: Parameters<typeof anotar>[0], id: string) {
    const { rows } = await cliente.query<{
      codigo: string;
      nombre: string;
      ciudad: string | null;
      direccion: string | null;
      esPrincipal: boolean;
      activa: boolean;
    }>(
      `select codigo, nombre, ciudad, direccion, es_principal as "esPrincipal", activa
         from sedes where id = $1 and eliminado_en is null for update`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Esa sede no existe.');
    return rows[0];
  }
}
