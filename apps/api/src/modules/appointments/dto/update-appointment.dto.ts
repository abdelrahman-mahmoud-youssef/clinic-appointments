import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';
import { IsAfter } from './validators/time-range.validators';

export class UpdateAppointmentDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  doctorId!: string;

  @IsDate()
  @Type(() => Date)
  startsAt!: Date;

  @IsDate()
  @Type(() => Date)
  @IsAfter('startsAt')
  endsAt!: Date;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
