import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  role: true,
  doctorId: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByClinic(clinicId: string) {
    return this.prisma.user.findMany({
      where: { clinicId },
      select: PUBLIC_FIELDS,
      orderBy: { email: 'asc' },
    });
  }

  emailExists(email: string): Promise<boolean> {
    return this.prisma.user.count({ where: { email } }).then((count) => count > 0);
  }

  doctorInClinic(doctorId: string, clinicId: string): Promise<boolean> {
    return this.prisma.doctor.count({ where: { id: doctorId, clinicId } }).then((count) => count > 0);
  }

  create(data: Prisma.UserUncheckedCreateInput) {
    return this.prisma.user.create({ data, select: PUBLIC_FIELDS });
  }
}
