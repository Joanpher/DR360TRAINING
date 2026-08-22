import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, diferencias, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type { CategoriaDto } from './dto/catalogo.dto';

export type Categoria = {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string | null;
  orden: number;
  activa: boolean;
  /* Cuantos cursos vivos la usan. Es lo que dice si se puede retirar. */
  cursos: number;
};

/*
  El conteo va en la misma consulta que la lista. Son diez o quince categorias,
  no diez mil: pedirlas y luego pedir sus conteos seria una segunda ida a la
  base para pintar una columna.

  Se ordena por `orden` y no alfabeticamente porque el centro decide como se
  presenta su catalogo, y "Idiomas" antes que "Informatica" rara vez es la
  prioridad que quiere ensenar.
*/
const LISTA = `
  select c.id, c.nombre, c.descripcion, c.color, c.orden, c.activa,
         (select count(*)::int from cursos k
           where k.categoria_id = c.id and k.eliminado_en is null) as cursos
    from categorias c
   where c.eliminado_en is null
   order by c.orden, c.nombre
`;

@Injectable()
export class CategoriasServicio {
  constructor(private readonly bd: BaseDatos) {}

  async listar(sesion: Sesion): Promise<{ categorias: Categoria[] }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<Categoria>(LISTA);
      return { categorias: rows };
    });
  }

  async crear(sesion: Sesion, datos: CategoriaDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into categorias (institucion_id, nombre, descripcion, color, orden, activa)
         values ($1, $2, $3, $4, $5, $6)
         returning id`,
        [
          institucionDe(sesion),
          datos.nombre,
          datos.descripcion ?? null,
          datos.color ?? null,
          datos.orden ?? 0,
          datos.activa ?? true,
        ],
      );

      await anotar(
        cliente,
        {
          accion: 'categoria.creada',
          entidad: 'categorias',
          entidadId: rows[0].id,
          datos: { nombre: datos.nombre },
        },
        origen,
      );

      const { rows: categorias } = await cliente.query<Categoria>(LISTA);
      return { categorias };
    });
  }

  async actualizar(
    sesion: Sesion,
    id: string,
    datos: CategoriaDto,
    origen: Origen,
  ) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leer(cliente, id);

      const cambios = diferencias(
        {
          nombre: antes.nombre,
          descripcion: antes.descripcion,
          color: antes.color,
          orden: antes.orden,
          activa: antes.activa,
        },
        datos as unknown as Record<string, unknown>,
      );

      if (Object.keys(cambios).length > 0) {
        await cliente.query(
          `update categorias set
              nombre = $2, descripcion = $3, color = $4, orden = $5, activa = $6
            where id = $1`,
          [
            id,
            datos.nombre ?? antes.nombre,
            datos.descripcion === undefined
              ? antes.descripcion
              : datos.descripcion,
            datos.color === undefined ? antes.color : datos.color,
            datos.orden ?? antes.orden,
            datos.activa ?? antes.activa,
          ],
        );

        await anotar(
          cliente,
          {
            accion: 'categoria.actualizada',
            entidad: 'categorias',
            entidadId: id,
            datos: { cambios },
          },
          origen,
        );
      }

      const { rows: categorias } = await cliente.query<Categoria>(LISTA);
      return { categorias };
    });
  }

  /*
    Borrado logico, y solo si no queda ningun curso apuntando. La clave foranea
    esta a restrict, asi que un delete de verdad fallaria con un mensaje de
    Postgres que no le dice nada a quien administra; esto le dice cuantos cursos
    hay que mover primero.
  */
  async eliminar(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const categoria = await this.leer(cliente, id);

      const { rows: usos } = await cliente.query<{ cursos: number }>(
        `select count(*)::int as cursos from cursos
          where categoria_id = $1 and eliminado_en is null`,
        [id],
      );

      if (usos[0].cursos > 0) {
        throw new BadRequestException(
          `Esa categoria todavia agrupa ${usos[0].cursos} curso(s). Muevelos a otra o desactivala en vez de eliminarla.`,
        );
      }

      await cliente.query(
        `update categorias set eliminado_en = now() where id = $1`,
        [id],
      );

      await anotar(
        cliente,
        {
          accion: 'categoria.eliminada',
          entidad: 'categorias',
          entidadId: id,
          datos: { nombre: categoria.nombre },
        },
        origen,
      );

      const { rows: categorias } = await cliente.query<Categoria>(LISTA);
      return { categorias };
    });
  }

  private async leer(cliente: PoolClient, id: string) {
    const { rows } = await cliente.query<{
      nombre: string;
      descripcion: string | null;
      color: string | null;
      orden: number;
      activa: boolean;
    }>(
      `select nombre, descripcion, color, orden, activa
         from categorias where id = $1 and eliminado_en is null for update`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Esa categoria no existe.');
    return rows[0];
  }
}
