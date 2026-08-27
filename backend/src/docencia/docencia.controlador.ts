import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Actual, Roles, type Sesion } from '../comun/sesion';
import { DocenciaServicio } from './docencia.servicio';
import { AgendaDto } from './dto/docencia.dto';

/*
  Los roles se exigen aqui por comodidad, igual que en el resto del proyecto: el
  alcance real lo pone puede_gestionar_curso_aula dentro de cada consulta, y un
  estudiante que llegara hasta aqui se llevaria cero filas de todos modos. El
  decorador solo cambia esa lista vacia por un 403 que se entiende.
*/
@Roles('propietario', 'administrador', 'coordinador', 'docente')
@Controller('docencia')
export class DocenciaControlador {
  constructor(private readonly docencia: DocenciaServicio) {}

  @Get('reportes')
  reportes(@Actual() s: Sesion) {
    return this.docencia.reportes(s);
  }

  @Get('reportes/:cursoId')
  reporteCurso(
    @Actual() s: Sesion,
    @Param('cursoId', ParseUUIDPipe) cursoId: string,
  ) {
    return this.docencia.reporteCurso(s, cursoId);
  }

  @Get('agenda')
  agenda(@Actual() s: Sesion, @Query() rango: AgendaDto) {
    return this.docencia.agenda(s, rango);
  }
}
