import 'server-only';
import { adsConfigured, env } from '../env';
import * as live from './live';
import * as demo from './demo';
import { applyChangesLive, type ChangeResult } from './apply';
import { describeChange, validateChange, type Change } from './changes';
import type { AccountRef, RangeKey } from './types';

// ONE entry point for everything Google Ads. Each function routes to the
// live API when credentials exist, or to demo data when they don't, so
// the UI and the agent never need to know which mode they are in.

export const isDemo = () => !adsConfigured();

export const getAccounts = () => (isDemo() ? Promise.resolve(demo.demoAccounts()) : live.listTopAccounts());
export const getClients = (managerId: string) => (isDemo() ? Promise.resolve(demo.demoClients(managerId)) : live.listClients(managerId));
export const getReport = (ref: AccountRef, range: RangeKey) => (isDemo() ? Promise.resolve(demo.demoReport(ref.customerId, range)) : live.getReport(ref, range));
export const getKeywords = (ref: AccountRef, opts: { campaignId?: string; days?: number } = {}) =>
  isDemo() ? Promise.resolve(demo.demoKeywords(ref.customerId, opts.campaignId)) : live.getKeywords(ref, opts);
export const getSearchTerms = (ref: AccountRef, opts: { campaignId?: string } = {}) =>
  isDemo() ? Promise.resolve(demo.demoSearchTerms(ref.customerId, opts.campaignId)) : live.getSearchTerms(ref, opts);
export const readQuery = (ref: AccountRef, gaql: string) =>
  isDemo() ? Promise.reject(new Error('Custom queries need a connected Google Ads account. In demo mode use the other read tools.')) : live.readQuery(ref, gaql);
export const keywordIdeas = (ref: AccountRef, opts: { seeds: string[]; url?: string; locations?: string[]; limit?: number }) =>
  isDemo() ? Promise.resolve(demo.demoKeywordIdeas(opts.seeds.length ? opts.seeds : ['service']))
    : (async () => {
      const locationIds = opts.locations?.length ? (await live.suggestLocations(opts.locations)).map((l: any) => l.id).filter(Boolean).slice(0, 10) : undefined;
      return live.keywordIdeas(ref, { seeds: opts.seeds, url: opts.url, locationIds, limit: opts.limit });
    })();
export const demoSite = (customerId: string) => demo.findDemo(customerId)?.site;

export async function applyChanges(ref: AccountRef, changes: Change[]): Promise<{ results: ChangeResult[]; testMode: boolean }> {
  if (isDemo()) {
    return { testMode: true, results: changes.map((c, i) => {
      const problems = validateChange(c);
      return { index: i, summary: describeChange(c), ok: problems.length === 0,
        message: problems.length ? problems.join('; ') : 'Demo mode: checked, nothing sent to Google.' };
    }) };
  }
  return { testMode: env.ads.validateOnly, results: await applyChangesLive(ref, changes, env.ads.validateOnly) };
}
