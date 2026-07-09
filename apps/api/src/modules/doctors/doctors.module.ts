import { Module } from '@nestjs/common';
import { AvailabilityRepository } from './availability.repository';
import { AvailabilityService } from './availability.service';
import { DoctorsController } from './doctors.controller';
import { DoctorsRepository } from './doctors.repository';
import { DoctorsService } from './doctors.service';

@Module({
  controllers: [DoctorsController],
  providers: [AvailabilityService, AvailabilityRepository, DoctorsService, DoctorsRepository],
  exports: [AvailabilityService],
})
export class DoctorsModule {}
