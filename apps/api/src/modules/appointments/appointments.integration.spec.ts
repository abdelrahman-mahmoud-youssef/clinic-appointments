import { PrismaClient } from '@prisma/client';
import { AppointmentStatus, Role } from '@clinic/shared';
import { AvailabilityService } from '../doctors/availability.service';
import { AppointmentsRepository } from './appointments.repository';
import { AppointmentsService } from './appointments.service';
import { CrossTenantAccessError, OverlappingAppointmentError } from '../../shared/errors/domain-errors';

// Runs against the real docker-compose Postgres (see jest.integration.config.js /
// package.json's test:integration script). Fixtures are dedicated throwaway
// clinics created in beforeAll and torn down in afterAll, so it's safe to
// re-run repeatedly and never touches the seeded dev data.
describe('Appointments integration (real Postgres)', () => {
  const prisma = new PrismaClient();
  const repository = new AppointmentsRepository(prisma as any);
  const service = new AppointmentsService(repository, new AvailabilityService());

  let clinicA: { id: string };
  let clinicB: { id: string };
  let doctorA: { id: string };
  let patientA: { id: string };

  beforeAll(async () => {
    await prisma.$connect();
    clinicA = await prisma.clinic.create({ data: { name: 'Integration Test Clinic A', timezone: 'UTC' } });
    clinicB = await prisma.clinic.create({ data: { name: 'Integration Test Clinic B', timezone: 'UTC' } });
    doctorA = await prisma.doctor.create({ data: { clinicId: clinicA.id, name: 'Test Doctor A' } });
    patientA = await prisma.patient.create({ data: { clinicId: clinicA.id, name: 'Test Patient A' } });
  });

  afterEach(async () => {
    await prisma.appointment.deleteMany({ where: { clinicId: { in: [clinicA.id, clinicB.id] } } });
  });

  afterAll(async () => {
    await prisma.doctor.deleteMany({ where: { clinicId: clinicA.id } });
    await prisma.patient.deleteMany({ where: { clinicId: clinicA.id } });
    await prisma.clinic.deleteMany({ where: { id: { in: [clinicA.id, clinicB.id] } } });
    await prisma.$disconnect();
  });

  it('resolves exactly one of two truly concurrent overlapping creates, the other rejected as OverlappingAppointmentError', async () => {
    const results = await Promise.allSettled([
      service.create({
        clinicId: clinicA.id,
        doctorId: doctorA.id,
        patientId: patientA.id,
        startsAt: new Date('2030-01-01T09:00:00Z'),
        endsAt: new Date('2030-01-01T09:30:00Z'),
        actorUserId: 'tester',
      }),
      service.create({
        clinicId: clinicA.id,
        doctorId: doctorA.id,
        patientId: patientA.id,
        startsAt: new Date('2030-01-01T09:10:00Z'),
        endsAt: new Date('2030-01-01T09:40:00Z'),
        actorUserId: 'tester',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(OverlappingAppointmentError);
  });

  it('translates the raw exclusion-constraint violation into OverlappingAppointmentError, not a raw 500', async () => {
    await prisma.appointment.create({
      data: {
        clinicId: clinicA.id,
        doctorId: doctorA.id,
        patientId: patientA.id,
        startsAt: new Date('2030-02-01T10:00:00Z'),
        endsAt: new Date('2030-02-01T10:30:00Z'),
        status: AppointmentStatus.SCHEDULED,
        createdBy: 'tester',
        updatedBy: 'tester',
      },
    });

    await expect(
      repository.create({
        clinicId: clinicA.id,
        doctorId: doctorA.id,
        patientId: patientA.id,
        startsAt: new Date('2030-02-01T10:15:00Z'),
        endsAt: new Date('2030-02-01T10:45:00Z'),
        createdBy: 'tester',
        updatedBy: 'tester',
      }),
    ).rejects.toThrow(OverlappingAppointmentError);
  });

  it('blocks cross-tenant read and reschedule, with no data leak', async () => {
    const appointment = await service.create({
      clinicId: clinicA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      startsAt: new Date('2030-03-01T09:00:00Z'),
      endsAt: new Date('2030-03-01T09:30:00Z'),
      actorUserId: 'tester',
    });

    await expect(service.findOne(appointment.id, clinicB.id)).rejects.toThrow(CrossTenantAccessError);
    await expect(
      service.reschedule({
        id: appointment.id,
        clinicId: clinicB.id,
        startsAt: new Date('2030-03-01T11:00:00Z'),
        endsAt: new Date('2030-03-01T11:30:00Z'),
        actorUserId: 'tester',
      }),
    ).rejects.toThrow(CrossTenantAccessError);

    const stillInA = await service.findOne(appointment.id, clinicA.id);
    expect(stillInA.startsAt.toISOString()).toBe(new Date('2030-03-01T09:00:00Z').toISOString());
  });

  it('persists two back-to-back appointments successfully', async () => {
    const first = await service.create({
      clinicId: clinicA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      startsAt: new Date('2030-04-01T10:00:00Z'),
      endsAt: new Date('2030-04-01T10:30:00Z'),
      actorUserId: 'tester',
    });
    const second = await service.create({
      clinicId: clinicA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      startsAt: new Date('2030-04-01T10:30:00Z'),
      endsAt: new Date('2030-04-01T11:00:00Z'),
      actorUserId: 'tester',
    });

    expect(first.id).not.toBe(second.id);
  });

  it('allows rebooking a cancelled slot end to end through the service', async () => {
    const appointment = await service.create({
      clinicId: clinicA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      startsAt: new Date('2030-05-01T09:00:00Z'),
      endsAt: new Date('2030-05-01T09:30:00Z'),
      actorUserId: 'tester',
    });

    await service.changeStatus({
      id: appointment.id,
      clinicId: clinicA.id,
      status: AppointmentStatus.CANCELLED,
      actorUserId: 'tester',
      actorRole: Role.ADMIN,
    });

    const rebooked = await service.create({
      clinicId: clinicA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      startsAt: new Date('2030-05-01T09:00:00Z'),
      endsAt: new Date('2030-05-01T09:30:00Z'),
      actorUserId: 'tester',
    });

    expect(rebooked.status).toBe(AppointmentStatus.SCHEDULED);
  });
});
