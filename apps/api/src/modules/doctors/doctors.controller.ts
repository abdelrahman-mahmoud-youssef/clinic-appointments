import { Controller, Get, Param } from '@nestjs/common';
import { ClinicId } from '../../shared/decorators/clinic-id.decorator';
import { AvailabilityService } from './availability.service';
import { DoctorsService } from './doctors.service';

@Controller('doctors')
export class DoctorsController {
  constructor(
    private readonly doctorsService: DoctorsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Get()
  list(@ClinicId() clinicId: string) {
    return this.doctorsService.list(clinicId);
  }

  @Get(':id/availability')
  getAvailability(@Param('id') doctorId: string, @ClinicId() clinicId: string) {
    return this.availabilityService.getWorkingHours(clinicId, doctorId);
  }
}
