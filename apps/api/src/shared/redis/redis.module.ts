import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisClient');
        const client = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: 1,
          retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
        });
        // Redis is an optimization layer (CLAUDE.md rule 9). Without this handler
        // an unreachable Redis would emit an unhandled 'error' event and crash the
        // process — every caller already wraps its own commands and falls back to
        // Postgres, so this just prevents that crash and keeps retrying quietly.
        client.on('error', (error) => logger.warn(`Redis connection error: ${error.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
