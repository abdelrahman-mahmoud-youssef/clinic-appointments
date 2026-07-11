import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@clinic/shared';
import { ClinicId } from '../../shared/decorators/clinic-id.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientsService } from './patients.service';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  list(@ClinicId() clinicId: string) {
    return this.patientsService.list(clinicId);
  }

  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  @Post()
  create(@Body() dto: CreatePatientDto, @ClinicId() clinicId: string) {
    return this.patientsService.create(clinicId, dto.name);
  }
}
