import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../shared/redis/redis.module';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const email = request.body?.email;
    if (typeof email !== 'string' || !email) {
      return true;
    }

    const key = `login-throttle:${email.trim().toLowerCase()}`;

    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.pexpire(key, WINDOW_MS);
      }
      if (count > MAX_ATTEMPTS) {
        throw new HttpException('Too many login attempts. Try again in a minute.', HttpStatus.TOO_MANY_REQUESTS);
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      return true;
    }

    return true;
  }
}
