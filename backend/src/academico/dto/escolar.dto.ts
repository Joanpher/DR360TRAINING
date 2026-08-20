import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
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

export const NIVELES = ['inicial', 'primario', 'secundario'] as const;

// ---------------------------------------------------------------------------
// Ano escolar
// ---------------------------------------------------------------------------

export class CrearAnoDto {
  @codigo()
  @IsString()
  @Length(1, 20, { message: 'El codigo debe tener entre 1 y 20 caracteres.' })
  codigo!: string;

  @recortar()
  @IsString()
  @Length(2, 160)
  nombre!: string;

  @IsDateString({}, { message: 'La fecha de inicio no es valida.' })
  inicio!: string;

  @IsDateString({}, { message: 'La fecha de fin no es valida.' })
  fin!: string;

  @IsOptional()
  @vacioEsNulo()
  @IsDateString()
  inicioInscripcion?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsDateString()
  finInscripcion?: string | null;

  /*
    Cuantos cortes de nota lleva el ano. Cuatro es lo que pide el MINERD, pero
    un colegio privado puede trabajar con tres o con dos, asi que se pregunta en
    vez de darlo por hecho. Se generan repartiendo el calendario en partes
    iguales y luego se pueden ajustar una a una.
  */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  periodos?: number;
}

export class ActualizarAnoDto {
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
  @IsDateString()
  inicio?: string;

  @IsOptional()
  @IsDateString()
  fin?: string;

  @IsOptional()
  @vacioEsNulo()
  @IsDateString()
  inicioInscripcion?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsDateString()
  finInscripcion?: string | null;
}

export class PeriodoCalificacionDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsInt()
  @Min(1)
  @Max(8)
  orden!: number;

  @recortar()
  @IsString()
  @Length(1, 80)
  nombre!: string;

  @IsDateString()
  inicio!: string;

  @IsDateString()
  fin!: string;
}

export class PeriodosDto {
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => PeriodoCalificacionDto)
  periodos!: PeriodoCalificacionDto[];
}

// ---------------------------------------------------------------------------
// Grados
// ---------------------------------------------------------------------------

export class CrearGradoDto {
  @IsIn(NIVELES, { message: 'El nivel debe ser inicial, primario o secundario.' })
  nivel!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  orden!: number;

  @recortar()
  @IsString()
  @Length(2, 80)
  nombre!: string;

  @IsOptional()
  @IsUUID('4')
  unidadAcademicaId?: string | null;
}

export class ActualizarGradoDto {
  @IsOptional()
  @IsIn(NIVELES)
  nivel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  orden?: number;

  @IsOptional()
  @recortar()
  @IsString()
  @Length(2, 80)
  nombre?: string;

  @IsOptional()
  @IsUUID('4')
  unidadAcademicaId?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/*
  El plan de estudio de un grado se manda entero, no materia a materia: la
  pregunta que responde la pantalla es "que lleva 3ro de Primaria", y mandar la
  lista completa deja que el servidor calcule que se anade y que se quita.
*/
export class MateriaDelPlanDto {
  @IsUUID('4')
  asignaturaId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  horasSemanales?: number | null;
}

export class PlanEstudioDto {
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => MateriaDelPlanDto)
  materias!: MateriaDelPlanDto[];
}

// ---------------------------------------------------------------------------
// Asignaturas
// ---------------------------------------------------------------------------

export class CrearAsignaturaDto {
  @codigo()
  @IsString()
  @Length(1, 20)
  codigo!: string;

  @recortar()
  @IsString()
  @Length(2, 120)
  nombre!: string;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(120)
  area?: string | null;
}

export class ActualizarAsignaturaDto {
  @IsOptional()
  @codigo()
  @IsString()
  @Length(1, 20)
  codigo?: string;

  @IsOptional()
  @recortar()
  @IsString()
  @Length(2, 120)
  nombre?: string;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(120)
  area?: string | null;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

// ---------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------

export class CrearSeccionDto {
  @IsUUID('4', { message: 'El ano escolar no es valido.' })
  anoEscolarId!: string;

  @IsUUID('4', { message: 'El grado no es valido.' })
  gradoId!: string;

  /* 'A', 'B', 'Unica'. Corto a proposito: se lee junto al grado. */
  @codigo()
  @IsString()
  @Length(1, 20, { message: 'El nombre de la seccion es demasiado largo.' })
  nombre!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  cupo?: number | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(60)
  aula?: string | null;

  @IsOptional()
  @IsUUID('4')
  sedeId?: string | null;

  @IsOptional()
  @IsUUID('4')
  tutorMembresiaId?: string | null;
}

export class ActualizarSeccionDto {
  @IsOptional()
  @codigo()
  @IsString()
  @Length(1, 20)
  nombre?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  cupo?: number | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(60)
  aula?: string | null;

  @IsOptional()
  @IsUUID('4')
  sedeId?: string | null;

  @IsOptional()
  @IsUUID('4')
  tutorMembresiaId?: string | null;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class ListarSeccionesDto {
  @IsOptional()
  @IsUUID('4')
  anoEscolarId?: string;

  @IsOptional()
  @IsUUID('4')
  gradoId?: string;
}

// ---------------------------------------------------------------------------
// Cursos
// ---------------------------------------------------------------------------

export class ActualizarCursoDto {
  @IsOptional()
  @IsUUID('4')
  docenteMembresiaId?: string | null;

  @IsOptional()
  @Matches(/^(borrador|publicado|cerrado)$/, { message: 'Estado de curso no valido.' })
  estado?: string;
}

export class ListarCursosDto {
  @IsOptional()
  @IsUUID('4')
  anoEscolarId?: string;

  @IsOptional()
  @IsUUID('4')
  seccionId?: string;

  @IsOptional()
  @IsUUID('4')
  docenteMembresiaId?: string;

  @IsOptional()
  @IsIn(['borrador', 'publicado', 'cerrado', 'sin-docente'])
  estado?: string;
}
