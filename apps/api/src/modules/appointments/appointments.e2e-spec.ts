import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { Role } from '@clinic/shared';
import { AppModule } from '../../app.module';
import { DomainExceptionFilter } from '../../shared/filters/domain-exception.filter';

// Runs against the real docker-compose Postgres + Redis (see jest.e2e.config.js /
// package.json's test:e2e script). Unlike appointments.integration.spec.ts (which
// calls AppointmentsService directly), this boots the real Nest app and drives it
// over HTTP — the one layer nothing else exercises: JwtAuthGuard, RolesGuard, the
// global ValidationPipe, and DomainExceptionFilter all wired together. Business
// logic (overlap, concurrency, tenancy) already has dedicated coverage at the
// service/integration tiers; these four cases only prove the HTTP plumbing.
describe('Appointments e2e (real HTTP layer)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let token: string;

  const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

  let clinicA: { id: string };
  let clinicB: { id: string };
  let doctorA: { id: string };
  let doctorB: { id: string };
  let patientA: { id: string };
  let userA: { id: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    prisma = new PrismaClient();
    await prisma.$connect();

    clinicA = await prisma.clinic.create({ data: { name: 'E2E Test Clinic A', timezone: 'UTC' } });
    clinicB = await prisma.clinic.create({ data: { name: 'E2E Test Clinic B', timezone: 'UTC' } });
    doctorA = await prisma.doctor.create({ data: { clinicId: clinicA.id, name: 'E2E Doctor A' } });
    doctorB = await prisma.doctor.create({ data: { clinicId: clinicB.id, name: 'E2E Doctor B' } });
    patientA = await prisma.patient.create({ data: { clinicId: clinicA.id, name: 'E2E Patient A' } });
    userA = await prisma.user.create({
      data: {
        clinicId: clinicA.id,
        email: 'e2e-receptionist@test.local',
        hashedPassword: 'not-used-token-is-signed-directly',
        role: Role.RECEPTIONIST,
      },
    });

    // Unrestricted week so availability never incidentally blocks a fixture
    // appointment — same reasoning as appointments.integration.spec.ts.
    await prisma.doctorAvailability.createMany({
      data: ALL_WEEKDAYS.map((weekday) => ({
        clinicId: clinicA.id,
        doctorId: doctorA.id,
        weekday,
        startTime: '00:00',
        endTime: '23:59',
      })),
    });

    // Signed directly rather than via POST /auth/login: login/bcrypt correctness
    // already has its own coverage, and JwtStrategy re-fetches the user by `sub`
    // regardless of how the token was produced, so this still exercises the real
    // guard/strategy chain.
    token = moduleRef.get(JwtService).sign({ sub: userA.id, clinicId: clinicA.id, role: Role.RECEPTIONIST });
  });

  afterEach(async () => {
    await prisma.appointment.deleteMany({ where: { clinicId: { in: [clinicA.id, clinicB.id] } } });
  });

  afterAll(async () => {
    await prisma.doctorAvailability.deleteMany({ where: { clinicId: clinicA.id } });
    await prisma.user.deleteMany({ where: { clinicId: clinicA.id } });
    await prisma.doctor.deleteMany({ where: { clinicId: { in: [clinicA.id, clinicB.id] } } });
    await prisma.patient.deleteMany({ where: { clinicId: clinicA.id } });
    await prisma.clinic.deleteMany({ where: { id: { in: [clinicA.id, clinicB.id] } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('rejects an unauthenticated request with 401', async () => {
    await request(app.getHttpServer())
      .post('/appointments')
      .send({
        doctorId: doctorA.id,
        patientId: patientA.id,
        startsAt: '2031-01-01T09:00:00.000Z',
        endsAt: '2031-01-01T09:30:00.000Z',
      })
      .expect(401);
  });

  it('rejects a body missing a required field with 400', async () => {
    await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: patientA.id,
        startsAt: '2031-01-01T09:00:00.000Z',
        endsAt: '2031-01-01T09:30:00.000Z',
      })
      .expect(400);
  });

  it('maps an overlapping appointment to 409 over a real request', async () => {
    await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        doctorId: doctorA.id,
        patientId: patientA.id,
        startsAt: '2031-02-01T09:00:00.000Z',
        endsAt: '2031-02-01T09:30:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        doctorId: doctorA.id,
        patientId: patientA.id,
        startsAt: '2031-02-01T09:15:00.000Z',
        endsAt: '2031-02-01T09:45:00.000Z',
      })
      .expect(409);
  });

  it('maps a cross-tenant doctorId to 403', async () => {
    await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        doctorId: doctorB.id,
        patientId: patientA.id,
        startsAt: '2031-03-01T09:00:00.000Z',
        endsAt: '2031-03-01T09:30:00.000Z',
      })
      .expect(403);
  });
});
