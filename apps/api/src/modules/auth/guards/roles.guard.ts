import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@clinic/shared';
import { ROLES_KEY } from '../../../shared/decorators/roles.decorator';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role for this action');
    }

    return true;
  }
}
