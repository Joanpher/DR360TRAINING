import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const recortar = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

const vacioEsNulo = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const limpio = value.trim();
    return limpio === '' ? null : limpio;
  });

export const ROLES = [
  'propietario',
  'administrador',
  'coordinador',
  'docente',
  'estudiante',
  'invitado',
] as const;

/*
  Los estados a los que administracion puede mover una membresia. 'invitada' no
  esta: a ese estado solo se llega creando una invitacion, y de el solo se sale
  aceptandola. Ponerlo aqui permitiria fabricar a mano una persona en un estado
  que el flujo de invitaciones da por suyo.
*/
export const ESTADOS = ['activa', 'suspendida', 'retirada', 'egresada'] as const;

export class ListarPersonasDto {
  @IsOptional()
  @recortar()
  @IsString()
  @Length(0, 120)
  busqueda?: string;

  @IsOptional()
  @IsIn([...ROLES, 'administracion'], { message: 'Rol de filtro no valido.' })
  rol?: string;

  @IsOptional()
  @IsIn([...ESTADOS, 'invitada'], { message: 'Estado de filtro no valido.' })
  estado?: string;

  /*
    Type(() => Number) hace falta porque los parametros de query llegan siempre
    como texto: sin el, IsInt rechazaria "1" por no ser un numero.
  */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  porPagina?: number;
}

export class ActualizarPersonaDto {
  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @Length(1, 40, { message: 'El codigo debe tener entre 1 y 40 caracteres.' })
  codigo?: string | null;

  @IsOptional()
  @IsUUID('4')
  unidadAcademicaId?: string | null;

  @IsOptional()
  @IsUUID('4')
  sedeId?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de ingreso no es valida.' })
  ingresoEn?: string | null;

  @IsOptional()
  @IsIn(ESTADOS, { message: 'Estado de membresia no valido.' })
  estado?: string;
}

/*
  Los roles se mandan completos, no de uno en uno. Una persona puede ser docente
  y estudiante a la vez, y la pregunta que responde esta pantalla es "que es
  esta persona aqui", no "anade un rol": mandar la lista entera hace que el
  servidor vea el resultado que se quiere y calcule el como.
*/
export class RolesDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Una membresia necesita al menos un rol.' })
  @ArrayMaxSize(6)
  @IsIn(ROLES, { each: true, message: 'Hay un rol que no existe.' })
  roles!: string[];
}
