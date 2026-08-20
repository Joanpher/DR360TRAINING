import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { BaseDatos } from '../basedatos/basedatos.servicio';
import { anotar, diferencias, type Origen } from '../comun/auditoria';
import { contextoDe, institucionDe } from '../comun/contexto';
import type { Sesion } from '../comun/sesion';
import type { ActualizarAnoDto, CrearAnoDto, PeriodosDto } from './dto/escolar.dto';

export type PeriodoCalificacion = {
  id: string;
  orden: number;
  nombre: string;
  inicio: string;
  fin: string;
  cerrado: boolean;
};

export type AnoEscolar = {
  id: string;
  codigo: string;
  nombre: string;
  inicio: string;
  fin: string;
  inicioInscripcion: string | null;
  finInscripcion: string | null;
  estado: string;
  esActual: boolean;
  secciones: number;
  periodos: PeriodoCalificacion[];
};

/* 1er, 2do, 3ro... como se dicen en Republica Dominicana. */
const ORDINAL: Record<number, string> = {
  1: '1er', 2: '2do', 3: '3er', 4: '4to',
  5: '5to', 6: '6to', 7: '7mo', 8: '8vo',
};

/*
  Las fechas salen como texto y no como date.

  El driver convierte una columna date a un Date de JavaScript a medianoche en
  la zona del servidor. Al serializar a JSON eso se vuelve un instante UTC, y un
  ano que empieza el 18 de agosto llega al navegador como el 17 a las 20:00. Un
  ano escolar no tiene hora: es un dia del calendario, y la unica forma de que
  siga siendo el mismo dia al otro lado es no convertirlo nunca a instante.
*/
const LISTA = `
  select a.id, a.codigo, a.nombre,
         to_char(a.inicio, 'YYYY-MM-DD') as inicio,
         to_char(a.fin, 'YYYY-MM-DD') as fin,
         to_char(a.inicio_inscripcion, 'YYYY-MM-DD') as "inicioInscripcion",
         to_char(a.fin_inscripcion, 'YYYY-MM-DD') as "finInscripcion",
         a.estado::text as estado, a.es_actual as "esActual",
         (select count(*)::int from secciones s
           where s.ano_escolar_id = a.id and s.eliminado_en is null) as secciones,
         coalesce((
           select json_agg(json_build_object(
                    'id', p.id, 'orden', p.orden, 'nombre', p.nombre,
                    'inicio', to_char(p.inicio, 'YYYY-MM-DD'),
                    'fin', to_char(p.fin, 'YYYY-MM-DD'),
                    'cerrado', p.cerrado_en is not null)
                  order by p.orden)
             from periodos_calificacion p where p.ano_escolar_id = a.id
         ), '[]'::json) as periodos
    from anos_escolares a
   order by a.inicio desc
`;

@Injectable()
export class AnosServicio {
  constructor(private readonly bd: BaseDatos) {}

