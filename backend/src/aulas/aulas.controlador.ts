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
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DeDonde, type Origen } from '../comun/auditoria';
import { Actual, Roles, type Sesion } from '../comun/sesion';
import { AulasServicio, type ArchivoSubido } from './aulas.servicio';
import {
  ActualizarSemanaDto,
  ActualizarPortadaCursoDto,
  ActualizarTareaDto,
  CalificarEntregaDto,
  CalendarioTareasDto,
  CrearAulaDto,
  CrearEntregaDto,
  CrearMaterialDto,
  CrearSemanaDto,
  CrearTareaDto,
} from './dto/aulas.dto';

const ROLES_GESTION = [
  'propietario',
  'administrador',
  'coordinador',
  'docente',
];

@Controller('aulas')
export class AulasControlador {
  constructor(private readonly aulas: AulasServicio) {}

  @Get('curso/:cursoId')
  obtener(
    @Actual() s: Sesion,
    @Param('cursoId', ParseUUIDPipe) cursoId: string,
  ) {
    return this.aulas.obtener(s, cursoId);
  }

  @Get('tareas/calendario')
  calendario(@Actual() s: Sesion, @Query() rango: CalendarioTareasDto) {
    return this.aulas.tareasCalendario(s, rango);
  }

  @Roles(...ROLES_GESTION)
  @Post('curso/:cursoId')
  crear(
    @Actual() s: Sesion,
    @Param('cursoId', ParseUUIDPipe) cursoId: string,
    @Body() d: CrearAulaDto,
    @DeDonde() o: Origen,
  ) {
    return this.aulas.crear(s, cursoId, d, o);
  }

  @Roles(...ROLES_GESTION)
  @Patch('curso/:cursoId/portada')
  actualizarPortada(
    @Actual() s: Sesion,
    @Param('cursoId', ParseUUIDPipe) cursoId: string,
    @Body() d: ActualizarPortadaCursoDto,
    @DeDonde() o: Origen,
  ) {
    return this.aulas.actualizarPortada(s, cursoId, d.imagenUrl ?? null, o);
  }

  @Roles(...ROLES_GESTION)
  @Post(':aulaId/semanas')
  agregarSemana(
    @Actual() s: Sesion,
    @Param('aulaId', ParseUUIDPipe) aulaId: string,
    @Body() d: CrearSemanaDto,
    @DeDonde() o: Origen,
  ) {
    return this.aulas.agregarSemana(s, aulaId, d, o);
  }

  @Roles(...ROLES_GESTION)
  @Patch('semanas/:semanaId')
  actualizarSemana(
    @Actual() s: Sesion,
    @Param('semanaId', ParseUUIDPipe) semanaId: string,
    @Body() d: ActualizarSemanaDto,
    @DeDonde() o: Origen,
  ) {
    return this.aulas.actualizarSemana(s, semanaId, d, o);
  }

  @Roles(...ROLES_GESTION)
  @Post('semanas/:semanaId/materiales')
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    }),
  )
  agregarMaterial(
    @Actual() s: Sesion,
    @Param('semanaId', ParseUUIDPipe) semanaId: string,
    @Body() d: CrearMaterialDto,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @DeDonde() o: Origen,
  ) {
    return this.aulas.agregarMaterial(s, semanaId, d, archivo, o);
  }

  @Get('materiales/:id/archivo')
  async descargar(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const archivo = await this.aulas.archivo(s, id);
    const nombre = encodeURIComponent(archivo.nombre);
    respuesta.setHeader('Content-Type', archivo.mime);
    respuesta.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${nombre}`,
    );
    respuesta.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(archivo.contenido);
  }

  @Roles(...ROLES_GESTION)
  @Delete('materiales/:id')
  eliminarMaterial(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.aulas.eliminarMaterial(s, id, o);
  }

  @Roles(...ROLES_GESTION)
  @Post('semanas/:semanaId/tareas')
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    }),
  )
  crearTarea(
    @Actual() s: Sesion,
    @Param('semanaId', ParseUUIDPipe) semanaId: string,
    @Body() d: CrearTareaDto,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @DeDonde() o: Origen,
  ) {
    return this.aulas.crearTarea(s, semanaId, d, archivo, o);
  }

  @Get('tareas/:id/archivo')
  async descargarArchivoTarea(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const archivo = await this.aulas.archivoTarea(s, id);
    const nombre = encodeURIComponent(archivo.nombre);
    respuesta.setHeader('Content-Type', archivo.mime);
    respuesta.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${nombre}`,
    );
    respuesta.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(archivo.contenido);
  }

  @Roles('estudiante')
  @Post('tareas/:id/entrega')
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    }),
  )
  entregarTarea(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CrearEntregaDto,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @DeDonde() o: Origen,
  ) {
    return this.aulas.entregarTarea(s, id, d, archivo, o);
  }

  @Roles(...ROLES_GESTION)
  @Get('tareas/:id/entregas')
  entregasTarea(@Actual() s: Sesion, @Param('id', ParseUUIDPipe) id: string) {
    return this.aulas.entregasTarea(s, id);
  }

  @Roles(...ROLES_GESTION)
  @Patch('entregas/:id/calificacion')
  calificarEntrega(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CalificarEntregaDto,
    @DeDonde() o: Origen,
  ) {
    return this.aulas.calificarEntrega(s, id, d, o);
  }

  @Get('entregas/:id/archivo')
  async descargarEntrega(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const archivo = await this.aulas.archivoEntrega(s, id);
    const nombre = encodeURIComponent(archivo.nombre);
    respuesta.setHeader('Content-Type', archivo.mime);
    respuesta.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${nombre}`,
    );
    respuesta.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(archivo.contenido);
  }

  @Roles(...ROLES_GESTION)
  @Patch('tareas/:id')
  actualizarTarea(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActualizarTareaDto,
    @DeDonde() o: Origen,
  ) {
    return this.aulas.actualizarTarea(s, id, d, o);
  }

  @Roles(...ROLES_GESTION)
  @Delete('tareas/:id')
  eliminarTarea(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.aulas.eliminarTarea(s, id, o);
  }
}
