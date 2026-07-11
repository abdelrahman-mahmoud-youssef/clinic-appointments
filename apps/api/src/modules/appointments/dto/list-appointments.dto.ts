import { AppointmentStatus } from '@clinic/shared';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ListAppointmentsDto {
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}
