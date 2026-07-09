import { Injectable } from '@nestjs/common';
import { DoctorAvailability } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class AvailabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByDoctor(clinicId: string, doctorId: string): Promise<DoctorAvailability[]> {
    return this.prisma.doctorAvailability.findMany({ where: { clinicId, doctorId } });
  }
}
