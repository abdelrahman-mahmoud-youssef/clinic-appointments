import { Injectable } from '@nestjs/common';
import { Doctor } from '@prisma/client';
import { DoctorsRepository } from './doctors.repository';

@Injectable()
export class DoctorsService {
  constructor(private readonly doctorsRepository: DoctorsRepository) {}

  list(clinicId: string): Promise<Doctor[]> {
    return this.doctorsRepository.findAllByClinic(clinicId);
  }
}
