import { AppointmentStatus } from './index';

// Single source of truth for the status state machine, shared by the API's
// domain layer (which wraps this with InvalidStatusTransitionError) and the
// web app (which uses it to decide which status actions to offer).
export const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.SCHEDULED]: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.COMPLETED]: [],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.NO_SHOW]: [],
};

export function getAllowedNextStatuses(status: AppointmentStatus): AppointmentStatus[] {
  return ALLOWED_TRANSITIONS[status];
}

export function isTerminalStatus(status: AppointmentStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}
