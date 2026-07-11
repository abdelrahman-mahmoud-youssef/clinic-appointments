import { PrismaClient } from '@prisma/client';
import { AppointmentStatus, Role } from '@clinic/shared';
import { AvailabilityRepository } from '../doctors/availability.repository';
import { AvailabilityService } from '../doctors/availability.service';
import { ClinicsRepository } from '../clinics/clinics.repository';
import { ClinicsService } from '../clinics/clinics.service';
import { AppointmentsRepository } from './appointments.repository';
import { AppointmentsService } from './appointments.service';
import {
  CrossTenantAccessError,
  DoctorUnavailableError,
  InvalidStatusTransitionError,
  OverlappingAppointmentError,
} from '../../shared/errors/domain-errors';


const alwaysFailingRedis = {
  get: () => Promise.reject(new Error('no redis in this test')),
  set: () => Promise.reject(new Error('no redis in this test')),
  del: () => Promise.reject(new Error('no redis in this test')),
} as any;

describe('Appointments integration (real Postgres)', () => {
  const prisma = new PrismaClient();
  const repository = new AppointmentsRepository(prisma as any);
  const clinicsService = new ClinicsService(new ClinicsRepository(prisma as any));
  const availabilityService = new AvailabilityService(
    new AvailabilityRepository(prisma as any),
    clinicsService,
    alwaysFailingRedis,
  );
  const service = new AppointmentsService(repository, availabilityService, clinicsService);

  const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

  let clinicA: { id: string };
  let clinicB: { id: string };
  let doctorA: { id: string };
  let doctorB: { id: string };
  let patientA: { id: string };
  let patientB: { id: string };

  beforeAll(async () => {
    await prisma.$connect();
    clinicA = await prisma.clinic.create({ data: { name: 'Integration Test Clinic A', timezone: 'UTC' } });
    clinicB = await prisma.clinic.create({ data: { name: 'Integration Test Clinic B', timezone: 'UTC' } });
    doctorA = await prisma.doctor.create({ data: { clinicId: clinicA.id, name: 'Test Doctor A' } });
    doctorB = await prisma.doctor.create({ data: { clinicId: clinicA.id, name: 'Test Doctor B' } });
    patientA = await prisma.patient.create({ data: { clinicId: clinicA.id, name: 'Test Patient A' } });
    patientB = await prisma.patient.create({ data: { clinicId: clinicA.id, name: 'Test Patient B' } });

    // These tests exercise overlap/concurrency/tenancy, not working-hours logic
    // (which has its own dedicated tests) — give the doctors an unrestricted week
    // so availability never incidentally blocks a fixture appointment.
    await prisma.doctorAvailability.createMany({
      data: [doctorA.id, doctorB.id].flatMap((doctorId) =>
        ALL_WEEKDAYS.map((weekday) => ({
          clinicId: clinicA.id,
          doctorId,
          weekday,
          startTime: '00:00',
          endTime: '23:59',
        })),
      ),
    });
  });

  afterEach(async () => {
    await prisma.appointment.deleteMany({ where: { clinicId: { in: [clinicA.id, clinicB.id] } } });
  });

  afterAll(async () => {
    await prisma.doctorAvailability.deleteMany({ where: { clinicId: clinicA.id } });
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

  it('edits doctor, patient, time, reason, and notes and persists them', async () => {
    const appointment = await service.create({
      clinicId: clinicA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      startsAt: new Date('2030-06-01T09:00:00Z'),
      endsAt: new Date('2030-06-01T09:30:00Z'),
      actorUserId: 'tester',
    });

    const updated = await service.update({
      id: appointment.id,
      clinicId: clinicA.id,
      doctorId: doctorB.id,
      patientId: patientB.id,
      startsAt: new Date('2030-06-01T14:00:00Z'),
      endsAt: new Date('2030-06-01T15:00:00Z'),
      reason: 'Rescheduled review',
      notes: 'Moved to the afternoon',
      actorUserId: 'tester',
    });

    expect(updated.doctorId).toBe(doctorB.id);
    expect(updated.patientId).toBe(patientB.id);
    expect(updated.reason).toBe('Rescheduled review');

    const persisted = await service.findOne(appointment.id, clinicA.id);
    expect(persisted.doctorId).toBe(doctorB.id);
    expect(persisted.patientId).toBe(patientB.id);
    expect(persisted.notes).toBe('Moved to the afternoon');
    expect(persisted.startsAt.toISOString()).toBe(new Date('2030-06-01T14:00:00Z').toISOString());
  });

  it('rejects an edit that overlaps another appointment for the same doctor', async () => {
    await service.create({
      clinicId: clinicA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      startsAt: new Date('2030-07-01T09:00:00Z'),
      endsAt: new Date('2030-07-01T09:30:00Z'),
      actorUserId: 'tester',
    });
    const second = await service.create({
      clinicId: clinicA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      startsAt: new Date('2030-07-01T11:00:00Z'),
      endsAt: new Date('2030-07-01T11:30:00Z'),
      actorUserId: 'tester',
    });

    await expect(
      service.update({
        id: second.id,
        clinicId: clinicA.id,
        doctorId: doctorA.id,
        patientId: patientA.id,
        startsAt: new Date('2030-07-01T09:15:00Z'),
        endsAt: new Date('2030-07-01T09:45:00Z'),
        actorUserId: 'tester',
      }),
    ).rejects.toThrow(OverlappingAppointmentError);
  });

  it('searches appointments by patient name, case-insensitively and clinic-scoped', async () => {
    await service.create({
      clinicId: clinicA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      startsAt: new Date('2030-09-01T09:00:00Z'),
      endsAt: new Date('2030-09-01T09:30:00Z'),
      actorUserId: 'tester',
    });
    await service.create({
      clinicId: clinicA.id,
      doctorId: doctorB.id,
      patientId: patientB.id,
      startsAt: new Date('2030-09-01T09:00:00Z'),
      endsAt: new Date('2030-09-01T09:30:00Z'),
      actorUserId: 'tester',
    });

    const results = await service.list({ clinicId: clinicA.id, actorRole: Role.ADMIN, q: 'patient a' });

    expect(results).toHaveLength(1);
    expect(results[0].patientId).toBe(patientA.id);
  });

  it('searches appointments by reason, case-insensitively', async () => {
    await service.create({
      clinicId: clinicA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      startsAt: new Date('2030-10-01T09:00:00Z'),
      endsAt: new Date('2030-10-01T09:30:00Z'),
      reason: 'Root canal',
      actorUserId: 'tester',
    });
    await service.create({
      clinicId: clinicA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      startsAt: new Date('2030-10-01T11:00:00Z'),
      endsAt: new Date('2030-10-01T11:30:00Z'),
      reason: 'Annual physical',
      actorUserId: 'tester',
    });

    const results = await service.list({ clinicId: clinicA.id, actorRole: Role.ADMIN, q: 'ROOT' });

    expect(results).toHaveLength(1);
    expect(results[0].reason).toBe('Root canal');
  });

  it('honours a split shift: books both blocks, rejects the lunch gap', async () => {
    const splitDoctor = await prisma.doctor.create({
      data: { clinicId: clinicA.id, name: 'Split Shift Doctor' },
    });
    const weekday = new Date('2030-11-04T00:00:00Z').getUTCDay();
    await prisma.doctorAvailability.createMany({
      data: [
        { clinicId: clinicA.id, doctorId: splitDoctor.id, weekday, startTime: '09:00', endTime: '12:00' },
        { clinicId: clinicA.id, doctorId: splitDoctor.id, weekday, startTime: '13:00', endTime: '17:00' },
      ],
    });

    const book = (startsAt: string, endsAt: string) =>
      service.create({
        clinicId: clinicA.id,
        doctorId: splitDoctor.id,
        patientId: patientA.id,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        actorUserId: 'tester',
      });

    const morning = await book('2030-11-04T09:30:00Z', '2030-11-04T10:00:00Z');
    const afternoon = await book('2030-11-04T13:30:00Z', '2030-11-04T14:00:00Z');
    expect(morning.id).toBeDefined();
    expect(afternoon.id).toBeDefined();

    await expect(book('2030-11-04T12:15:00Z', '2030-11-04T12:45:00Z')).rejects.toThrow(
      DoctorUnavailableError,
    );
  });

  it('paginates the list with a stable cursor', async () => {
    const pager = await prisma.doctor.create({ data: { clinicId: clinicA.id, name: 'Pager Doctor' } });
    await prisma.doctorAvailability.createMany({
      data: ALL_WEEKDAYS.map((weekday) => ({
        clinicId: clinicA.id,
        doctorId: pager.id,
        weekday,
        startTime: '00:00',
        endTime: '23:59',
      })),
    });
    const base = '2030-12-01T';
    for (const hour of ['09', '10', '11']) {
      await service.create({
        clinicId: clinicA.id,
        doctorId: pager.id,
        patientId: patientA.id,
        startsAt: new Date(`${base}${hour}:00:00Z`),
        endsAt: new Date(`${base}${hour}:30:00Z`),
        actorUserId: 'tester',
      });
    }

    const page1 = await service.list({
      clinicId: clinicA.id,
      actorRole: Role.ADMIN,
      doctorId: pager.id,
      limit: 2,
    });
    const page2 = await service.list({
      clinicId: clinicA.id,
      actorRole: Role.ADMIN,
      doctorId: pager.id,
      limit: 2,
      cursor: page1[1].id,
    });

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(1);
    expect(new Set([...page1, ...page2].map((a) => a.id)).size).toBe(3);
    expect([...page1, ...page2].map((a) => a.startsAt.toISOString())).toEqual([
      `${base}09:00:00.000Z`,
      `${base}10:00:00.000Z`,
      `${base}11:00:00.000Z`,
    ]);
  });

  it('rejects editing a terminal appointment', async () => {
    const appointment = await service.create({
      clinicId: clinicA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      startsAt: new Date('2030-08-01T09:00:00Z'),
      endsAt: new Date('2030-08-01T09:30:00Z'),
      actorUserId: 'tester',
    });
    await service.changeStatus({
      id: appointment.id,
      clinicId: clinicA.id,
      status: AppointmentStatus.CANCELLED,
      actorUserId: 'tester',
      actorRole: Role.ADMIN,
    });

    await expect(
      service.update({
        id: appointment.id,
        clinicId: clinicA.id,
        doctorId: doctorA.id,
        patientId: patientA.id,
        startsAt: new Date('2030-08-01T10:00:00Z'),
        endsAt: new Date('2030-08-01T10:30:00Z'),
        actorUserId: 'tester',
      }),
    ).rejects.toThrow(InvalidStatusTransitionError);
  });
});
