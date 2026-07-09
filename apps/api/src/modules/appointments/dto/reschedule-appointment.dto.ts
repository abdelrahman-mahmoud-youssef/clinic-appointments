import { Type } from 'class-transformer';
import { IsDate } from 'class-validator';
import { IsAfter, IsNotInPast } from './validators/time-range.validators';

export class RescheduleAppointmentDto {
  @IsDate()
  @Type(() => Date)
  @IsNotInPast()
  startsAt!: Date;

  @IsDate()
  @Type(() => Date)
  @IsAfter('startsAt')
  endsAt!: Date;
}
