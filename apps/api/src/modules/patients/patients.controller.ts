import { Controller, Get } from '@nestjs/common';
import { ClinicId } from '../../shared/decorators/clinic-id.decorator';
import { PatientsService } from './patients.service';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  list(@ClinicId() clinicId: string) {
    return this.patientsService.list(clinicId);
  }
}
