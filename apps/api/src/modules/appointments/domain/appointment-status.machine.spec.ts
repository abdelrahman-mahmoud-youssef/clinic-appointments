import { AppointmentStatus } from '@clinic/shared';
import { InvalidStatusTransitionError } from '../../../shared/errors/domain-errors';
import { assertValidTransition, isTerminalStatus } from './appointment-status.machine';

const ALL_STATUSES = Object.values(AppointmentStatus);

describe('assertValidTransition', () => {
  const legal: Array<[AppointmentStatus, AppointmentStatus]> = [
    [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED],
    [AppointmentStatus.SCHEDULED, AppointmentStatus.CANCELLED],
    [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED],
    [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
    [AppointmentStatus.CONFIRMED, AppointmentStatus.NO_SHOW],
  ];

  it.each(legal)('allows %s -> %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).not.toThrow();
  });

  const illegal: Array<[AppointmentStatus, AppointmentStatus]> = [
    [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED],
    [AppointmentStatus.SCHEDULED, AppointmentStatus.NO_SHOW],
    [AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED],
    [AppointmentStatus.COMPLETED, AppointmentStatus.SCHEDULED],
    [AppointmentStatus.COMPLETED, AppointmentStatus.CONFIRMED],
    [AppointmentStatus.CANCELLED, AppointmentStatus.CONFIRMED],
    [AppointmentStatus.NO_SHOW, AppointmentStatus.COMPLETED],
  ];

  it.each(illegal)('rejects %s -> %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).toThrow(InvalidStatusTransitionError);
  });

  const terminalStates = [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW];

  it.each(terminalStates)('rejects every transition out of terminal state %s', (terminal) => {
    for (const target of ALL_STATUSES) {
      if (target === terminal) continue;
      expect(() => assertValidTransition(terminal, target)).toThrow(InvalidStatusTransitionError);
    }
  });
});

describe('isTerminalStatus', () => {
  it('flags COMPLETED, CANCELLED, NO_SHOW as terminal', () => {
    expect(isTerminalStatus(AppointmentStatus.COMPLETED)).toBe(true);
    expect(isTerminalStatus(AppointmentStatus.CANCELLED)).toBe(true);
    expect(isTerminalStatus(AppointmentStatus.NO_SHOW)).toBe(true);
  });

  it('flags SCHEDULED and CONFIRMED as non-terminal', () => {
    expect(isTerminalStatus(AppointmentStatus.SCHEDULED)).toBe(false);
    expect(isTerminalStatus(AppointmentStatus.CONFIRMED)).toBe(false);
  });
});
