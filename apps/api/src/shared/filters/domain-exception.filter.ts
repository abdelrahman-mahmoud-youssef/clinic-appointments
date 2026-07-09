import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import {
  CrossTenantAccessError,
  DoctorUnavailableError,
  DomainError,
  InvalidStatusTransitionError,
  OverlappingAppointmentError,
} from '../errors/domain-errors';

const STATUS_BY_ERROR = new Map<Function, HttpStatus>([
  [OverlappingAppointmentError, HttpStatus.CONFLICT],
  [InvalidStatusTransitionError, HttpStatus.UNPROCESSABLE_ENTITY],
  [DoctorUnavailableError, HttpStatus.UNPROCESSABLE_ENTITY],
  [CrossTenantAccessError, HttpStatus.FORBIDDEN],
]);

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = STATUS_BY_ERROR.get(exception.constructor) ?? HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(statusCode).json({
      statusCode,
      error: exception.name,
      message: exception.message,
    });
  }
}
