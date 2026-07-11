import { Role } from '@clinic/shared';
import { IsEmail, IsEnum, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @ValidateIf((dto) => dto.role === Role.DOCTOR)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  doctorName?: string;
}
