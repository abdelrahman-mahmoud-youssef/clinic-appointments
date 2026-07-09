import { AppointmentStatus } from '@clinic/shared';

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: '#64748b',
  [AppointmentStatus.CONFIRMED]: '#2563eb',
  [AppointmentStatus.COMPLETED]: '#16a34a',
  [AppointmentStatus.CANCELLED]: '#dc2626',
  [AppointmentStatus.NO_SHOW]: '#ea580c',
};

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Scheduled',
  [AppointmentStatus.CONFIRMED]: 'Confirmed',
  [AppointmentStatus.COMPLETED]: 'Completed',
  [AppointmentStatus.CANCELLED]: 'Cancelled',
  [AppointmentStatus.NO_SHOW]: 'No-show',
};