  async listar(sesion: Sesion): Promise<{ anos: AnoEscolar[] }> {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<AnoEscolar>(LISTA);
      return { anos: rows };
    });
  }

  /*
    Nace planificado y sin ser el actual. Abrirlo es un acto aparte, porque es
    lo que deja inscribir: crear el ano 2027-2028 en enero no deberia abrir su
    inscripcion en enero.

    Los periodos de calificacion se generan aqui repartiendo el calendario en
    partes iguales. No es que las fechas exactas importen -se ajustan despues-,
    es que un ano sin periodos no admite ni una nota, y dejar ese paso a la
    memoria de alguien garantiza que se descubra el dia que un maestro intente
    calificar.
  */
  async crear(sesion: Sesion, datos: CrearAnoDto, origen: Origen) {
    this.comprobarFechas(datos.inicio, datos.fin);

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into anos_escolares
           (institucion_id, codigo, nombre, inicio, fin,
            inicio_inscripcion, fin_inscripcion)
         values ($1, $2, $3, $4::date, $5::date, $6::date, $7::date)
         returning id`,
        [
          institucionDe(sesion),
          datos.codigo,
          datos.nombre,
          datos.inicio,
          datos.fin,
          datos.inicioInscripcion ?? null,
          datos.finInscripcion ?? null,
        ],
      );
      const anoId = rows[0].id;

      const cuantos = datos.periodos ?? 4;
      for (const periodo of repartir(datos.inicio, datos.fin, cuantos)) {
        await cliente.query(
          `insert into periodos_calificacion
             (institucion_id, ano_escolar_id, orden, nombre, inicio, fin)
           values ($1, $2, $3, $4, $5::date, $6::date)`,
          [
            institucionDe(sesion),
            anoId,
            periodo.orden,
            `${ORDINAL[periodo.orden] ?? `${periodo.orden}.º`} periodo`,
            periodo.inicio,
            periodo.fin,
          ],
        );
      }

      await anotar(
        cliente,
        {
          accion: 'ano_escolar.creado',
          entidad: 'anos_escolares',
          entidadId: anoId,
          datos: { codigo: datos.codigo, inicio: datos.inicio, fin: datos.fin, periodos: cuantos },
        },
        origen,
      );

      const { rows: anos } = await cliente.query<AnoEscolar>(LISTA);
      return { anos };
    });
  }

  async actualizar(sesion: Sesion, id: string, datos: ActualizarAnoDto, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const antes = await this.leer(cliente, id);

      if (antes.estado === 'cerrado') {
        throw new BadRequestException(
          'Un ano cerrado no se edita: sus calificaciones ya son definitivas.',
        );
      }

      const inicio = datos.inicio ?? antes.inicio;
      const fin = datos.fin ?? antes.fin;
      this.comprobarFechas(inicio, fin);

      const cambios = diferencias(
        {
          codigo: antes.codigo,
          nombre: antes.nombre,
          inicio: antes.inicio,
          fin: antes.fin,
          inicioInscripcion: antes.inicioInscripcion,
          finInscripcion: antes.finInscripcion,
        },
        datos as Record<string, unknown>,
      );

      if (Object.keys(cambios).length > 0) {
        await cliente.query(
          `update anos_escolares set
              codigo = $2, nombre = $3, inicio = $4::date, fin = $5::date,
              inicio_inscripcion = $6::date, fin_inscripcion = $7::date
            where id = $1`,
          [
            id,
            datos.codigo ?? antes.codigo,
            datos.nombre ?? antes.nombre,
            inicio,
            fin,
            'inicioInscripcion' in datos
              ? (datos.inicioInscripcion ?? null)
              : antes.inicioInscripcion,
            'finInscripcion' in datos
              ? (datos.finInscripcion ?? null)
              : antes.finInscripcion,
          ],
        );

        await anotar(
          cliente,
          {
            accion: 'ano_escolar.actualizado',
            entidad: 'anos_escolares',
            entidadId: id,
            datos: { cambios },
          },
          origen,
        );
      }

      const { rows: anos } = await cliente.query<AnoEscolar>(LISTA);
      return { anos };
    });
  }

  /* Reemplaza los cortes de nota del ano. Los que traen id se actualizan. */
  async guardarPeriodos(sesion: Sesion, id: string, datos: PeriodosDto, origen: Origen) {
    const periodos = [...datos.periodos].sort((a, b) => a.orden - b.orden);

    if (periodos.length === 0) {
      throw new BadRequestException('El ano necesita al menos un periodo de calificacion.');
    }

    const ordenes = new Set(periodos.map((p) => p.orden));
    if (ordenes.size !== periodos.length) {
      throw new BadRequestException('Hay dos periodos con el mismo numero de orden.');
    }

    for (const p of periodos) {
      if (new Date(p.fin) < new Date(p.inicio)) {
        throw new BadRequestException(`El ${p.nombre} termina antes de empezar.`);
      }
    }

    for (let i = 1; i < periodos.length; i++) {
      if (new Date(periodos[i].inicio) <= new Date(periodos[i - 1].fin)) {
        throw new BadRequestException(
          `${periodos[i].nombre} se solapa con ${periodos[i - 1].nombre}.`,
        );
      }
    }

    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const ano = await this.leer(cliente, id);
      const conservados = periodos.map((p) => p.id).filter(Boolean) as string[];

      await cliente.query(
        `delete from periodos_calificacion
          where ano_escolar_id = $1
            and ($2::uuid[] = '{}' or id <> all ($2::uuid[]))`,
        [id, conservados],
      );

      for (const p of periodos) {
        if (p.id) {
          await cliente.query(
            `update periodos_calificacion
                set orden = $2, nombre = $3, inicio = $4::date, fin = $5::date
              where id = $1`,
            [p.id, p.orden, p.nombre, p.inicio, p.fin],
          );
        } else {
          await cliente.query(
            `insert into periodos_calificacion
               (institucion_id, ano_escolar_id, orden, nombre, inicio, fin)
             values ($1, $2, $3, $4, $5::date, $6::date)`,
            [institucionDe(sesion), id, p.orden, p.nombre, p.inicio, p.fin],
          );
        }
      }

      await anotar(
        cliente,
        {
          accion: 'ano_escolar.periodos_actualizados',
          entidad: 'anos_escolares',
          entidadId: id,
          datos: { ano: ano.codigo, periodos: periodos.length },
        },
        origen,
      );

      const { rows: anos } = await cliente.query<AnoEscolar>(LISTA);
      return { anos };
    });
  }

  /*
    Abrir un ano lo pone activo y lo convierte en el actual: el que la
    plataforma muestra por defecto. Deliberadamente no cierra el anterior.
    Cerrar congela calificaciones y eso lo decide una persona, no un efecto
    secundario de abrir el siguiente.

    El indice unico no admite dos anos actuales ni a mitad de la transaccion,
    asi que primero se desmarca el anterior.
  */
  async abrir(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const ano = await this.leer(cliente, id);

      if (ano.estado === 'cerrado') {
        throw new BadRequestException('Un ano cerrado no se puede volver a abrir.');
      }

      await cliente.query(`update anos_escolares set es_actual = false where es_actual`);
      await cliente.query(
        `update anos_escolares
            set estado = 'activo'::estado_ano_escolar, es_actual = true
          where id = $1`,
        [id],
      );

      await anotar(
        cliente,
        {
          accion: 'ano_escolar.abierto',
          entidad: 'anos_escolares',
          entidadId: id,
          datos: { codigo: ano.codigo, estadoAnterior: ano.estado },
        },
        origen,
      );

      const { rows: anos } = await cliente.query<AnoEscolar>(LISTA);
      return { anos };
    });
  }

  async cerrar(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const ano = await this.leer(cliente, id);

      if (ano.estado !== 'activo') {
        throw new BadRequestException('Solo se puede cerrar un ano activo.');
      }

      await cliente.query(
        `update anos_escolares
            set estado = 'cerrado'::estado_ano_escolar, es_actual = false
          where id = $1`,
        [id],
      );
      await cliente.query(
        `update periodos_calificacion set cerrado_en = now()
          where ano_escolar_id = $1 and cerrado_en is null`,
        [id],
      );

      await anotar(
        cliente,
        {
          accion: 'ano_escolar.cerrado',
          entidad: 'anos_escolares',
          entidadId: id,
          datos: { codigo: ano.codigo },
        },
        origen,
      );

      const { rows: anos } = await cliente.query<AnoEscolar>(LISTA);
      return { anos };
    });
  }

  /*
    Borrado fisico: esta tabla no tiene eliminado_en porque un ano que nunca
    llego a abrirse no dejo rastro en ningun expediente. Uno que si se abrio no
    se borra jamas.
  */
  async eliminar(sesion: Sesion, id: string, origen: Origen) {
    return this.bd.conContexto(contextoDe(sesion), async (cliente) => {
      const ano = await this.leer(cliente, id);

      if (ano.estado !== 'planificado') {
        throw new BadRequestException('Solo se puede eliminar un ano que nunca se abrio.');
      }

      const { rows: usos } = await cliente.query<{ secciones: number }>(
        `select count(*)::int as secciones from secciones
          where ano_escolar_id = $1 and eliminado_en is null`,
        [id],
      );
      if (usos[0].secciones > 0) {
        throw new BadRequestException(
          `Ese ano ya tiene ${usos[0].secciones} secciones creadas. Eliminalas antes.`,
        );
      }

      await cliente.query('delete from anos_escolares where id = $1', [id]);

      await anotar(
        cliente,
        {
          accion: 'ano_escolar.eliminado',
          entidad: 'anos_escolares',
          entidadId: id,
          datos: { codigo: ano.codigo, nombre: ano.nombre },
        },
        origen,
      );

      const { rows: anos } = await cliente.query<AnoEscolar>(LISTA);
      return { anos };
    });
  }

  private comprobarFechas(inicio: string, fin: string) {
    if (new Date(fin) <= new Date(inicio)) {
      throw new BadRequestException('El ano escolar debe terminar despues de empezar.');
    }
  }

  private async leer(cliente: PoolClient, id: string) {
    const { rows } = await cliente.query<{
      codigo: string;
      nombre: string;
      inicio: string;
      fin: string;
      inicioInscripcion: string | null;
      finInscripcion: string | null;
      estado: string;
    }>(
      `select codigo, nombre,
              to_char(inicio, 'YYYY-MM-DD') as inicio,
              to_char(fin, 'YYYY-MM-DD') as fin,
              to_char(inicio_inscripcion, 'YYYY-MM-DD') as "inicioInscripcion",
              to_char(fin_inscripcion, 'YYYY-MM-DD') as "finInscripcion",
              estado::text as estado
         from anos_escolares where id = $1 for update`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Ese ano escolar no existe.');
    return rows[0];
  }
}

/*
  Reparte el calendario del ano en tramos consecutivos y sin huecos. El ultimo
  se lleva el resto de la division para que el ultimo dia del ano sea el ultimo
  dia del ultimo periodo, y no uno o dos antes por redondeo.
*/
function repartir(inicio: string, fin: string, cuantos: number) {
  const dia = 86_400_000;
  const desde = new Date(`${inicio}T00:00:00Z`).getTime();
  const hasta = new Date(`${fin}T00:00:00Z`).getTime();
  const total = Math.round((hasta - desde) / dia) + 1;
  const largo = Math.floor(total / cuantos);

  return Array.from({ length: cuantos }, (_, i) => {
    const arranca = desde + i * largo * dia;
    const termina = i === cuantos - 1 ? hasta : arranca + (largo - 1) * dia;
    return {
      orden: i + 1,
      inicio: new Date(arranca).toISOString().slice(0, 10),
      fin: new Date(termina).toISOString().slice(0, 10),
    };
  });
}
