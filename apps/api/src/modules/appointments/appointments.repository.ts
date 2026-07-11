import { Injectable } from '@nestjs/common';
import { Appointment, AppointmentStatus, Prisma } from '@prisma/client';
import { INACTIVE_STATUSES } from '@clinic/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { OverlappingAppointmentError } from '../../shared/errors/domain-errors';

const EXCLUSION_CONSTRAINT_NAME = 'no_double_booking';
const DEADLOCK_MESSAGE = 'deadlock detected';

interface CreateAppointmentData {
  clinicId: string;
  patientId: string;
  doctorId: string;
  startsAt: Date;
  endsAt: Date;
  reason?: string;
  notes?: string;
  createdBy: string;
  updatedBy: string;
}

interface OverlapQuery {
  clinicId: string;
  doctorId: string;
  startsAt: Date;
  endsAt: Date;
  excludeAppointmentId?: string;
}

interface ListQuery {
  clinicId: string;
  doctorId?: string;
  from?: Date;
  to?: Date;
  status?: AppointmentStatus;
  q?: string;
}

@Injectable()
export class AppointmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAppointmentData): Promise<Appointment> {
    try {
      return await this.prisma.appointment.create({ data });
    } catch (error) {
      throw this.translateError(error);
    }
  }

  findById(id: string, clinicId: string): Promise<Appointment | null> {
    return this.prisma.appointment.findFirst({ where: { id, clinicId } });
  }

  async doctorBelongsToClinic(doctorId: string, clinicId: string): Promise<boolean> {
    const count = await this.prisma.doctor.count({ where: { id: doctorId, clinicId } });
    return count > 0;
  }

  async patientBelongsToClinic(patientId: string, clinicId: string): Promise<boolean> {
    const count = await this.prisma.patient.count({ where: { id: patientId, clinicId } });
    return count > 0;
  }

  findOverlapping(query: OverlapQuery): Promise<Appointment[]> {
    return this.prisma.appointment.findMany({
      where: {
        clinicId: query.clinicId,
        doctorId: query.doctorId,
        id: query.excludeAppointmentId ? { not: query.excludeAppointmentId } : undefined,
        status: { notIn: INACTIVE_STATUSES as AppointmentStatus[] },
        startsAt: { lt: query.endsAt },
        endsAt: { gt: query.startsAt },
      },
    });
  }

  async update(
    id: string,
    clinicId: string,
    data: Prisma.AppointmentUncheckedUpdateInput,
  ): Promise<Appointment | null> {
    try {
      const result = await this.prisma.appointment.updateMany({ where: { id, clinicId }, data });
      if (result.count === 0) {
        return null;
      }
      return await this.prisma.appointment.findUniqueOrThrow({ where: { id } });
    } catch (error) {
      throw this.translateError(error);
    }
  }

  list(query: ListQuery): Promise<Appointment[]> {
    return this.prisma.appointment.findMany({
      where: {
        clinicId: query.clinicId,
        doctorId: query.doctorId,
        status: query.status,
        startsAt: query.from ? { gte: query.from } : undefined,
        endsAt: query.to ? { lte: query.to } : undefined,
        OR: query.q
          ? [
              { reason: { contains: query.q, mode: 'insensitive' } },
              { patient: { name: { contains: query.q, mode: 'insensitive' } } },
            ]
          : undefined,
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  private translateError(error: unknown): unknown {
    if (!(error instanceof Prisma.PrismaClientUnknownRequestError)) {
      return error;
    }

    const isExclusionViolation = error.message.includes(EXCLUSION_CONSTRAINT_NAME);
    const isDeadlockDuringConflict = error.message.includes(DEADLOCK_MESSAGE);

    if (isExclusionViolation || isDeadlockDuringConflict) {
      return new OverlappingAppointmentError('This time slot conflicts with an existing appointment');
    }

    return error;
  }
}
