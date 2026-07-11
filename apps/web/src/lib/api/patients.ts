import { apiFetch } from './client';

export interface Patient {
  id: string;
  name: string;
}

export function listPatients(): Promise<Patient[]> {
  return apiFetch('/patients');
}

export function createPatient(name: string): Promise<Patient> {
  return apiFetch('/patients', { method: 'POST', body: JSON.stringify({ name }) });
}
