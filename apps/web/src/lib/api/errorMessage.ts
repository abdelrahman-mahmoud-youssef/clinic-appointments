import { ApiError } from './client';

// Maps the API's domain error names (see apps/api/src/shared/errors/domain-errors.ts)
// to plain-language messages. Falls back to the API's own message for anything not
// listed here, so a new domain error still surfaces something meaningful.
const FRIENDLY_MESSAGES: Partial<Record<string, string>> = {
  OverlappingAppointmentError: 'This slot conflicts with an existing appointment.',
  DoctorUnavailableError: "The doctor isn't available at that time.",
  InvalidStatusTransitionError: 'That status change is not allowed from the current status.',
  CrossTenantAccessError: "You don't have access to that appointment.",
};

export function extractErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return FRIENDLY_MESSAGES[error.errorName] ?? error.message;
  }
  return 'Something went wrong. Please try again.';
}
