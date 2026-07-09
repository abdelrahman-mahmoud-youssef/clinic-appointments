import type { Metadata } from 'next';
import { QueryProvider } from '@/lib/query/QueryProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clinic Appointments',
  description: 'Appointment calendar for clinic staff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
