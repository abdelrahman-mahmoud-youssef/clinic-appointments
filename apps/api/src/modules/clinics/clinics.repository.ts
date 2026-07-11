import { Injectable } from '@nestjs/common';
import { Clinic } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ClinicsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(clinicId: string): Promise<Clinic | null> {
    return this.prisma.clinic.findUnique({ where: { id: clinicId } });
  }

  updateSettings(
    clinicId: string,
    data: { name: string; dayStartHour: number; dayEndHour: number },
  ): Promise<Clinic> {
    return this.prisma.clinic.update({ where: { id: clinicId }, data });
  }
}
