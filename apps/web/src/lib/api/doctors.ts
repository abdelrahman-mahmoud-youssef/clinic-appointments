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

export function getDoctorAvailability(doctorId: string): Promise<WorkingHoursWindow[]> {
  return apiFetch(`/doctors/${doctorId}/availability`);
}

export function setDoctorAvailability(
  doctorId: string,
  windows: WorkingHoursWindow[],
): Promise<WorkingHoursWindow[]> {
  return apiFetch(`/doctors/${doctorId}/availability`, {
    method: 'PUT',
    body: JSON.stringify({ windows }),
  });
}
