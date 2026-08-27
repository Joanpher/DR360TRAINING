import { IsISO8601 } from 'class-validator';

/*
  El mismo par desde/hasta que usa el calendario de tareas. El rango se acota en
  el servicio y no aqui porque la regla es de negocio -no pedir un año entero de
  golpe- y no de forma del dato.
*/
export class AgendaDto {
  @IsISO8601()
  desde!: string;

  @IsISO8601()
  hasta!: string;
}
