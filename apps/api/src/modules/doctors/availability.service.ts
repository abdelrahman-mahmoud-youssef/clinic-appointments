import { Injectable } from '@nestjs/common';

@Injectable()
export class AvailabilityService {
  // ponytail: stub — always available until the real availability module
  // (working hours, time off, existing bookings) lands. AppointmentsService
  // depends on this injected class, not a direct check, so the real
  // implementation drops in here without touching any call site.
  isDoctorAvailable(_doctorId: string, _clinicId: string, _startsAt: Date, _endsAt: Date): Promise<boolean> {
    return Promise.resolve(true);
  }
}
