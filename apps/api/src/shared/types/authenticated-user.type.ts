import { Role } from '@clinic/shared';

// Shape of req.user once the JWT strategy (next step) populates it from the token payload.
export interface AuthenticatedUser {
  id: string;
  clinicId: string;
  role: Role;
  doctorId?: string;
}
