import { Injectable } from '@nestjs/common';
import { AppointmentStatus, INACTIVE_STATUSES, Role } from '@clinic/shared';
import { Appointment } from '@prisma/client';
import {
  CrossTenantAccessError,
  DoctorUnavailableError,
  InvalidStatusTransitionError,
  OverlappingAppointmentError,
} from '../../shared/errors/domain-errors';
import { AvailabilityService } from '../doctors/availability.service';
import { ClinicsService } from '../clinics/clinics.service';
import { AppointmentsRepository } from './appointments.repository';
import { assertValidTransition, isTerminalStatus } from './domain/appointment-status.machine';

interface CreateAppointmentInput {
  clinicId: string;
  patientId: string;
  doctorId: string;
  startsAt: Date;
  endsAt: Date;
  reason?: string;
  notes?: string;
  actorUserId: string;
}

interface RescheduleInput {
  id: string;
  clinicId: string;
  startsAt: Date;
  endsAt: Date;
  actorUserId: string;
}

interface UpdateInput {
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string;
  startsAt: Date;
  endsAt: Date;
  reason?: string;
  notes?: string;
  actorUserId: string;
}

interface ChangeStatusInput {
  id: string;
  clinicId: string;
  status: AppointmentStatus;
  actorUserId: string;
  actorRole: Role;
  actorDoctorId?: string;
}

interface ListFilters {
  clinicId: string;
  actorRole: Role;
  actorDoctorId?: string;
  doctorId?: string;
  from?: Date;
  to?: Date;
  status?: AppointmentStatus;
}

