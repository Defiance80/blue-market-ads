import { requireSession } from '@/lib/auth';
import { getClients } from '@/lib/ads';
import { bad, safe } from '@/lib/api';

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;
  const managerId = (new URL(req.url).searchParams.get('managerId') || '').replace(/\D/g, '');
  if (!managerId) return bad('managerId is required');
  return safe(async () => Response.json({ clients: await getClients(managerId) }));
}
