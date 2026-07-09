import { Controller, Get } from '@nestjs/common';
import { ClinicId } from '../../shared/decorators/clinic-id.decorator';
import { DoctorsService } from './doctors.service';

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  list(@ClinicId() clinicId: string) {
    return this.doctorsService.list(clinicId);
  }
}
