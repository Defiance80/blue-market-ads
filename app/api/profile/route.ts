import { requireSession } from '@/lib/auth';
import { getProfile, saveProfile, persistent, type StrategyProfile } from '@/lib/store';
import { bad } from '@/lib/api';

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;
  const id = (new URL(req.url).searchParams.get('customerId') || '').replace(/\D/g, '');
  if (!id) return bad('customerId is required');
  return Response.json({ profile: await getProfile(id), persistent: persistent() });
}

export async function PUT(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;
  const b = await req.json().catch(() => null);
  const id = String(b?.customerId || '').replace(/\D/g, '');
  if (!id) return bad('customerId is required');
  const s = (v: unknown, max = 2000) => (v === undefined || v === null ? undefined : String(v).slice(0, max));
  const n = (v: unknown) => (v === '' || v === undefined || v === null || isNaN(Number(v)) ? undefined : Number(v));
  const existing = await getProfile(id);
  const profile: StrategyProfile = {
    ...existing,
    customerId: id,
    business: s(b.business) ?? existing?.business ?? '',
    website: s(b.website, 300) ?? existing?.website,
    goals: s(b.goals) ?? existing?.goals ?? '',
    targetCpa: n(b.targetCpa) ?? existing?.targetCpa,
    targetRoas: n(b.targetRoas) ?? existing?.targetRoas,
    monthlyBudget: n(b.monthlyBudget) ?? existing?.monthlyBudget,
    serviceArea: s(b.serviceArea, 500) ?? existing?.serviceArea,
    audience: s(b.audience) ?? existing?.audience,
    offers: s(b.offers) ?? existing?.offers,
    rules: s(b.rules) ?? existing?.rules,
    updatedAt: new Date().toISOString(),
    updatedBy: session!.email,
  };
  return Response.json({ profile: await saveProfile(profile) });
}
