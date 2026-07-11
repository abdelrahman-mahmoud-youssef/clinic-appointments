export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum Role {
  ADMIN = 'ADMIN',
  RECEPTIONIST = 'RECEPTIONIST',
  DOCTOR = 'DOCTOR',
}

export const INACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

export * from './appointment-status-transitions';
export * from './working-hours';
