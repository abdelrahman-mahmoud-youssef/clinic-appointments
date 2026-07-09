import { AppointmentStatus, getAllowedNextStatuses, isTerminalStatus } from '@clinic/shared';
import { InvalidStatusTransitionError } from '../../../shared/errors/domain-errors';

export { isTerminalStatus };

export function assertValidTransition(current: AppointmentStatus, next: AppointmentStatus): void {
  if (!getAllowedNextStatuses(current).includes(next)) {
    throw new InvalidStatusTransitionError(`Cannot transition appointment from ${current} to ${next}`);
  }
}
