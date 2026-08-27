import { Module } from '@nestjs/common';
import { PosControlador } from './pos.controlador';
import { PosServicio } from './pos.servicio';

@Module({ controllers: [PosControlador], providers: [PosServicio] })
export class PosModule {}
