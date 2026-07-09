import { Module } from '@nestjs/common';
import { AvailabilityRepository } from './availability.repository';
import { AvailabilityService } from './availability.service';

@Module({
  providers: [AvailabilityService, AvailabilityRepository],
  exports: [AvailabilityService],
})
export class DoctorsModule {}
