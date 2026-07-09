import { Injectable } from '@nestjs/common';
import { Patient } from '@prisma/client';
import { PatientsRepository } from './patients.repository';

@Injectable()
export class PatientsService {
  constructor(private readonly patientsRepository: PatientsRepository) {}

  list(clinicId: string): Promise<Patient[]> {
    return this.patientsRepository.findAllByClinic(clinicId);
  }
}
