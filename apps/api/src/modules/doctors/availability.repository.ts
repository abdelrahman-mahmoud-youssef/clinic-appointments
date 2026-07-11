import { Injectable } from '@nestjs/common';
import { DoctorAvailability } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class AvailabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByDoctor(clinicId: string, doctorId: string): Promise<DoctorAvailability[]> {
    return this.prisma.doctorAvailability.findMany({ where: { clinicId, doctorId } });
  }

  doctorInClinic(doctorId: string, clinicId: string): Promise<boolean> {
    return this.prisma.doctor.count({ where: { id: doctorId, clinicId } }).then((count) => count > 0);
  }

  async replaceForDoctor(
    clinicId: string,
    doctorId: string,
    windows: { weekday: number; startTime: string; endTime: string }[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.doctorAvailability.deleteMany({ where: { clinicId, doctorId } }),
      this.prisma.doctorAvailability.createMany({
        data: windows.map((window) => ({
          clinicId,
          doctorId,
          weekday: window.weekday,
          startTime: window.startTime,
          endTime: window.endTime,
        })),
      }),
    ]);
  }
}
