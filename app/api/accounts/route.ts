import { requireSession } from '@/lib/auth';
import { getAccounts, isDemo } from '@/lib/ads';
import { safe } from '@/lib/api';

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  return safe(async () => Response.json({ accounts: await getAccounts(), demo: isDemo() }));
}
