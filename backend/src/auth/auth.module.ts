import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthControlador } from './auth.controlador';
import { AuthServicio } from './auth.servicio';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRETO'),
        signOptions: {
          expiresIn: `${config.get('JWT_MINUTOS') ?? 15}m`,
          issuer: 'educa',
        },
      }),
    }),
  ],
  controllers: [AuthControlador],
  providers: [AuthServicio],
  exports: [AuthServicio, JwtModule],
})
export class AuthModule {}
