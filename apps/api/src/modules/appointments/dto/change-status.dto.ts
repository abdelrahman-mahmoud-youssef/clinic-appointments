import { AppointmentStatus } from '@clinic/shared';
import { IsEnum } from 'class-validator';

export class ChangeStatusDto {
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;
}
