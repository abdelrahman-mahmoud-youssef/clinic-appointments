import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user.type';

// The only place clinicId may come from. Never trust it from the request body or params.
export const ClinicId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const user: AuthenticatedUser | undefined = request.user;

  if (!user?.clinicId) {
    throw new Error(
      'ClinicId decorator used on a route with no authenticated user. Apply an auth guard before using @ClinicId().',
    );
  }

  return user.clinicId;
});
