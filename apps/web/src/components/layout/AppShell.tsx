'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/Button';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/calendar', label: 'Calendar' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="slot-closed h-7 w-7 shrink-0 rounded-md border border-line-strong" />
              <span className="hidden font-display text-sm font-semibold text-ink sm:inline">
                Clinic Appointments
              </span>
            </div>
            <nav className="flex items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  className={clsx(
                    'rounded-md px-3 py-1.5 font-display text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-brand-soft text-brand'
                      : 'text-ink-soft hover:bg-bg hover:text-ink',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {role && (
              <span className="hidden font-data text-[0.7rem] uppercase tracking-wide text-ink-faint sm:inline">
                {role}
              </span>
            )}
            <Button variant="ghost" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
