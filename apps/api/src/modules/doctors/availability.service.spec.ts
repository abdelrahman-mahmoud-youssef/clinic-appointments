import { AvailabilityService } from './availability.service';

function createRepositoryMock() {
  return { findByDoctor: jest.fn() };
}

function createRedisMock() {
  return { get: jest.fn(), set: jest.fn(), del: jest.fn() };
}

// 2027-01-04 is a Monday (UTC weekday 1).
const MONDAY_ROWS = [{ weekday: 1, startTime: '09:00', endTime: '17:00' }];
const insideWindow = { startsAt: new Date('2027-01-04T10:00:00Z'), endsAt: new Date('2027-01-04T10:30:00Z') };
const outsideWindow = { startsAt: new Date('2027-01-04T20:00:00Z'), endsAt: new Date('2027-01-04T20:30:00Z') };

describe('AvailabilityService', () => {
  let repo: ReturnType<typeof createRepositoryMock>;
  let redis: ReturnType<typeof createRedisMock>;
  let service: AvailabilityService;

  beforeEach(() => {
    repo = createRepositoryMock();
    redis = createRedisMock();
    service = new AvailabilityService(repo as any, redis as any);
  });

  describe('with Redis reachable', () => {
    it('serves a cache hit without querying the repository', async () => {
      redis.get.mockResolvedValue(JSON.stringify(MONDAY_ROWS));

      const result = await service.isDoctorAvailable('clinic-1', 'doctor-1', insideWindow.startsAt, insideWindow.endsAt);

      expect(result).toBe(true);
      expect(repo.findByDoctor).not.toHaveBeenCalled();
    });

    it('populates the cache on a miss and still returns the correct result', async () => {
      redis.get.mockResolvedValue(null);
      repo.findByDoctor.mockResolvedValue(MONDAY_ROWS);

      const result = await service.isDoctorAvailable('clinic-1', 'doctor-1', outsideWindow.startsAt, outsideWindow.endsAt);

      expect(result).toBe(false);
      expect(redis.set).toHaveBeenCalledWith(
        'availability:clinic-1:doctor-1',
        JSON.stringify(MONDAY_ROWS),
        'EX',
        expect.any(Number),
      );
    });
  });

  describe('with Redis unreachable', () => {
    it('falls back to Postgres and returns the same result as when Redis is up', async () => {
      redis.get.mockRejectedValue(new Error('connect ECONNREFUSED'));
      redis.set.mockRejectedValue(new Error('connect ECONNREFUSED'));
      repo.findByDoctor.mockResolvedValue(MONDAY_ROWS);

      const insideResult = await service.isDoctorAvailable(
        'clinic-1',
        'doctor-1',
        insideWindow.startsAt,
        insideWindow.endsAt,
      );
      const outsideResult = await service.isDoctorAvailable(
        'clinic-1',
        'doctor-1',
        outsideWindow.startsAt,
        outsideWindow.endsAt,
      );

      expect(insideResult).toBe(true);
      expect(outsideResult).toBe(false);
      expect(repo.findByDoctor).toHaveBeenCalledTimes(2);
    });

    it('does not throw when Redis del fails during cache invalidation', async () => {
      redis.del.mockRejectedValue(new Error('connect ECONNREFUSED'));

      await expect(service.invalidateCache('clinic-1', 'doctor-1')).resolves.toBeUndefined();
    });
  });

  describe('corrupt cache entry', () => {
    it('falls back to Postgres instead of throwing on invalid JSON', async () => {
      redis.get.mockResolvedValue('not valid json{{{');
      repo.findByDoctor.mockResolvedValue(MONDAY_ROWS);

      const result = await service.isDoctorAvailable('clinic-1', 'doctor-1', insideWindow.startsAt, insideWindow.endsAt);

      expect(result).toBe(true);
      expect(repo.findByDoctor).toHaveBeenCalled();
    });
  });

  describe('invalidateCache', () => {
    it('deletes the clinic+doctor-scoped key', async () => {
      await service.invalidateCache('clinic-1', 'doctor-1');

      expect(redis.del).toHaveBeenCalledWith('availability:clinic-1:doctor-1');
    });
  });
});
