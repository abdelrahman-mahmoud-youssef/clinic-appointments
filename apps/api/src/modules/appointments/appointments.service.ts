import { Injectable } from '@nestjs/common';
import { AppointmentStatus, Role } from '@clinic/shared';
import { Appointment } from '@prisma/client';
import {
  CrossTenantAccessError,
  DoctorUnavailableError,
  InvalidStatusTransitionError,
  OverlappingAppointmentError,
} from '../../shared/errors/domain-errors';
import { AvailabilityService } from '../doctors/availability.service';
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
  doctorId?: string;
  from?: Date;
  to?: Date;
  status?: AppointmentStatus;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly appointmentsRepository: AppointmentsRepository,
    private readonly availabilityService: AvailabilityService,
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
    return this.appointmentsRepository.list(filters);
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
