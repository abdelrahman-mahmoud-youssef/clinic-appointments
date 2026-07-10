import { Injectable } from '@nestjs/common';
import { CrossTenantAccessError } from '../../shared/errors/domain-errors';
import { ClinicsRepository } from './clinics.repository';

export interface ClinicSettings {
  name: string;
  dayStartHour: number;
  dayEndHour: number;
  timezone: string;
}

@Injectable()
export class ClinicsService {
  constructor(private readonly clinicsRepository: ClinicsRepository) {}

  async getSettings(clinicId: string): Promise<ClinicSettings> {
    const clinic = await this.getClinic(clinicId);
    return {
      name: clinic.name,
      dayStartHour: clinic.dayStartHour,
      dayEndHour: clinic.dayEndHour,
      timezone: clinic.timezone,
    };
  }

  async getTimezone(clinicId: string): Promise<string> {
    const clinic = await this.getClinic(clinicId);
    return clinic.timezone;
  }

  async updateSettings(
    clinicId: string,
    data: { dayStartHour: number; dayEndHour: number },
  ): Promise<ClinicSettings> {
    const clinic = await this.clinicsRepository.updateSettings(clinicId, data);
    return {
      name: clinic.name,
      dayStartHour: clinic.dayStartHour,
      dayEndHour: clinic.dayEndHour,
      timezone: clinic.timezone,
    };
  }

  private async getClinic(clinicId: string) {
    const clinic = await this.clinicsRepository.findById(clinicId);
    if (!clinic) {
      throw new CrossTenantAccessError(`Clinic ${clinicId} does not exist`);
    }
    return clinic;
  }
}
