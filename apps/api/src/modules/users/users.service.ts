import { ConflictException, Injectable } from '@nestjs/common';
import { Role } from '@clinic/shared';
import * as bcrypt from 'bcrypt';
import { CrossTenantAccessError } from '../../shared/errors/domain-errors';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  list(clinicId: string) {
    return this.usersRepository.findAllByClinic(clinicId);
  }

  async create(clinicId: string, dto: CreateUserDto) {
    if (await this.usersRepository.emailExists(dto.email)) {
      throw new ConflictException('A user with this email already exists');
    }

    const doctorId = dto.role === Role.DOCTOR ? dto.doctorId : undefined;
    if (doctorId && !(await this.usersRepository.doctorInClinic(doctorId, clinicId))) {
      throw new CrossTenantAccessError(`Doctor ${doctorId} not found in this clinic`);
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
