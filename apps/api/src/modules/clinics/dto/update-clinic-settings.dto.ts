import { Transform } from 'class-transformer';
import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

function IsGreaterThan(property: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isGreaterThan',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const related = (args.object as Record<string, unknown>)[args.constraints[0]];
          return typeof value === 'number' && typeof related === 'number' && value > related;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be greater than ${args.constraints[0]}`;
        },
      },
    });
  };
}

export class UpdateClinicSettingsDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(23)
  dayStartHour!: number;

  @IsInt()
  @Min(1)
  @Max(24)
  @IsGreaterThan('dayStartHour')
  dayEndHour!: number;
}
