import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const recortar = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/* Los codigos se guardan en mayusculas: ISW y isw son el mismo programa. */
const codigo = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  );

const vacioEsNulo = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const limpio = value.trim();
    return limpio === '' ? null : limpio;
  });

// ---------------------------------------------------------------------------
// Sedes
// ---------------------------------------------------------------------------

export class CrearSedeDto {
  @codigo()
  @IsString()
  @Length(1, 20, { message: 'El codigo debe tener entre 1 y 20 caracteres.' })
  codigo!: string;

  @recortar()
  @IsString()
  @Length(2, 160, { message: 'El nombre debe tener entre 2 y 160 caracteres.' })
  nombre!: string;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(200)
  ciudad?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(300)
  direccion?: string | null;
}

export class ActualizarSedeDto {
  @IsOptional()
  @codigo()
  @IsString()
  @Length(1, 20)
  codigo?: string;

  @IsOptional()
  @recortar()
  @IsString()
  @Length(2, 160)
  nombre?: string;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(200)
  ciudad?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(300)
  direccion?: string | null;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

// ---------------------------------------------------------------------------
// Unidades academicas
// ---------------------------------------------------------------------------

export class CrearUnidadDto {
  @codigo()
  @IsString()
  @Length(1, 20)
  codigo!: string;

  @recortar()
  @IsString()
  @Length(2, 160)
  nombre!: string;

  @IsString()
  @Matches(/^(facultad|escuela|departamento|area)$/, {
    message: 'El tipo debe ser facultad, escuela, departamento o area.',
  })
  tipo!: string;

  @IsOptional()
  @IsUUID('4', { message: 'La unidad padre no es valida.' })
  padreId?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'La sede no es valida.' })
  sedeId?: string | null;
}

export class ActualizarUnidadDto {
  @IsOptional()
  @codigo()
  @IsString()
  @Length(1, 20)
  codigo?: string;

  @IsOptional()
  @recortar()
  @IsString()
  @Length(2, 160)
  nombre?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(facultad|escuela|departamento|area)$/)
  tipo?: string;

  /*
    null es un valor con significado: "esta unidad pasa a ser de primer nivel".
    Por eso no se puede usar el truco de "si no viene, no se toca" sin
    distinguir undefined de null, y por eso el servicio comprueba `in`.
  */
  @IsOptional()
  @IsUUID('4')
  padreId?: string | null;

  @IsOptional()
  @IsUUID('4')
  sedeId?: string | null;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}


