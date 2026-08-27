import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { DeDonde, type Origen } from '../comun/auditoria';
import { Actual, Roles, type Sesion } from '../comun/sesion';
import { ReunionesServicio } from './reuniones.servicio';
import {
  ActualizarReunionDto,
  CancelarReunionDto,
  CrearReunionDto,
} from './dto/reuniones.dto';

/*
  Las rutas literales van antes que las que llevan :id. Nest las prueba en el
  orden en que estan escritas, y con /reuniones/:id declarada primero, una
  peticion a /reuniones/agenda entraria por ahi -y moriria en el ParseUUIDPipe
  con un error que no explica nada-.

  El decorador @Roles solo evita un 403 legible en vez de una consulta que
  vuelve vacia: quien decide de verdad es la politica del curso, que sabe si
  esta persona imparte ESTE curso y no solo si es docente de algo.
*/
const ROLES_GESTION = [
  'propietario',
  'administrador',
  'coordinador',
  'docente',
];

@Controller('reuniones')
export class ReunionesControlador {
  constructor(private readonly reuniones: ReunionesServicio) {}

  @Get('agenda')
  agenda(@Actual() s: Sesion) {
    return this.reuniones.agenda(s);
  }

  @Get('en-vivo')
  enVivo(@Actual() s: Sesion) {
    return this.reuniones.enVivo(s);
  }

  @Get('curso/:cursoId')
  deCurso(
    @Actual() s: Sesion,
    @Param('cursoId', ParseUUIDPipe) cursoId: string,
  ) {
    return this.reuniones.deCurso(s, cursoId);
  }

  @Roles(...ROLES_GESTION)
  @Post('curso/:cursoId')
  crear(
    @Actual() s: Sesion,
    @Param('cursoId', ParseUUIDPipe) cursoId: string,
    @Body() d: CrearReunionDto,
    @DeDonde() o: Origen,
  ) {
    return this.reuniones.crear(s, cursoId, d, o);
  }

  @Roles(...ROLES_GESTION)
  @Patch(':id')
  actualizar(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActualizarReunionDto,
    @DeDonde() o: Origen,
  ) {
    return this.reuniones.actualizar(s, id, d, o);
  }

  @Roles(...ROLES_GESTION)
  @Post(':id/iniciar')
  iniciar(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.reuniones.iniciar(s, id, o);
  }

  @Roles(...ROLES_GESTION)
  @Post(':id/finalizar')
  finalizar(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.reuniones.finalizar(s, id, o);
  }

  @Roles(...ROLES_GESTION)
  @Post(':id/cancelar')
  cancelar(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CancelarReunionDto,
    @DeDonde() o: Origen,
  ) {
    return this.reuniones.cancelar(s, id, d, o);
  }

  /* Sin @Roles: entrar a clase es justo lo que hace el alumnado. */
  @Post(':id/entrar')
  entrar(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.reuniones.entrar(s, id, o);
  }

  @Post(':id/salir')
  salir(@Actual() s: Sesion, @Param('id', ParseUUIDPipe) id: string) {
    return this.reuniones.salir(s, id);
  }

  @Roles(...ROLES_GESTION)
  @Get(':id/asistencia')
  asistencia(@Actual() s: Sesion, @Param('id', ParseUUIDPipe) id: string) {
    return this.reuniones.asistencia(s, id);
  }
}
