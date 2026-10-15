import 'server-only';
import { env, n8nConfigured } from './env';

// The four n8n workflows built earlier, now triggerable from the app.
// Each one has a Webhook trigger at  <N8N_WEBHOOK_BASE>/blue-market-<key>
// and checks the shared secret before doing anything.

export const WORKFLOWS = [
  { key: 'optimizer', name: 'Daily Optimizer', schedule: 'Every day, 6:50am',
    does: 'Reviews 30 days of keywords and search terms, then emails proposed bid, negative and budget changes for approval.' },
  { key: 'budget-guard', name: 'Budget Guard', schedule: 'Every 3 hours',
    does: 'Watches monthly pacing. Lowers budgets when the month runs hot and pauses at the monthly cap.' },
  { key: 'conversion-audit', name: 'Conversion Audit', schedule: 'Mondays, 7:20am',
    does: 'Checks that conversions are real: 60-second calls, one lead per click, no double counting, no silent tags.' },
  { key: 'revenue-upload', name: 'Offline Revenue Upload', schedule: 'Nightly, 9:10pm',
    does: 'Sends booked consults and closed revenue from the Leads sheet back to Google Ads.' },
] as const;

export type WorkflowKey = (typeof WORKFLOWS)[number]['key'];

export async function triggerWorkflow(key: WorkflowKey, account: { customerId: string; loginCustomerId: string; name: string }, by: string) {
  if (!n8nConfigured()) return { ok: false, message: 'n8n is not connected. Add N8N_WEBHOOK_BASE and N8N_WEBHOOK_SECRET in Vercel.' };
  if (!WORKFLOWS.some((w) => w.key === key)) return { ok: false, message: 'Unknown workflow.' };
  try {
    const res = await fetch(`${env.n8n.webhookBase.replace(/\/$/, '')}/blue-market-${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Blue-Market-Secret': env.n8n.secret },
      body: JSON.stringify({ secret: env.n8n.secret, customer_id: account.customerId, login_customer_id: account.loginCustomerId, account_name: account.name, requested_by: by }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, message: `n8n answered ${res.status}. Check that the workflow is active.` };
    return { ok: true, message: 'Started in n8n. Results arrive by email and in the Change Log sheet.' };
  } catch (e: any) {
    return { ok: false, message: `Couldn't reach n8n: ${e.message}` };
  }
}
