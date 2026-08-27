import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CrearReunionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  /* Ausente significa "ahora": la sala se abre al crearla. */
  @IsOptional()
  @IsISO8601()
  programadaPara?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(600)
  duracionMinutos?: number;

  @IsOptional()
  @IsBoolean()
  abrirSinAnfitrion?: boolean;

  @IsOptional()
  @IsBoolean()
  silenciarAlEntrar?: boolean;

  @IsOptional()
  @IsBoolean()
  camaraApagadaAlEntrar?: boolean;

  @IsOptional()
  @IsBoolean()
  permiteGrabacion?: boolean;

  /* Crear y abrir en un solo gesto: el boton "Iniciar clase ahora". */
  @IsOptional()
  @IsBoolean()
  iniciarAhora?: boolean;
}

export class ActualizarReunionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string | null;

  @IsOptional()
  @IsISO8601()
  programadaPara?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(600)
  duracionMinutos?: number;

  @IsOptional()
  @IsBoolean()
  abrirSinAnfitrion?: boolean;

  @IsOptional()
  @IsBoolean()
  silenciarAlEntrar?: boolean;

  @IsOptional()
  @IsBoolean()
  camaraApagadaAlEntrar?: boolean;

  @IsOptional()
  @IsBoolean()
  permiteGrabacion?: boolean;
}

export class CancelarReunionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
