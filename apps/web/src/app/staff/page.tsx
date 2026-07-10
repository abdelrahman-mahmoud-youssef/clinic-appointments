'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Role } from '@clinic/shared';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/AuthContext';
import { listUsers, createUser } from '@/lib/api/users';
import { listDoctors } from '@/lib/api/doctors';
import { extractErrorMessage } from '@/lib/api/errorMessage';
import { AppShell } from '@/components/layout/AppShell';
import { Field, Input, Select } from '@/components/ui/FormControls';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Badge } from '@/components/ui/Badge';

const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: 'Admin',
  [Role.RECEPTIONIST]: 'Receptionist',
  [Role.DOCTOR]: 'Doctor',
};

const ROLE_COLORS: Record<Role, string> = {
  [Role.ADMIN]: '#0f6e63',
  [Role.RECEPTIONIST]: '#3b6fd9',
  [Role.DOCTOR]: '#c97a2b',
};

export default function StaffPage() {
  const isReady = useRequireAuth();
  const { role } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>(Role.RECEPTIONIST);
  const [doctorId, setDoctorId] = useState('');

  useEffect(() => {
    if (isReady && role && role !== Role.ADMIN) router.replace('/dashboard');
  }, [isReady, role, router]);

  const enabled = isReady && role === Role.ADMIN;
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: listUsers, enabled });
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: listDoctors, enabled });

  const create = useMutation({
    mutationFn: () =>
      createUser({
        email: email.trim(),
        password,
        role: newRole,
        doctorId: newRole === Role.DOCTOR && doctorId ? doctorId : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEmail('');
      setPassword('');
      setDoctorId('');
    },
  });

  if (!isReady || role !== Role.ADMIN) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">Loading…</div>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Staff</h1>
        <p className="mt-1 text-sm text-ink-soft">Create accounts for receptionists, doctors, and admins.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-line bg-surface p-5 lg:col-span-1"
        >
          <h2 className="mb-3 font-display text-sm font-semibold text-ink">Add a member</h2>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              required
            />
          </Field>
          <Field label="Temporary password">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Role">
            <Select value={newRole} onChange={(event) => setNewRole(event.target.value as Role)}>
              {Object.values(Role).map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          {newRole === Role.DOCTOR && (
            <Field label="Linked doctor">
              <Select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
                <option value="">Not linked</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {create.isError && (
            <div className="mb-3">
              <Banner onDismiss={() => create.reset()}>{extractErrorMessage(create.error)}</Banner>
            </div>
          )}
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add member'}
          </Button>
        </form>

        <div className="overflow-hidden rounded-lg border border-line bg-surface lg:col-span-2">
          {users.length === 0 ? (
            <p className="p-5 text-sm text-ink-soft">No staff yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {users.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <span className="min-w-0 truncate text-sm text-ink">{user.email}</span>
                  <Badge color={ROLE_COLORS[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
