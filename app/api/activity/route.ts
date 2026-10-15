import { requireSession } from '@/lib/auth';
import { getActivity, persistent } from '@/lib/store';

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;
  const id = (new URL(req.url).searchParams.get('customerId') || '').replace(/\D/g, '') || undefined;
  return Response.json({ activity: await getActivity(id), persistent: persistent() });
}
