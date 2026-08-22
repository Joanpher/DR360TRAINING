import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { DeDonde, type Origen } from '../comun/auditoria';
import { Actual, Roles, type Sesion } from '../comun/sesion';
import { AnosServicio } from './anos.servicio';
import { AsignaturasServicio } from './asignaturas.servicio';
import { GradosServicio } from './grados.servicio';
import { SeccionesServicio } from './secciones.servicio';
import { SedesServicio } from './sedes.servicio';
import { UnidadesServicio } from './unidades.servicio';
import {
  ActualizarAnoDto,
  ActualizarAsignaturaDto,
  ActualizarCursoDto,
  ActualizarGradoDto,
  ActualizarSeccionDto,
  CrearAnoDto,
  CrearAsignaturaDto,
  CrearGradoDto,
  CrearSeccionDto,
  ListarCursosDto,
  ListarSeccionesDto,
  PeriodosDto,
  PlanEstudioDto,
} from './dto/escolar.dto';
import { ActualizarSedeDto, ActualizarUnidadDto, CrearSedeDto, CrearUnidadDto } from './dto/academico.dto';

/*
  La estructura del colegio en un controlador: es lo mismo visto por seis
  ventanas, y todas comparten la regla. Leer lo puede cualquier miembro -un
  estudiante necesita saber en que seccion esta y que materias lleva-; escribir,
  solo quien administra.

  Los metodos de escritura devuelven la lista completa ya actualizada. Son
  listas de decenas de filas, no de miles, y devolverlas ahorra al navegador
  una segunda vuelta para enterarse de lo que acaba de hacer.
*/
@Controller('academico')
export class AcademicoControlador {
  constructor(
    private readonly anos: AnosServicio,
    private readonly grados: GradosServicio,
    private readonly asignaturas: AsignaturasServicio,
    private readonly secciones: SeccionesServicio,
    private readonly sedes: SedesServicio,
    private readonly unidades: UnidadesServicio,
  ) {}

  // --- Anos escolares --------------------------------------------------------

  @Get('anos')
  listarAnos(@Actual() s: Sesion) {
    return this.anos.listar(s);
  }

  @Roles('propietario', 'administrador')
  @Post('anos')
  crearAno(@Actual() s: Sesion, @Body() d: CrearAnoDto, @DeDonde() o: Origen) {
    return this.anos.crear(s, d, o);
  }

  @Roles('propietario', 'administrador')
  @Patch('anos/:id')
  actualizarAno(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActualizarAnoDto,
    @DeDonde() o: Origen,
  ) {
    return this.anos.actualizar(s, id, d, o);
  }

  @Roles('propietario', 'administrador')
  @Put('anos/:id/periodos')
  guardarPeriodos(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: PeriodosDto,
    @DeDonde() o: Origen,
  ) {
    return this.anos.guardarPeriodos(s, id, d, o);
  }

  @Roles('propietario', 'administrador')
  @HttpCode(HttpStatus.OK)
  @Post('anos/:id/abrir')
  abrirAno(@Actual() s: Sesion, @Param('id', ParseUUIDPipe) id: string, @DeDonde() o: Origen) {
    return this.anos.abrir(s, id, o);
  }

  @Roles('propietario', 'administrador')
  @HttpCode(HttpStatus.OK)
  @Post('anos/:id/cerrar')
  cerrarAno(@Actual() s: Sesion, @Param('id', ParseUUIDPipe) id: string, @DeDonde() o: Origen) {
    return this.anos.cerrar(s, id, o);
  }

  @Roles('propietario', 'administrador')
  @Delete('anos/:id')
  eliminarAno(@Actual() s: Sesion, @Param('id', ParseUUIDPipe) id: string, @DeDonde() o: Origen) {
    return this.anos.eliminar(s, id, o);
  }

  // --- Grados y plan de estudio ---------------------------------------------

  @Get('grados')
  listarGrados(@Actual() s: Sesion) {
    return this.grados.listar(s);
  }

  @Roles('propietario', 'administrador')
  @Post('grados')
  crearGrado(@Actual() s: Sesion, @Body() d: CrearGradoDto, @DeDonde() o: Origen) {
    return this.grados.crear(s, d, o);
  }

  @Roles('propietario', 'administrador')
  @Patch('grados/:id')
  actualizarGrado(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActualizarGradoDto,
    @DeDonde() o: Origen,
  ) {
    return this.grados.actualizar(s, id, d, o);
  }

  @Roles('propietario', 'administrador')
  @Put('grados/:id/plan')
  guardarPlan(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: PlanEstudioDto,
    @DeDonde() o: Origen,
  ) {
    return this.grados.guardarPlan(s, id, d, o);
  }

