import { AppointmentStatus, Role } from '@clinic/shared';
import {
  CrossTenantAccessError,
  InvalidStatusTransitionError,
  OverlappingAppointmentError,
} from '../../shared/errors/domain-errors';
import { AppointmentsService } from './appointments.service';

function buildAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appt-1',
    clinicId: 'clinic-1',
    doctorId: 'doctor-1',
    patientId: 'patient-1',
    startsAt: new Date('2027-01-01T10:00:00Z'),
    endsAt: new Date('2027-01-01T10:30:00Z'),
    status: AppointmentStatus.SCHEDULED,
    reason: null,
    notes: null,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createRepositoryMock() {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findOverlapping: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
    doctorBelongsToClinic: jest.fn(),
    patientBelongsToClinic: jest.fn(),
  };
}

function createAvailabilityMock() {
  return { isDoctorAvailable: jest.fn() };
}

function createClinicsMock() {
  return { getTimezone: jest.fn().mockResolvedValue('UTC') };
}

describe('AppointmentsService', () => {
  let repo: ReturnType<typeof createRepositoryMock>;
  let availability: ReturnType<typeof createAvailabilityMock>;
  let clinics: ReturnType<typeof createClinicsMock>;
  let service: AppointmentsService;

  beforeEach(() => {
    repo = createRepositoryMock();
    availability = createAvailabilityMock();
    clinics = createClinicsMock();
    service = new AppointmentsService(repo as any, availability as any, clinics as any);
    repo.doctorBelongsToClinic.mockResolvedValue(true);
    repo.patientBelongsToClinic.mockResolvedValue(true);
    availability.isDoctorAvailable.mockResolvedValue(true);
  });

  describe('create', () => {
    it('throws OverlappingAppointmentError when the repository reports a conflict', async () => {
      repo.findOverlapping.mockResolvedValue([buildAppointment()]);

      await expect(
        service.create({
          clinicId: 'clinic-1',
          patientId: 'patient-1',
          doctorId: 'doctor-1',
          startsAt: new Date('2027-01-01T10:15:00Z'),
          endsAt: new Date('2027-01-01T10:45:00Z'),
          actorUserId: 'user-1',
        }),
      ).rejects.toThrow(OverlappingAppointmentError);

      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('reschedule', () => {
    it("excludes the appointment's own id from the overlap check", async () => {
      const appointment = buildAppointment();
      repo.findById.mockResolvedValue(appointment);
      repo.findOverlapping.mockResolvedValue([]);
      repo.update.mockResolvedValue({
        ...appointment,
        startsAt: new Date('2027-01-01T11:00:00Z'),
        endsAt: new Date('2027-01-01T11:30:00Z'),
      });

      await service.reschedule({
        id: appointment.id,
        clinicId: appointment.clinicId as string,
        startsAt: new Date('2027-01-01T11:00:00Z'),
        endsAt: new Date('2027-01-01T11:30:00Z'),
        actorUserId: 'user-1',
      });

      expect(repo.findOverlapping).toHaveBeenCalledWith(
        expect.objectContaining({ excludeAppointmentId: appointment.id }),
      );
    });

    it('rejects rescheduling a terminal-status appointment', async () => {
      repo.findById.mockResolvedValue(buildAppointment({ status: AppointmentStatus.CANCELLED }));

      await expect(
        service.reschedule({
          id: 'appt-1',
          clinicId: 'clinic-1',
          startsAt: new Date('2027-01-01T11:00:00Z'),
          endsAt: new Date('2027-01-01T11:30:00Z'),
          actorUserId: 'user-1',
        }),
      ).rejects.toThrow(InvalidStatusTransitionError);

      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('changeStatus', () => {
    it('rejects an illegal transition and never calls update', async () => {
      repo.findById.mockResolvedValue(buildAppointment({ status: AppointmentStatus.SCHEDULED }));

      await expect(
        service.changeStatus({
          id: 'appt-1',
          clinicId: 'clinic-1',
          status: AppointmentStatus.COMPLETED,
          actorUserId: 'user-1',
          actorRole: Role.ADMIN,
        }),
      ).rejects.toThrow(InvalidStatusTransitionError);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('allows a legal transition and persists it', async () => {
      const appointment = buildAppointment({ status: AppointmentStatus.SCHEDULED });
      repo.findById.mockResolvedValue(appointment);
      repo.update.mockResolvedValue({ ...appointment, status: AppointmentStatus.CONFIRMED });

      const result = await service.changeStatus({
        id: 'appt-1',
        clinicId: 'clinic-1',
        status: AppointmentStatus.CONFIRMED,
        actorUserId: 'user-1',
        actorRole: Role.ADMIN,
      });

      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
    });

    it('rejects a DOCTOR changing status on an appointment that is not theirs', async () => {
      repo.findById.mockResolvedValue(buildAppointment({ doctorId: 'doctor-1' }));

      await expect(
        service.changeStatus({
          id: 'appt-1',
          clinicId: 'clinic-1',
          status: AppointmentStatus.CONFIRMED,
          actorUserId: 'user-2',
          actorRole: Role.DOCTOR,
          actorDoctorId: 'doctor-2',
        }),
      ).rejects.toThrow(CrossTenantAccessError);

      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('list scoping', () => {
    it('forces a DOCTOR to their own appointments, ignoring the requested doctorId', async () => {
      repo.list.mockResolvedValue([]);

      await service.list({
        clinicId: 'clinic-1',
        actorRole: Role.DOCTOR,
        actorDoctorId: 'doctor-1',
        doctorId: 'doctor-2',
      });

      expect(repo.list).toHaveBeenCalledWith(
        expect.objectContaining({ clinicId: 'clinic-1', doctorId: 'doctor-1' }),
      );
    });

    it('returns nothing and never queries when a DOCTOR has no linked doctorId', async () => {
      const result = await service.list({ clinicId: 'clinic-1', actorRole: Role.DOCTOR });

      expect(result).toEqual([]);
      expect(repo.list).not.toHaveBeenCalled();
    });

    it('lets an ADMIN filter by any doctorId', async () => {
      repo.list.mockResolvedValue([]);

      await service.list({ clinicId: 'clinic-1', actorRole: Role.ADMIN, doctorId: 'doctor-2' });

      expect(repo.list).toHaveBeenCalledWith(
        expect.objectContaining({ clinicId: 'clinic-1', doctorId: 'doctor-2' }),
      );
    });
  });

  describe('summarize', () => {
    it('counts by status and excludes terminal states from the active total', async () => {
      repo.list.mockResolvedValue([
        buildAppointment({ status: AppointmentStatus.SCHEDULED }),
        buildAppointment({ status: AppointmentStatus.CONFIRMED }),
        buildAppointment({ status: AppointmentStatus.CANCELLED }),
        buildAppointment({ status: AppointmentStatus.NO_SHOW }),
      ]);

      const summary = await service.summarize({ clinicId: 'clinic-1', actorRole: Role.ADMIN });

      expect(summary.active).toBe(2);
      expect(summary.counts[AppointmentStatus.SCHEDULED]).toBe(1);
      expect(summary.counts[AppointmentStatus.CANCELLED]).toBe(1);
      expect(summary.counts[AppointmentStatus.COMPLETED]).toBe(0);
    });

    it('buckets active appointments per day across the window', async () => {
      repo.list.mockResolvedValue([
        buildAppointment({ startsAt: new Date('2027-01-04T10:00:00Z'), status: AppointmentStatus.SCHEDULED }),
        buildAppointment({ startsAt: new Date('2027-01-04T14:00:00Z'), status: AppointmentStatus.CONFIRMED }),
        buildAppointment({ startsAt: new Date('2027-01-05T09:00:00Z'), status: AppointmentStatus.CANCELLED }),
      ]);

      const summary = await service.summarize({
        clinicId: 'clinic-1',
        actorRole: Role.ADMIN,
        from: new Date('2027-01-04T00:00:00Z'),
        to: new Date('2027-01-05T23:59:59Z'),
      });

      expect(summary.byDay).toEqual([
        { date: '2027-01-04', active: 2 },
        { date: '2027-01-05', active: 0 },
      ]);
    });
  });

  describe('cross-clinic access', () => {
    it('throws CrossTenantAccessError when the repository finds nothing in this clinic', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findOne('appt-1', 'clinic-1')).rejects.toThrow(CrossTenantAccessError);
    });
  });
});
