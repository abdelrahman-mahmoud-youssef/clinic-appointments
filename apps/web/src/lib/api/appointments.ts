import { AppointmentStatus } from '@clinic/shared';
import { apiFetch } from './client';

export interface Appointment {
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListAppointmentsParams {
  from?: string;
  to?: string;
  doctorId?: string;
  status?: AppointmentStatus;
}

export function listAppointments(params: ListAppointmentsParams = {}): Promise<Appointment[]> {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.doctorId) query.set('doctorId', params.doctorId);
  if (params.status) query.set('status', params.status);
  const suffix = query.toString();
  return apiFetch(`/appointments${suffix ? `?${suffix}` : ''}`);
}

export interface DayBucket {
  date: string;
  active: number;
}

export interface AppointmentSummary {
  active: number;
  counts: Record<AppointmentStatus, number>;
  byDay: DayBucket[];
}

export function getAppointmentSummary(params: { from: string; to: string }): Promise<AppointmentSummary> {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  return apiFetch(`/appointments/summary?${query.toString()}`);
}

export interface CreateAppointmentInput {
  patientId: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
  notes?: string;
}

export function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  return apiFetch('/appointments', { method: 'POST', body: JSON.stringify(input) });
}

export interface RescheduleAppointmentInput {
  id: string;
  startsAt: string;
  endsAt: string;
}

export function rescheduleAppointment({ id, ...body }: RescheduleAppointmentInput): Promise<Appointment> {
  return apiFetch(`/appointments/${id}/reschedule`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function changeAppointmentStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
  return apiFetch(`/appointments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
