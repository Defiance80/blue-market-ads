import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { AccountProvider } from '@/components/app/AccountContext';
import { Shell } from '@/components/app/Shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <AccountProvider>
      <Shell user={{ name: session.name, email: session.email }}>{children}</Shell>
    </AccountProvider>
  );
}
