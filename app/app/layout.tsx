import type {ReactNode} from 'react';
import {redirect} from 'next/navigation';
import {getCurrentSession} from '@/lib/auth/session';

/** Provides a route group wrapper for authenticated application pages. */
export default async function AppAreaLayout({children}: {children: ReactNode}) {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  return children;
}
