import { Role } from '@clinic/shared';
import { apiFetch } from './client';

export interface StaffUser {
  id: string;
  email: string;
  role: Role;
  doctorId: string | null;
  createdAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: Role;
  doctorId?: string;
}

export function listUsers(): Promise<StaffUser[]> {
  return apiFetch('/users');
}

export function createUser(input: CreateUserInput): Promise<StaffUser> {
  return apiFetch('/users', { method: 'POST', body: JSON.stringify(input) });
}
