import 'server-only';
import { Redis } from '@upstash/redis';
import { env, storeConfigured } from './env';

// ---------------------------------------------------------------
// Small persistent store for two things:
//   1. Strategy profiles: what each client sells, its goals and rules.
//      The agent reads this before every conversation about that account.
//   2. The activity log: every change applied from the app.
// Uses Upstash Redis when connected (Vercel Marketplace). Without it,
// data lives in memory and disappears when the server restarts.
// ---------------------------------------------------------------

export type StrategyProfile = {
  customerId: string;
  business: string;           // what they sell, in a sentence or two
  website?: string;
  goals: string;              // e.g. "booked implant consults"
  targetCpa?: number;
  targetRoas?: number;
  monthlyBudget?: number;
  serviceArea?: string;
  audience?: string;
  offers?: string;            // financing, free consult, etc.
  rules?: string;             // things to always/never do
  campaignNotes?: Record<string, string>;
  updatedAt: string;
  updatedBy: string;
};

export type ActivityEntry = {
  at: string; by: string; customerId: string; accountName: string;
  summary: string; ok: boolean; message: string; testMode: boolean;
};

const redis = storeConfigured() ? new Redis({ url: env.redis.url, token: env.redis.token }) : null;
const mem = (globalThis as any).__bmStore ||= { profiles: {} as Record<string, StrategyProfile>, activity: [] as ActivityEntry[] };

export const persistent = () => !!redis;

export async function getProfile(customerId: string): Promise<StrategyProfile | null> {
  if (redis) return (await redis.get<StrategyProfile>(`profile:${customerId}`)) || null;
  return mem.profiles[customerId] || null;
}

export async function saveProfile(p: StrategyProfile) {
  if (redis) await redis.set(`profile:${p.customerId}`, p);
  else mem.profiles[p.customerId] = p;
  return p;
}

export async function logActivity(entries: ActivityEntry[]) {
  if (!entries.length) return;
  if (redis) {
    await redis.lpush('activity', ...entries.map((e) => JSON.stringify(e)));
    await redis.ltrim('activity', 0, 999);
  } else {
    mem.activity.unshift(...entries);
    mem.activity.length = Math.min(mem.activity.length, 1000);
  }
}

export async function getActivity(customerId?: string, limit = 100): Promise<ActivityEntry[]> {
  let list: ActivityEntry[];
  if (redis) {
    const raw = await redis.lrange('activity', 0, 999);
    list = raw.map((r: any) => (typeof r === 'string' ? JSON.parse(r) : r));
  } else list = mem.activity;
  return list.filter((e) => !customerId || e.customerId === customerId).slice(0, limit);
}
