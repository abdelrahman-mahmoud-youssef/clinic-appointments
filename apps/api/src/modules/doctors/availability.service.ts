import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { isWithinWorkingHours, WorkingHoursWindow } from '@clinic/shared';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../shared/redis/redis.module';
import { CrossTenantAccessError } from '../../shared/errors/domain-errors';
import { ClinicsService } from '../clinics/clinics.service';
import { AvailabilityRepository } from './availability.repository';

const CACHE_TTL_SECONDS = 300;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private readonly availabilityRepository: AvailabilityRepository,
    private readonly clinicsService: ClinicsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async isDoctorAvailable(clinicId: string, doctorId: string, startsAt: Date, endsAt: Date): Promise<boolean> {
    const [windows, timezone] = await Promise.all([
      this.getWorkingHours(clinicId, doctorId),
      this.clinicsService.getTimezone(clinicId),
    ]);
    return isWithinWorkingHours(windows, startsAt, endsAt, timezone);
  }

  async invalidateCache(clinicId: string, doctorId: string): Promise<void> {
    await this.safeRedisCall(() => this.redis.del(this.cacheKey(clinicId, doctorId)));
  }

  async setWorkingHours(
    clinicId: string,
    doctorId: string,
    windows: WorkingHoursWindow[],
  ): Promise<WorkingHoursWindow[]> {
    if (!(await this.availabilityRepository.doctorInClinic(doctorId, clinicId))) {
      throw new CrossTenantAccessError(`Doctor ${doctorId} not found in this clinic`);
    }

    const clinic = await this.clinicsService.getSettings(clinicId);
    const openMinute = clinic.dayStartHour * 60;
    const closeMinute = clinic.dayEndHour * 60;
    const seenWeekdays = new Set<number>();

    for (const window of windows) {
      const day = DAY_NAMES[window.weekday];
      const start = toMinutes(window.startTime);
      const end = toMinutes(window.endTime);

      if (seenWeekdays.has(window.weekday)) {
        throw new BadRequestException(`${day}: only one shift per day is allowed`);
      }
      seenWeekdays.add(window.weekday);

      if (end <= start) {
        throw new BadRequestException(`${day}: closing time must be after opening time`);
      }
      if (start < openMinute || end > closeMinute) {
        throw new BadRequestException(
          `${day}: hours must be within the clinic window (${formatMinutes(openMinute)}–${formatMinutes(closeMinute)})`,
        );
      }
    }

    await this.availabilityRepository.replaceForDoctor(clinicId, doctorId, windows);
    await this.invalidateCache(clinicId, doctorId);

    return this.getWorkingHours(clinicId, doctorId);
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
