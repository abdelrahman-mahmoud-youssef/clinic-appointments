import { apiFetch } from './client';

export interface Doctor {
  id: string;
  name: string;
}

export function listDoctors(): Promise<Doctor[]> {
  return apiFetch('/doctors');
}
