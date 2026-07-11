import { Module } from '@nestjs/common';
import { ClinicsModule } from '../clinics/clinics.module';
import { AvailabilityRepository } from './availability.repository';
import { AvailabilityService } from './availability.service';
import { DoctorsController } from './doctors.controller';
import { DoctorsRepository } from './doctors.repository';
import { DoctorsService } from './doctors.service';

@Module({
  imports: [ClinicsModule],
  controllers: [DoctorsController],
  providers: [AvailabilityService, AvailabilityRepository, DoctorsService, DoctorsRepository],
  exports: [AvailabilityService, DoctorsService],
})
export class DoctorsModule {}
