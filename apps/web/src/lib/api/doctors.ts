import { apiFetch } from './client';

export interface Doctor {
  id: string;
  name: string;
}

export interface WorkingHoursWindow {
  weekday: number;
  startTime: string;
  endTime: string;
}

export function listDoctors(): Promise<Doctor[]> {
  return apiFetch('/doctors');
}

export function createDoctor(name: string): Promise<Doctor> {
  return apiFetch('/doctors', { method: 'POST', body: JSON.stringify({ name }) });
}

export function getDoctorAvailability(doctorId: string): Promise<WorkingHoursWindow[]> {
  return apiFetch(`/doctors/${doctorId}/availability`);
}
