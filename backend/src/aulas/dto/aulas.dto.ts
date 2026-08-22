import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CrearAulaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  descripcion?: string;
}

export class ActualizarPortadaCursoDto {
  @IsOptional()
  @IsString()
  @MaxLength(1_500_000)
  @Matches(/^(?:https?:\/\/|data:image\/(?:jpeg|png|webp);base64,)/)
  imagenUrl!: string | null;
}

export class CrearSemanaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  descripcion?: string;
}

export class ActualizarSemanaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  descripcion?: string | null;

  @IsOptional()
  @IsBoolean()
  publicada?: boolean;
}

export class CrearMaterialDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;
}

export class CrearTareaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  instrucciones?: string;

  @IsOptional()
  @IsISO8601()
  venceEn?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  puntos!: number;

  @IsOptional()
  @IsBoolean()
  publicada?: boolean;
}

export class ActualizarTareaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  instrucciones?: string | null;

  @IsOptional()
  @IsISO8601()
  venceEn?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  puntos?: number;

  @IsOptional()
  @IsBoolean()
  publicada?: boolean;
}

export class CalendarioTareasDto {
  @IsISO8601()
  desde!: string;

  @IsISO8601()
  hasta!: string;
}

export class CrearEntregaDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  comentario?: string;
}

export class CalificarEntregaDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  calificacion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  retroalimentacion?: string | null;
}
