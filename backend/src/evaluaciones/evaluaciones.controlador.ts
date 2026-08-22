import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DeDonde, type Origen } from '../comun/auditoria';
import { Actual, Roles, type Sesion } from '../comun/sesion';
import {
  CalendarioEvaluacionesDto,
  CalificarRespuestaDto,
  CrearEvaluacionDto,
  GuardarRespuestasDto,
  PublicarEvaluacionDto,
} from './dto/evaluaciones.dto';
import { EvaluacionesServicio } from './evaluaciones.servicio';

const ROLES_GESTION = [
  'propietario',
  'administrador',
  'coordinador',
  'docente',
];

@Controller('evaluaciones')
export class EvaluacionesControlador {
  constructor(private readonly evaluaciones: EvaluacionesServicio) {}

  @Get('curso/:cursoId')
  listarCurso(
    @Actual() sesion: Sesion,
    @Param('cursoId', ParseUUIDPipe) cursoId: string,
  ) {
    return this.evaluaciones.listarCurso(sesion, cursoId);
  }

  @Get('calendario')
  calendario(
    @Actual() sesion: Sesion,
    @Query() rango: CalendarioEvaluacionesDto,
  ) {
    return this.evaluaciones.calendario(sesion, rango);
  }

  @Roles(...ROLES_GESTION)
  @Post('curso/:cursoId')
  crear(
    @Actual() sesion: Sesion,
    @Param('cursoId', ParseUUIDPipe) cursoId: string,
    @Body() datos: CrearEvaluacionDto,
    @DeDonde() origen: Origen,
  ) {
    return this.evaluaciones.crear(sesion, cursoId, datos, origen);
  }

  @Roles(...ROLES_GESTION)
  @Patch(':id/publicacion')
  publicar(
    @Actual() sesion: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() datos: PublicarEvaluacionDto,
    @DeDonde() origen: Origen,
  ) {
    return this.evaluaciones.publicar(sesion, id, datos.publicada, origen);
  }

  @Roles(...ROLES_GESTION)
  @Delete(':id')
  eliminar(
    @Actual() sesion: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() origen: Origen,
  ) {
    return this.evaluaciones.eliminar(sesion, id, origen);
  }

  @Roles('estudiante')
  @Post(':id/iniciar')
  iniciar(
    @Actual() sesion: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() origen: Origen,
  ) {
    return this.evaluaciones.iniciar(sesion, id, origen);
  }

  @Roles('estudiante')
  @Patch('intentos/:id/respuestas')
  guardarRespuestas(
    @Actual() sesion: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() datos: GuardarRespuestasDto,
  ) {
    return this.evaluaciones.guardarRespuestas(sesion, id, datos);
  }

  @Roles('estudiante')
  @Post('intentos/:id/enviar')
  enviar(
    @Actual() sesion: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() origen: Origen,
  ) {
    return this.evaluaciones.enviar(sesion, id, origen);
  }

  @Roles(...ROLES_GESTION)
  @Get(':id/intentos')
  intentos(@Actual() sesion: Sesion, @Param('id', ParseUUIDPipe) id: string) {
    return this.evaluaciones.intentos(sesion, id);
  }

  @Roles(...ROLES_GESTION)
  @Get('intentos/:id')
  detalleIntento(
    @Actual() sesion: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evaluaciones.detalleIntento(sesion, id);
  }

  @Roles('estudiante')
  @Get('intentos/:id/resultado')
  resultadoPropio(
    @Actual() sesion: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evaluaciones.resultadoPropio(sesion, id);
  }

  @Roles(...ROLES_GESTION)
  @Patch('respuestas/:id/calificacion')
  calificarRespuesta(
    @Actual() sesion: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() datos: CalificarRespuestaDto,
    @DeDonde() origen: Origen,
  ) {
    return this.evaluaciones.calificarRespuesta(sesion, id, datos, origen);
  }
}
