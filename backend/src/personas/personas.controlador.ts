import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { DeDonde, type Origen } from '../comun/auditoria';
import { Actual, Roles, type Sesion } from '../comun/sesion';
import {
  ActualizarPersonaDto,
  CrearPersonaDto,
  ListarPersonasDto,
  RolesDto,
} from './dto/personas.dto';
import { PersonasServicio } from './personas.servicio';

/*
  Todo el controlador exige rol de administracion, incluida la lectura. Es la
  diferencia con /academico: que existan los grados de un colegio no es
  secreto para nadie que estudie ahi, pero el directorio completo con correos,
  matriculas y quien no ha entrado nunca si lo es.
*/
@Roles('propietario', 'administrador')
@Controller('personas')
export class PersonasControlador {
  constructor(private readonly personas: PersonasServicio) {}

  @Get()
  listar(@Actual() sesion: Sesion, @Query() filtros: ListarPersonasDto) {
    return this.personas.listar(sesion, filtros);
  }

  @Post()
  crear(
    @Actual() sesion: Sesion,
    @Body() datos: CrearPersonaDto,
    @DeDonde() origen: Origen,
  ) {
    return this.personas.crear(sesion, datos, origen);
  }

  @Patch(':id')
  actualizar(
    @Actual() sesion: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() datos: ActualizarPersonaDto,
    @DeDonde() origen: Origen,
  ) {
    return this.personas.actualizar(sesion, id, datos, origen);
  }

  @Put(':id/roles')
  cambiarRoles(
    @Actual() sesion: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() datos: RolesDto,
    @DeDonde() origen: Origen,
  ) {
    return this.personas.cambiarRoles(sesion, id, datos, origen);
  }
}
