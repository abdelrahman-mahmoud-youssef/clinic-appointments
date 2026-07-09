import { apiFetch } from './client';

export interface Patient {
  id: string;
  name: string;
}

export function listPatients(): Promise<Patient[]> {
  return apiFetch('/patients');
}