interface RepositoryListFilters {
  clinicId: string;
  doctorId?: string;
  from?: Date;
  to?: Date;
  status?: AppointmentStatus;
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

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly appointmentsRepository: AppointmentsRepository,
    private readonly availabilityService: AvailabilityService,
    private readonly clinicsService: ClinicsService,
  ) {}

  async create(input: CreateAppointmentInput): Promise<Appointment> {
    await this.assertSameClinicReferences(input.clinicId, input.doctorId, input.patientId);
    await this.assertDoctorAvailable(input.clinicId, input.doctorId, input.startsAt, input.endsAt);
    await this.assertNoOverlap({
      clinicId: input.clinicId,
      doctorId: input.doctorId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });

    return this.appointmentsRepository.create({
      clinicId: input.clinicId,
      patientId: input.patientId,
      doctorId: input.doctorId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      reason: input.reason,
      notes: input.notes,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    });
  }

  async reschedule(input: RescheduleInput): Promise<Appointment> {
    const appointment = await this.getOwnedAppointment(input.id, input.clinicId);

    if (isTerminalStatus(appointment.status as AppointmentStatus)) {
      throw new InvalidStatusTransitionError(`Cannot reschedule a ${appointment.status} appointment`);
    }

    await this.assertDoctorAvailable(input.clinicId, appointment.doctorId, input.startsAt, input.endsAt);
    await this.assertNoOverlap({
      clinicId: input.clinicId,
      doctorId: appointment.doctorId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      excludeAppointmentId: appointment.id,
    });

    const updated = await this.appointmentsRepository.update(appointment.id, input.clinicId, {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      updatedBy: input.actorUserId,
    });

    return this.assertFound(updated, input.id);
  }

  async update(input: UpdateInput): Promise<Appointment> {
    const appointment = await this.getOwnedAppointment(input.id, input.clinicId);

    if (isTerminalStatus(appointment.status as AppointmentStatus)) {
      throw new InvalidStatusTransitionError(`Cannot edit a ${appointment.status} appointment`);
    }

    await this.assertSameClinicReferences(input.clinicId, input.doctorId, input.patientId);
    await this.assertDoctorAvailable(input.clinicId, input.doctorId, input.startsAt, input.endsAt);
    await this.assertNoOverlap({
      clinicId: input.clinicId,
      doctorId: input.doctorId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      excludeAppointmentId: appointment.id,
    });

    const updated = await this.appointmentsRepository.update(appointment.id, input.clinicId, {
      patientId: input.patientId,
      doctorId: input.doctorId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      reason: input.reason,
      notes: input.notes,
      updatedBy: input.actorUserId,
    });

    return this.assertFound(updated, input.id);
  }

  async changeStatus(input: ChangeStatusInput): Promise<Appointment> {
    const appointment = await this.getOwnedAppointment(input.id, input.clinicId);

    if (input.actorRole === Role.DOCTOR && appointment.doctorId !== input.actorDoctorId) {
      throw new CrossTenantAccessError(`Appointment ${input.id} is not assigned to you`);
    }

    assertValidTransition(appointment.status as AppointmentStatus, input.status);

    const updated = await this.appointmentsRepository.update(appointment.id, input.clinicId, {
      status: input.status,
      updatedBy: input.actorUserId,
    });

    return this.assertFound(updated, input.id);
  }

  findOne(id: string, clinicId: string): Promise<Appointment> {
    return this.getOwnedAppointment(id, clinicId);
  }

  list(filters: ListFilters): Promise<Appointment[]> {
    const scoped = this.scopeToActor(filters);
    return scoped ? this.appointmentsRepository.list(scoped) : Promise.resolve([]);
  }

  async summarize(filters: ListFilters): Promise<AppointmentSummary> {
    const appointments = await this.list(filters);
    const counts = Object.values(AppointmentStatus).reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as Record<AppointmentStatus, number>,
    );

    let active = 0;
    for (const appointment of appointments) {
      const status = appointment.status as AppointmentStatus;
      counts[status] += 1;
      if (!INACTIVE_STATUSES.includes(status)) {
        active += 1;
      }
    }

    const timezone = await this.clinicsService.getTimezone(filters.clinicId);
    const byDay = this.bucketActiveByDay(appointments, filters.from, filters.to, timezone);

    return { active, counts, byDay };
  }

  private bucketActiveByDay(
    appointments: Appointment[],
    from: Date | undefined,
    to: Date | undefined,
    timeZone: string,
  ): DayBucket[] {
    if (!from || !to) {
      return [];
    }

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const active = new Map<string, number>();
    for (const appointment of appointments) {
      if (INACTIVE_STATUSES.includes(appointment.status as AppointmentStatus)) {
        continue;
      }
      const key = formatter.format(appointment.startsAt);
      active.set(key, (active.get(key) ?? 0) + 1);
    }

    const days: DayBucket[] = [];
    for (let time = from.getTime(); time <= to.getTime(); time += DAY_MS) {
      const date = formatter.format(new Date(time));
      if (days.length > 0 && days[days.length - 1].date === date) {
        continue;
      }
      days.push({ date, active: active.get(date) ?? 0 });
    }
    return days;
  }

  private scopeToActor(filters: ListFilters): RepositoryListFilters | null {
    const { actorRole, actorDoctorId, ...rest } = filters;
    if (actorRole !== Role.DOCTOR) {
      return rest;
    }
    return actorDoctorId ? { ...rest, doctorId: actorDoctorId } : null;
  }

  private async getOwnedAppointment(id: string, clinicId: string): Promise<Appointment> {
    const appointment = await this.appointmentsRepository.findById(id, clinicId);
    return this.assertFound(appointment, id);
  }

  private assertFound(appointment: Appointment | null, id: string): Appointment {
    if (!appointment) {
      throw new CrossTenantAccessError(`Appointment ${id} does not belong to this clinic`);
    }
    return appointment;
  }

  private async assertSameClinicReferences(
    clinicId: string,
    doctorId: string,
    patientId: string,
  ): Promise<void> {
    const [doctorOk, patientOk] = await Promise.all([
      this.appointmentsRepository.doctorBelongsToClinic(doctorId, clinicId),
      this.appointmentsRepository.patientBelongsToClinic(patientId, clinicId),
    ]);

    if (!doctorOk) {
      throw new CrossTenantAccessError(`Doctor ${doctorId} not found in this clinic`);
    }
    if (!patientOk) {
      throw new CrossTenantAccessError(`Patient ${patientId} not found in this clinic`);
    }
  }

  private async assertDoctorAvailable(
    clinicId: string,
    doctorId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    const isAvailable = await this.availabilityService.isDoctorAvailable(
      clinicId,
      doctorId,
      startsAt,
      endsAt,
    );
    if (!isAvailable) {
      throw new DoctorUnavailableError(`Doctor ${doctorId} is not available for this time range`);
    }
  }

  private async assertNoOverlap(params: {
    clinicId: string;
    doctorId: string;
    startsAt: Date;
    endsAt: Date;
    excludeAppointmentId?: string;
  }): Promise<void> {
    const conflicts = await this.appointmentsRepository.findOverlapping(params);
    if (conflicts.length > 0) {
      throw new OverlappingAppointmentError('This time slot conflicts with an existing appointment');
    }
  }
}
