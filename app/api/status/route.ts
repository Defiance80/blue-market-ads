import { requireSession } from '@/lib/auth';
import { adsConfigured, agentConfigured, n8nConfigured, storeConfigured, env } from '@/lib/env';

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  return Response.json({
    googleAds: adsConfigured(), testMode: env.ads.validateOnly, apiVersion: env.ads.apiVersion,
    agent: agentConfigured(), model: env.anthropic.model,
    n8n: n8nConfigured(), storage: storeConfigured(),
  });
}
