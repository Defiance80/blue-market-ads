import { requireSession } from '@/lib/auth';
import { getReport } from '@/lib/ads';
import { RANGES, type RangeKey } from '@/lib/ads/types';
import { bad, refFrom, safe } from '@/lib/api';

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;
  const params = new URL(req.url).searchParams;
  const ref = refFrom(params);
  if (!ref) return bad('Pick an account first.');
  const range = (params.get('range') || 'LAST_30_DAYS') as RangeKey;
  if (!RANGES.some((r) => r.key === range)) return bad('Unknown date range.');
  return safe(async () => Response.json(await getReport(ref, range)));
}
