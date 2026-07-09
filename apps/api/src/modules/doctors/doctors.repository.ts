import { Injectable } from '@nestjs/common';
import { Doctor } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class DoctorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByClinic(clinicId: string): Promise<Doctor[]> {
    return this.prisma.doctor.findMany({ where: { clinicId }, orderBy: { name: 'asc' } });
  }
}
