import { Controller, Get, Param } from '@nestjs/common';
import { Actual, type Sesion } from '../comun/sesion';
import { CursosServicio } from './cursos.servicio';

/* Consultas de trabajo para estudiantes y docentes, separadas del panel admin. */
@Controller('portal')
export class PortalControlador {
  constructor(private readonly cursos: CursosServicio) {}

  @Get('cursos')
  listarCursos(@Actual() sesion: Sesion) {
    return this.cursos.listarPortal(sesion);
  }

  @Get('cursos/:codigo')
  detalleCurso(@Actual() sesion: Sesion, @Param('codigo') codigo: string) {
    return this.cursos.detallePortal(sesion, codigo);
  }
}
