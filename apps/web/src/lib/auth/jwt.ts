import { Role } from '@clinic/shared';

interface JwtPayload {
  role?: Role;
}

export function decodeRole(token: string): Role | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as JwtPayload).role ?? null;
  } catch {
    return null;
  }
}
