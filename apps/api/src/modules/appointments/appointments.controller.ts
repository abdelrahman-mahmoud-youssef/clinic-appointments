import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@clinic/shared';
import { ClinicId } from '../../shared/decorators/clinic-id.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { AuthenticatedUser } from '../../shared/types/authenticated-user.type';
import { AppointmentsService } from './appointments.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsDto } from './dto/list-appointments.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  @Post()
  create(
    @Body() dto: CreateAppointmentDto,
    @ClinicId() clinicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.create({
      clinicId,
      patientId: dto.patientId,
      doctorId: dto.doctorId,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      reason: dto.reason,
      notes: dto.notes,
      actorUserId: user.id,
    });
  }

  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  @Patch(':id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
    @ClinicId() clinicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.reschedule({
      id,
      clinicId,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      actorUserId: user.id,
    });
  }

  @Roles(Role.DOCTOR, Role.ADMIN)
  @Patch(':id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @ClinicId() clinicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.changeStatus({
      id,
      clinicId,
      status: dto.status,
      actorUserId: user.id,
      actorRole: user.role,
      actorDoctorId: user.doctorId,
    });
  }

  @Get()
  list(@Query() query: ListAppointmentsDto, @ClinicId() clinicId: string) {
    return this.appointmentsService.list({
      clinicId,
      doctorId: query.doctorId,
      from: query.from,
      to: query.to,
      status: query.status,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @ClinicId() clinicId: string) {
    return this.appointmentsService.findOne(id, clinicId);
  }
}
