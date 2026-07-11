'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Role } from '@clinic/shared';
import { useAuth } from '@/lib/auth/AuthContext';
import { getClinicSettings } from '@/lib/api/clinic';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

const NAV: { href: string; label: string; roles?: Role[] }[] = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/doctors', label: 'Doctors', roles: [Role.ADMIN] },
  { href: '/staff', label: 'Staff', roles: [Role.ADMIN] },
  { href: '/settings', label: 'Settings', roles: [Role.ADMIN] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: clinic } = useQuery({ queryKey: ['clinic-settings'], queryFn: getClinicSettings });

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const nav = NAV.filter((item) => !item.roles || (role && item.roles.includes(role)));

  const linkClass = (href: string) =>
    clsx(
      'rounded-md px-3 py-1.5 font-display text-sm font-medium transition-colors',
      pathname === href ? 'bg-brand-soft text-brand' : 'text-ink-soft hover:bg-bg hover:text-ink',
    );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Logo size={28} />
              <span className="hidden font-display text-sm font-semibold text-ink sm:inline">
                {clinic?.name ?? 'Clinic Appointments'}
              </span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  className={linkClass(item.href)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {role && (
              <span className="font-data text-[0.7rem] uppercase tracking-wide text-ink-faint">{role}</span>
            )}
            <Button variant="ghost" onClick={logout}>
              Log out
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="rounded-md p-2 text-ink-soft hover:bg-bg md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav className="border-t border-line px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  className={linkClass(item.href)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              {role && (
                <span className="font-data text-[0.7rem] uppercase tracking-wide text-ink-faint">{role}</span>
              )}
              <Button variant="ghost" onClick={logout}>
                Log out
              </Button>
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
