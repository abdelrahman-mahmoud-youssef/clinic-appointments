import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, Matches, Max, Min, ValidateNested } from 'class-validator';

const TIME_OF_DAY = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

export class WeeklyWindowDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @Matches(TIME_OF_DAY, { message: 'startTime must be HH:mm' })
  startTime!: string;

  @Matches(TIME_OF_DAY, { message: 'endTime must be HH:mm' })
  endTime!: string;
}

export class SetAvailabilityDto {
  @IsArray()
  @ArrayMaxSize(21)
  @ValidateNested({ each: true })
  @Type(() => WeeklyWindowDto)
  windows!: WeeklyWindowDto[];
}
