import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Role } from '@clinic/shared';
import { ClinicId } from '../../shared/decorators/clinic-id.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { AvailabilityService } from './availability.service';
import { DoctorsService } from './doctors.service';
import { SetAvailabilityDto } from './dto/set-availability.dto';

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

  @Roles(Role.ADMIN)
  @Put(':id/availability')
  setAvailability(
    @Param('id') doctorId: string,
    @Body() dto: SetAvailabilityDto,
    @ClinicId() clinicId: string,
  ) {
    return this.availabilityService.setWorkingHours(clinicId, doctorId, dto.windows);
  }
}
