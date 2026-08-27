import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
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

export class BuscarCursosCertificadoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  busqueda?: string;
}

/*
  Cobrar desde la lista de clase. El monto es opcional a proposito: el caso de
  siempre es cobrar el precio entero, y obligar a escribirlo en cada fila seria
  pedir un dato que el sistema ya sabe. Quien cobre a medias lo escribe.
*/
export class CobrarCertificadoDto {
  @IsUUID('4', { message: 'La inscripción no es válida.' })
  inscripcionId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto recibido no es válido.' },
  )
  @Min(0)
  montoRecibido?: number;

  @IsIn(['efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'], {
    message: 'Ese método de pago no existe.',
  })
  metodo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  referencia?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string | null;
}
