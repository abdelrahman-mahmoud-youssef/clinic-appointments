import { Controller, Get } from '@nestjs/common';
import { Public } from './modules/auth/decorators/public.decorator';
import { PrismaService } from './shared/prisma/prisma.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
