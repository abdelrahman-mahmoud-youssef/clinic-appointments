import { Role } from '@clinic/shared';
import { IsEmail, IsEnum, IsOptional, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsUUID()
  doctorId?: string;
}
