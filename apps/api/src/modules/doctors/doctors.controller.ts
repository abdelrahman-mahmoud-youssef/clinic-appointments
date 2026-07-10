import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@clinic/shared';
import { ClinicId } from '../../shared/decorators/clinic-id.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { AvailabilityService } from './availability.service';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';

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

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateDoctorDto, @ClinicId() clinicId: string) {
    return this.doctorsService.create(clinicId, dto.name);
  }

  @Get(':id/availability')
  getAvailability(@Param('id') doctorId: string, @ClinicId() clinicId: string) {
    return this.availabilityService.getWorkingHours(clinicId, doctorId);
  }
}
