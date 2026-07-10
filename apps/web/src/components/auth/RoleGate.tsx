'use client';

import { ReactNode } from 'react';
import { Role } from '@clinic/shared';
import { useAuth } from '@/lib/auth/AuthContext';

interface RoleGateProps {
  roles: Role[];
  children: ReactNode;
}

export function RoleGate({ roles, children }: RoleGateProps) {
  const { role } = useAuth();
  return role && roles.includes(role) ? <>{children}</> : null;
}
