import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const recortar = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/* Los codigos se guardan en mayusculas: ING-101 e ing-101 son el mismo curso. */
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

const MODALIDADES = ['presencial', 'virtual', 'hibrido'] as const;
const NIVELES = ['basico', 'intermedio', 'avanzado'] as const;
const ESTADOS_CURSO = ['promocion', 'activo', 'graduado'] as const;

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
// Categorias
// ---------------------------------------------------------------------------

export class CategoriaDto {
  @recortar()
  @IsString()
  @Length(2, 80, { message: 'El nombre de la categoria es obligatorio.' })
  nombre!: string;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(300)
  descripcion?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'El color debe ser un hex como #2f6f4e.',
  })
  color?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

// ---------------------------------------------------------------------------
// Cursos
// ---------------------------------------------------------------------------

/*
  Un bloque semanal del curso: "lunes de 18:00 a 20:00". Las horas viajan como
  'HH:MM' y no como Date porque son una hora del reloj, no un instante: las seis
  de la tarde son las seis de la tarde en el aula, sin zona horaria que aplicar.
*/
export class HorarioDto {
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'El dia va de 1 (lunes) a 7 (domingo).' })
  @Max(7, { message: 'El dia va de 1 (lunes) a 7 (domingo).' })
  diaSemana!: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de inicio debe ser HH:MM.',
  })
  horaInicio!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de fin debe ser HH:MM.',
  })
  horaFin!: string;
}

export class CrearCursoDto {
  @codigo()
  @IsString()
  @Length(2, 30, { message: 'El codigo debe tener entre 2 y 30 caracteres.' })
  codigo!: string;

  @recortar()
  @IsString()
  @Length(3, 160, { message: 'El nombre del curso es obligatorio.' })
  nombre!: string;

  /* Una linea para la tarjeta del catalogo. La descripcion larga va aparte. */
  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(300)
  resumen?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(5000)
  descripcion?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'La categoria no es valida.' })
  categoriaId?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'El instructor no es valido.' })
  instructorMembresiaId?: string | null;

  @IsOptional()
  @IsIn(MODALIDADES, {
    message: 'La modalidad debe ser presencial, virtual o hibrido.',
  })
  modalidad?: string;

  @IsOptional()
  @IsIn(NIVELES, {
    message: 'El nivel debe ser basico, intermedio o avanzado.',
  })
  nivel?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'La sede no es valida.' })
  sedeId?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(80)
  aula?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(1_500_000, {
    message: 'La imagen de portada es demasiado pesada.',
  })
  @Matches(/^(?:https?:\/\/|data:image\/(?:jpeg|png|webp);base64,)/, {
    message: 'La imagen de portada no tiene un formato valido.',
  })
  imagenUrl?: string | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio no es valido.' })
  @Min(0, { message: 'El precio no puede ser negativo.' })
  precio!: number;

  @IsOptional()
  @codigo()
  @Matches(/^[A-Z]{3}$/, {
    message: 'La moneda son tres letras: DOP, USD, EUR.',
  })
  moneda?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'La duracion debe ser de al menos una semana.' })
  @Max(520)
  duracionSemanas!: number;

  @vacioEsNulo()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de inicio no es valida.',
  })
  iniciaEn!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, {
    message: 'El cupo debe ser al menos 1. Dejalo vacio para no limitarlo.',
  })
  @Max(10000)
  cupo?: number | null;

  @IsOptional()
  @IsBoolean()
  certificado?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(14, {
    message: 'Catorce bloques de horario son mas que suficientes.',
  })
  @ValidateNested({ each: true })
  @Type(() => HorarioDto)
  horarios?: HorarioDto[];
}

/*
  Todo opcional. Distinguir undefined de null importa: undefined es "no toques
  este campo" y null es "vacialo". Por eso los servicios comprueban con `in` y
  no con `??`, que confundiria las dos cosas.
*/
export class ActualizarCursoDto {
  @IsOptional()
  @codigo()
  @IsString()
  @Length(2, 30)
  codigo?: string;

  @IsOptional()
  @recortar()
  @IsString()
  @Length(3, 160)
  nombre?: string;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(300)
  resumen?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(5000)
  descripcion?: string | null;

  @IsOptional()
  @IsUUID('4')
  categoriaId?: string | null;

  @IsOptional()
  @IsUUID('4')
  instructorMembresiaId?: string | null;

  @IsOptional()
  @IsIn(MODALIDADES)
  modalidad?: string;

  @IsOptional()
  @IsIn(NIVELES)
  nivel?: string | null;

  @IsOptional()
  @IsUUID('4')
  sedeId?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(80)
  aula?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(1_500_000)
  @Matches(/^(?:https?:\/\/|data:image\/(?:jpeg|png|webp);base64,)/)
  imagenUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio?: number;

  @IsOptional()
  @codigo()
  @Matches(/^[A-Z]{3}$/)
  moneda?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(520)
  duracionSemanas?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  iniciaEn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  cupo?: number | null;

  @IsOptional()
  @IsBoolean()
  certificado?: boolean;

  /*
    Si viene, reemplaza el horario entero. Un horario es un conjunto pequeno que
    se piensa como un todo -"martes y jueves de 6 a 8"-, y parchearlo bloque a
    bloque obligaria a inventar ids en el formulario para nada.
  */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(14)
  @ValidateNested({ each: true })
  @Type(() => HorarioDto)
  horarios?: HorarioDto[];
}

export class ListarCursosDto {
  @IsOptional()
  @IsUUID('4')
  categoriaId?: string;

  @IsOptional()
  @IsUUID('4')
  instructorMembresiaId?: string;

  @IsOptional()
  @IsIn(ESTADOS_CURSO)
  estado?: string;

  @IsOptional()
  @IsIn(MODALIDADES)
  modalidad?: string;

  @IsOptional()
  @recortar()
  @IsString()
  @MaxLength(120)
  busqueda?: string;
}
