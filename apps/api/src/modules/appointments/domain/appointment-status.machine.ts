import { AppointmentStatus } from '@clinic/shared';
import { InvalidStatusTransitionError } from '../../../shared/errors/domain-errors';

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
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

export function isTerminalStatus(status: AppointmentStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

export function assertValidTransition(current: AppointmentStatus, next: AppointmentStatus): void {
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new InvalidStatusTransitionError(`Cannot transition appointment from ${current} to ${next}`);
  }
}
