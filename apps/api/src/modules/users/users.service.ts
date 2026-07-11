import { ConflictException, Injectable } from '@nestjs/common';
import { Role } from '@clinic/shared';
import * as bcrypt from 'bcrypt';
import { DoctorsService } from '../doctors/doctors.service';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly doctorsService: DoctorsService,
  ) {}

  list(clinicId: string) {
    return this.usersRepository.findAllByClinic(clinicId);
  }

  async create(clinicId: string, dto: CreateUserDto) {
    if (await this.usersRepository.emailExists(dto.email)) {
      throw new ConflictException('A user with this email already exists');
    }

    let doctorId: string | undefined;
    if (dto.role === Role.DOCTOR && dto.doctorName) {
      const doctor = await this.doctorsService.create(clinicId, dto.doctorName.trim());
      doctorId = doctor.id;
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.usersRepository.create({
      clinicId,
      email: dto.email,
      hashedPassword,
      role: dto.role,
      doctorId,
    });
  }
}
