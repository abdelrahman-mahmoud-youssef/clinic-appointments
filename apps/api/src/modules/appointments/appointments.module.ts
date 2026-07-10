import { Module } from '@nestjs/common';
import { DoctorsModule } from '../doctors/doctors.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsRepository } from './appointments.repository';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [DoctorsModule, ClinicsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsRepository],
})
export class AppointmentsModule {}
