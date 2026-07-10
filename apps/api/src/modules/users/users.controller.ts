import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@clinic/shared';
import { ClinicId } from '../../shared/decorators/clinic-id.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@ClinicId() clinicId: string) {
    return this.usersService.list(clinicId);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @ClinicId() clinicId: string) {
    return this.usersService.create(clinicId, dto);
  }
}
