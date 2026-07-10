import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Role } from '@clinic/shared';
import { ClinicId } from '../../shared/decorators/clinic-id.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ClinicsService } from './clinics.service';
import { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto';

@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get('me')
  getSettings(@ClinicId() clinicId: string) {
    return this.clinicsService.getSettings(clinicId);
  }

  @Roles(Role.ADMIN)
  @Patch('me')
  updateSettings(@Body() dto: UpdateClinicSettingsDto, @ClinicId() clinicId: string) {
    return this.clinicsService.updateSettings(clinicId, {
      dayStartHour: dto.dayStartHour,
      dayEndHour: dto.dayEndHour,
    });
  }
}
