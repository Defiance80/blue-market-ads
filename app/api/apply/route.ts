import { requireSession } from '@/lib/auth';
import { applyChanges, isDemo } from '@/lib/ads';
import { CHANGE_KINDS, type Change } from '@/lib/ads/changes';
import { logActivity } from '@/lib/store';
import { bad, refFrom, safe } from '@/lib/api';

// Applies changes a person approved in the UI. The same validation runs
// again here; nothing from the browser is trusted blindly.
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;
  const body = await req.json().catch(() => null);
  const ref = refFrom(body || {});
  if (!ref) return bad('Pick an account first.');
  const changes: Change[] = Array.isArray(body?.changes) ? body.changes : [];
  if (!changes.length || changes.length > 50) return bad('Send 1–50 changes.');
  if (changes.some((c) => !(CHANGE_KINDS as readonly string[]).includes(c?.kind))) return bad('Unknown change type.');

  return safe(async () => {
    const out = await applyChanges(ref, changes);
    await logActivity(out.results.map((r) => ({
      at: new Date().toISOString(), by: session!.email, customerId: ref.customerId,
      accountName: String(body.accountName || ref.customerId).slice(0, 120),
      summary: r.summary, ok: r.ok, message: r.message, testMode: out.testMode,
    })));
    return Response.json({ ...out, demo: isDemo() });
  });
}
