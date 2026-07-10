import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../shared/redis/redis.module';
import { AvailabilityRepository } from './availability.repository';
import { isWithinWorkingHours, WorkingHoursWindow } from './domain/working-hours';

const CACHE_TTL_SECONDS = 300;

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private readonly availabilityRepository: AvailabilityRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async isDoctorAvailable(clinicId: string, doctorId: string, startsAt: Date, endsAt: Date): Promise<boolean> {
    const windows = await this.getWorkingHours(clinicId, doctorId);
    return isWithinWorkingHours(windows, startsAt, endsAt);
  }

  async invalidateCache(clinicId: string, doctorId: string): Promise<void> {
    await this.safeRedisCall(() => this.redis.del(this.cacheKey(clinicId, doctorId)));
  }

  async getWorkingHours(clinicId: string, doctorId: string): Promise<WorkingHoursWindow[]> {
    const cached = await this.safeRedisCall(() => this.redis.get(this.cacheKey(clinicId, doctorId)));
    if (cached) {
      const parsed = this.tryParse(cached);
      if (parsed) {
        return parsed;
      }
    }

    const rows = await this.availabilityRepository.findByDoctor(clinicId, doctorId);
    const windows: WorkingHoursWindow[] = rows.map((row) => ({
      weekday: row.weekday,
      startTime: row.startTime,
      endTime: row.endTime,
    }));

    await this.safeRedisCall(() =>
      this.redis.set(this.cacheKey(clinicId, doctorId), JSON.stringify(windows), 'EX', CACHE_TTL_SECONDS),
    );

    return windows;
  }

  private tryParse(cached: string): WorkingHoursWindow[] | undefined {
    try {
      return JSON.parse(cached) as WorkingHoursWindow[];
    } catch {
      return undefined;
    }
  }

  private cacheKey(clinicId: string, doctorId: string): string {
    return `availability:${clinicId}:${doctorId}`;
  }

  // Redis is an optimization layer, never a correctness mechanism (CLAUDE.md rule
  // 9). Any failure here — connection refused, timeout, whatever — must never fail
  // the request; it just falls through to Postgres, slower but still correct.
  private async safeRedisCall<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      this.logger.warn(`Redis call failed, falling back to Postgres: ${(error as Error).message}`);
      return undefined;
    }
  }
}
