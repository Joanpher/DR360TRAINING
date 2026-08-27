import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ListarCertificadosDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  busqueda?: string;
}

export class EmitirCertificadoDto {
  @IsUUID('4', { message: 'La venta seleccionada no es válida.' })
  ventaId!: string;
}

export class EnviarCertificadoDto {
  @IsEmail({}, { message: 'El correo de destino no es válido.' })
  @MaxLength(160)
  correo!: string;
}

export class RevocarCertificadoDto {
  @IsString()
  @MaxLength(300)
  motivo!: string;
}
