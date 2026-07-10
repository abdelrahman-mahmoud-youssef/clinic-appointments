import { Controller, Get } from '@nestjs/common';
import { ClinicId } from '../../shared/decorators/clinic-id.decorator';
import { ClinicsService } from './clinics.service';

@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get('me')
  getSettings(@ClinicId() clinicId: string) {
    return this.clinicsService.getSettings(clinicId);
  }
}