  @Roles('propietario', 'administrador')
  @Delete('grados/:id')
  eliminarGrado(@Actual() s: Sesion, @Param('id', ParseUUIDPipe) id: string, @DeDonde() o: Origen) {
    return this.grados.eliminar(s, id, o);
  }

  // --- Asignaturas -----------------------------------------------------------

  @Get('asignaturas')
  listarAsignaturas(@Actual() s: Sesion) {
    return this.asignaturas.listar(s);
  }

  @Roles('propietario', 'administrador')
  @Post('asignaturas')
  crearAsignatura(@Actual() s: Sesion, @Body() d: CrearAsignaturaDto, @DeDonde() o: Origen) {
    return this.asignaturas.crear(s, d, o);
  }

  @Roles('propietario', 'administrador')
  @Patch('asignaturas/:id')
  actualizarAsignatura(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActualizarAsignaturaDto,
    @DeDonde() o: Origen,
  ) {
    return this.asignaturas.actualizar(s, id, d, o);
  }

  @Roles('propietario', 'administrador')
  @Delete('asignaturas/:id')
  eliminarAsignatura(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.asignaturas.eliminar(s, id, o);
  }

  // --- Secciones -------------------------------------------------------------

  @Get('secciones')
  listarSecciones(@Actual() s: Sesion, @Query() f: ListarSeccionesDto) {
    return this.secciones.listar(s, f);
  }

  @Roles('propietario', 'administrador')
  @Post('secciones')
  crearSeccion(@Actual() s: Sesion, @Body() d: CrearSeccionDto, @DeDonde() o: Origen) {
    return this.secciones.crear(s, d, o);
  }

  @Roles('propietario', 'administrador')
  @Patch('secciones/:id')
  actualizarSeccion(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActualizarSeccionDto,
    @DeDonde() o: Origen,
  ) {
    return this.secciones.actualizar(s, id, d, o);
  }

  @Roles('propietario', 'administrador')
  @HttpCode(HttpStatus.OK)
  @Post('secciones/:id/sincronizar-cursos')
  sincronizarCursos(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.secciones.sincronizarCursos(s, id, o);
  }

  @Roles('propietario', 'administrador')
  @Delete('secciones/:id')
  eliminarSeccion(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.secciones.eliminar(s, id, o);
  }

  // --- Cursos ----------------------------------------------------------------

  @Get('cursos')
  listarCursos(@Actual() s: Sesion, @Query() f: ListarCursosDto) {
    return this.secciones.listarCursos(s, f);
  }

  @Roles('propietario', 'administrador')
  @Patch('cursos/:id')
  actualizarCurso(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActualizarCursoDto,
    @DeDonde() o: Origen,
  ) {
    return this.secciones.actualizarCurso(s, id, d, o);
  }

  // --- Sedes -----------------------------------------------------------------

  @Get('sedes')
  listarSedes(@Actual() s: Sesion) {
    return this.sedes.listar(s);
  }

  @Roles('propietario', 'administrador')
  @Post('sedes')
  crearSede(@Actual() s: Sesion, @Body() d: CrearSedeDto, @DeDonde() o: Origen) {
    return this.sedes.crear(s, d, o);
  }

  @Roles('propietario', 'administrador')
  @Patch('sedes/:id')
  actualizarSede(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActualizarSedeDto,
    @DeDonde() o: Origen,
  ) {
    return this.sedes.actualizar(s, id, d, o);
  }

  @Roles('propietario', 'administrador')
  @HttpCode(HttpStatus.OK)
  @Post('sedes/:id/principal')
  marcarSedePrincipal(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.sedes.marcarPrincipal(s, id, o);
  }

  @Roles('propietario', 'administrador')
  @Delete('sedes/:id')
  eliminarSede(@Actual() s: Sesion, @Param('id', ParseUUIDPipe) id: string, @DeDonde() o: Origen) {
    return this.sedes.eliminar(s, id, o);
  }

  // --- Unidades academicas ---------------------------------------------------

  @Get('unidades')
  listarUnidades(@Actual() s: Sesion) {
    return this.unidades.listar(s);
  }

  @Roles('propietario', 'administrador')
  @Post('unidades')
  crearUnidad(@Actual() s: Sesion, @Body() d: CrearUnidadDto, @DeDonde() o: Origen) {
    return this.unidades.crear(s, d, o);
  }

  @Roles('propietario', 'administrador')
  @Patch('unidades/:id')
  actualizarUnidad(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActualizarUnidadDto,
    @DeDonde() o: Origen,
  ) {
    return this.unidades.actualizar(s, id, d, o);
  }

  @Roles('propietario', 'administrador')
  @Delete('unidades/:id')
  eliminarUnidad(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.unidades.eliminar(s, id, o);
  }
}
