import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, AppointmentsModule],
})
export class AppModule {}
