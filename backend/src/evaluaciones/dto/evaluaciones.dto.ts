import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const TIPOS_PREGUNTA = [
  'seleccion_unica',
  'seleccion_multiple',
  'verdadero_falso',
  'respuesta_libre',
] as const;

export class OpcionPreguntaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  texto!: string;

  @IsBoolean()
  correcta!: boolean;
}

export class PreguntaEvaluacionDto {
  @IsIn(TIPOS_PREGUNTA)
  tipo!: (typeof TIPOS_PREGUNTA)[number];

  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  enunciado!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  explicacion?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10000)
  puntos!: number;

  @IsOptional()
  @IsBoolean()
  obligatoria?: boolean;

  @ValidateIf(
    (pregunta: PreguntaEvaluacionDto) =>
      pregunta.tipo === 'seleccion_unica' ||
      pregunta.tipo === 'seleccion_multiple',
  )
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OpcionPreguntaDto)
  opciones?: OpcionPreguntaDto[];

  @ValidateIf(
    (pregunta: PreguntaEvaluacionDto) => pregunta.tipo === 'verdadero_falso',
  )
  @IsBoolean()
  respuestaVerdadera?: boolean;
}

export class CrearEvaluacionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  instrucciones?: string;

  @IsISO8601()
  abreEn!: string;

  @IsISO8601()
  cierraEn!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(480)
  duracionMinutos!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  intentosPermitidos!: number;

  @IsOptional()
  @IsBoolean()
  barajarPreguntas?: boolean;

  @IsOptional()
  @IsBoolean()
  mostrarResultados?: boolean;

  @IsOptional()
  @IsBoolean()
  publicada?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PreguntaEvaluacionDto)
  preguntas!: PreguntaEvaluacionDto[];
}

export class PublicarEvaluacionDto {
  @IsBoolean()
  publicada!: boolean;
}

export class RespuestaPreguntaDto {
  @IsUUID()
  preguntaId!: string;

  @IsObject()
  respuesta!: Record<string, unknown>;
}

export class GuardarRespuestasDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RespuestaPreguntaDto)
  respuestas!: RespuestaPreguntaDto[];
}

export class CalificarRespuestaDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  puntos!: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comentario?: string;
}

export class CalendarioEvaluacionesDto {
  @IsISO8601()
  desde!: string;

  @IsISO8601()
  hasta!: string;
}
