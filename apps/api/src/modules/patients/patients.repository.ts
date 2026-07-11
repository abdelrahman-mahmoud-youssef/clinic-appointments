import { Injectable } from '@nestjs/common';
import { Patient } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class PatientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByClinic(clinicId: string): Promise<Patient[]> {
    return this.prisma.patient.findMany({ where: { clinicId }, orderBy: { name: 'asc' } });
  }

  create(clinicId: string, name: string): Promise<Patient> {
    return this.prisma.patient.create({ data: { clinicId, name } });
  }
}
