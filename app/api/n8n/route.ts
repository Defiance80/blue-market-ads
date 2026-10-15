import { requireSession } from '@/lib/auth';
import { triggerWorkflow, WORKFLOWS, type WorkflowKey } from '@/lib/n8n';
import { n8nConfigured } from '@/lib/env';
import { bad, refFrom } from '@/lib/api';

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  return Response.json({ workflows: WORKFLOWS, connected: n8nConfigured() });
}

export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;
  const b = await req.json().catch(() => null);
  const ref = refFrom(b || {});
  if (!ref) return bad('Pick an account first.');
  const out = await triggerWorkflow(b.workflow as WorkflowKey, { ...ref, name: String(b.accountName || '') }, session!.email);
  return Response.json(out, { status: out.ok ? 200 : 400 });
}
