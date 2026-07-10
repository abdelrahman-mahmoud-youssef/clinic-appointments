import { apiFetch } from './client';

export interface ClinicSettings {
  dayStartHour: number;
  dayEndHour: number;
  timezone: string;
}

export function getClinicSettings(): Promise<ClinicSettings> {
  return apiFetch('/clinics/me');
}
