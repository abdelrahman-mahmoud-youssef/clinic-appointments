import { apiFetch } from './client';

export interface ClinicSettings {
  name: string;
  dayStartHour: number;
  dayEndHour: number;
  timezone: string;
}

export function getClinicSettings(): Promise<ClinicSettings> {
  return apiFetch('/clinics/me');
}

export function updateClinicSettings(input: {
  dayStartHour: number;
  dayEndHour: number;
}): Promise<ClinicSettings> {
  return apiFetch('/clinics/me', { method: 'PATCH', body: JSON.stringify(input) });
}
