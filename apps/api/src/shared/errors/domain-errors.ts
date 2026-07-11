export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class OverlappingAppointmentError extends DomainError {}

export class InvalidStatusTransitionError extends DomainError {}

export class DoctorUnavailableError extends DomainError {}

export class CrossTenantAccessError extends DomainError {}

export class AppointmentInThePastError extends DomainError {}
