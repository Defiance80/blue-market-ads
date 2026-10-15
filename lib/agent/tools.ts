import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { getReport, getKeywords, getSearchTerms, readQuery, keywordIdeas, demoSite, isDemo } from '../ads';
import { validateChange, describeChange, spendDirection, CHANGE_KINDS, SNIPPET_HEADERS, type Change } from '../ads/changes';
import { RANGES, type AccountRef, type RangeKey } from '../ads/types';
import { scanWebsite } from '../scan';
import { getProfile, saveProfile } from '../store';
import { triggerWorkflow, WORKFLOWS, type WorkflowKey } from '../n8n';

// ---------------------------------------------------------------
// The agent's tools. Each has a JSON schema (what Claude may send) and
// a handler (what actually runs). Read tools return data; the only
// way to change an account is propose_changes, which hands a proposal
// to the person in the chat for approval.
// ---------------------------------------------------------------

export type Proposal = {
  id: string; title: string; rationale: string;
  changes: (Change & { summary: string; direction: 'up' | 'down' | 'neutral' })[];
};

export type ToolContext = {
  ref: AccountRef; accountName: string; user: string;
  emit: (event: Record<string, unknown>) => void;
};

export const TOOLS: Anthropic.Tool[] = [
  { name: 'get_performance',
    description: 'Account totals vs the previous period, daily trend, every campaign (channel, bid strategy, budget, spend, clicks, conversions, CPA, impression share lost to budget/rank) and Local Services leads.',
    input_schema: { type: 'object', properties: { range: { type: 'string', enum: RANGES.map((r) => r.key) } }, required: ['range'] } },
  { name: 'get_keywords',
    description: 'Keyword-level performance for the last 30 days: IDs (campaignId, adGroupId, criterionId), match type, bid, Quality Score and its three parts, clicks, cost, conversions, impression share lost to rank.',
    input_schema: { type: 'object', properties: { campaignId: { type: 'string', description: 'Optional: limit to one campaign' } } } },
  { name: 'get_search_terms',
    description: 'The actual searches that triggered ads in the last 30 days, with the keyword they matched, cost and conversions. Use for negative keywords and new keyword discovery.',
    input_schema: { type: 'object', properties: { campaignId: { type: 'string' } } } },
  { name: 'run_query',
    description: 'Run a read-only Google Ads Query Language (GAQL) SELECT for anything the other tools do not cover (ads and their strength, assets, locations, devices, hour of day, conversion actions, etc.). Max 200 rows returned.',
    input_schema: { type: 'object', properties: { gaql: { type: 'string' } }, required: ['gaql'] } },
  { name: 'scan_website',
    description: 'Read a website (home page plus key service, pricing, about and contact pages) to understand what the business sells, its offers, service area, proof points and real URLs for sitelinks.',
    input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'keyword_ideas',
    description: 'Keyword discovery from Google Keyword Planner: related keywords with average monthly searches, competition and top-of-page bid range. Seed with service phrases and/or the site URL; add locations like "Murrieta, California".',
    input_schema: { type: 'object', properties: {
      seeds: { type: 'array', items: { type: 'string' }, maxItems: 20 },
      url: { type: 'string' },
      locations: { type: 'array', items: { type: 'string' }, maxItems: 10 },
      limit: { type: 'integer', minimum: 10, maximum: 200 } }, required: ['seeds'] } },
  { name: 'save_strategy_profile',
    description: 'Save or update the strategy profile for this account (business, goals, targets, service area, audience, offers, standing rules). Only include fields you are setting.',
    input_schema: { type: 'object', properties: {
      business: { type: 'string' }, website: { type: 'string' }, goals: { type: 'string' },
      targetCpa: { type: 'number' }, targetRoas: { type: 'number' }, monthlyBudget: { type: 'number' },
      serviceArea: { type: 'string' }, audience: { type: 'string' }, offers: { type: 'string' }, rules: { type: 'string' } } } },
  { name: 'propose_changes',
    description: `Propose account changes for a person to approve. Nothing is applied until they click Apply. One proposal per coherent decision.
Each change is an object with "kind" plus its fields:
- add_negative_keywords: campaignId, keywords[{text, matchType: EXACT|PHRASE|BROAD}]
- add_keywords: adGroupId, keywords[{text, matchType, cpcBid?}]
- set_keyword_bid: adGroupId, criterionId, cpcBid, label (the keyword text)
- set_keyword_status: adGroupId, criterionId, status: ENABLED|PAUSED, label
- set_ad_group_bid: adGroupId, cpcBid
- set_campaign_budget: campaignId, dailyBudget (dollars per day)
- set_campaign_status: campaignId, status: ENABLED|PAUSED
- set_bidding_strategy: campaignId, strategy: MANUAL_CPC|MAXIMIZE_CLICKS|MAXIMIZE_CONVERSIONS|TARGET_CPA|MAXIMIZE_CONVERSION_VALUE|TARGET_ROAS, targetCpa?, targetRoas? (ratio, 4 = 400%), maxCpc? (required for MAXIMIZE_CLICKS)
- set_device_bid_adjustment: campaignId, device: MOBILE|DESKTOP|TABLET, percent (-100 to +900; manual CPC only)
- add_ad_schedule: campaignId, slots[{day: MONDAY..SUNDAY, startHour 0-23, endHour 1-24, percent?}]
- create_responsive_search_ad: adGroupId, finalUrl, headlines[3-15, ≤30 chars], descriptions[2-4, ≤90 chars], path1?, path2? (≤15 chars). Created paused.
- add_callouts: campaignId, callouts[≤25 chars each]
- add_sitelinks: campaignId, sitelinks[{text ≤25, description1? ≤35, description2? ≤35, finalUrl}]
- add_structured_snippet: campaignId, header (one of: ${SNIPPET_HEADERS.join(', ')}), values[3-10, ≤25 chars]`,
    input_schema: { type: 'object', properties: {
      title: { type: 'string', description: 'Short action title, e.g. "Block 12 job-seeker searches"' },
      rationale: { type: 'string', description: 'Why, with the numbers behind it, and the expected effect' },
      changes: { type: 'array', minItems: 1, maxItems: 30, items: { type: 'object', properties: { kind: { type: 'string', enum: [...CHANGE_KINDS] } }, required: ['kind'] } },
    }, required: ['title', 'rationale', 'changes'] } },
  { name: 'run_automation',
    description: `Start one of the agency's n8n workflows for this account now: ${WORKFLOWS.map((w) => `${w.key} (${w.does})`).join(' ')}`,
    input_schema: { type: 'object', properties: { workflow: { type: 'string', enum: WORKFLOWS.map((w) => w.key) } }, required: ['workflow'] } },
];

const round = (n: number) => Math.round(n * 100) / 100;

/** Runs one tool. Returns a JSON-able result, or throws (sent back to Claude as an error to fix). */
export async function runTool(name: string, input: any, ctx: ToolContext): Promise<unknown> {
  const { ref } = ctx;
  switch (name) {
    case 'get_performance': {
      const r = await getReport(ref, (input.range || 'LAST_30_DAYS') as RangeKey);
      const cpa = (cost: number, conv: number) => (conv ? round(cost / conv) : null);
      return {
        range: r.range, demo: r.demo,
        totals: { ...mapRound(r.totals), cpa: cpa(r.totals.cost, r.totals.conversions), ctr: pct(r.totals.clicks, r.totals.impressions) },
        previousPeriod: { ...mapRound(r.previous), cpa: cpa(r.previous.cost, r.previous.conversions) },
        campaigns: r.campaigns.map((c) => ({ ...c, cost: round(c.cost), value: round(c.value), cpa: cpa(c.cost, c.conversions), ctr: pct(c.clicks, c.impressions),
          impressionShare: c.impressionShare === null ? null : pct(c.impressionShare, 1), lostToBudget: c.lostToBudget === null ? null : pct(c.lostToBudget, 1), lostToRank: c.lostToRank === null ? null : pct(c.lostToRank, 1) })),
        daily: r.daily.map((d) => ({ date: d.date, cost: round(d.cost), conversions: round(d.conversions) })),
        lsa: r.lsaLeads.length ? summarizeLsa(r.lsaLeads) : 'No Local Services leads in this range.',
      };
    }
    case 'get_keywords': return (await getKeywords(ref, { campaignId: input.campaignId })).slice(0, 250);
    case 'get_search_terms': return (await getSearchTerms(ref, { campaignId: input.campaignId })).slice(0, 300);
    case 'run_query': return readQuery(ref, String(input.gaql || ''));
    case 'scan_website': {
      ctx.emit({ type: 'status', text: `Reading ${String(input.url).replace(/^https?:\/\//, '')}` });
      if (isDemo() && demoSite(ref.customerId) && String(input.url).includes('.example.com')) {
        return { note: 'Demo account: this sample site does not exist. Use the business described in the strategy profile and campaign names.' };
      }
      return scanWebsite(String(input.url));
    }
    case 'keyword_ideas': return keywordIdeas(ref, { seeds: input.seeds || [], url: input.url, locations: input.locations, limit: input.limit });
    case 'save_strategy_profile': {
      const existing = await getProfile(ref.customerId);
      const saved = await saveProfile({ business: '', goals: '', ...existing, ...pick(input), customerId: ref.customerId, updatedAt: new Date().toISOString(), updatedBy: `agent for ${ctx.user}` });
      ctx.emit({ type: 'profile', profile: saved });
      return { saved: true };
    }
    case 'propose_changes': {
      const changes: Change[] = Array.isArray(input.changes) ? input.changes : [];
      const problems = changes.flatMap((c, i) => validateChange(c).map((p) => `change ${i + 1} (${(c as any).kind}): ${p}`));
      if (problems.length) throw new Error('Fix these and propose again:\n' + problems.join('\n'));
      const proposal: Proposal = {
        id: crypto.randomUUID(), title: String(input.title).slice(0, 140), rationale: String(input.rationale).slice(0, 2000),
        changes: changes.map((c) => ({ ...c, summary: describeChange(c), direction: spendDirection(c) })),
      };
      ctx.emit({ type: 'proposal', proposal });
      return { proposed: true, awaitingApproval: true, changes: changes.length };
    }
    case 'run_automation': {
      const out = await triggerWorkflow(input.workflow as WorkflowKey, { ...ref, name: ctx.accountName }, ctx.user);
      if (!out.ok) throw new Error(out.message);
      return out;
    }
    default: throw new Error(`Unknown tool ${name}`);
  }
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
const mapRound = (t: Record<string, number>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, round(v)]));
const PROFILE_FIELDS = ['business', 'website', 'goals', 'targetCpa', 'targetRoas', 'monthlyBudget', 'serviceArea', 'audience', 'offers', 'rules'];
const pick = (o: any) => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => PROFILE_FIELDS.includes(k) && v !== undefined && v !== ''));

function summarizeLsa(leads: { type: string; status: string; charged: boolean }[]) {
  const by = (f: (l: any) => string) => leads.reduce((a: Record<string, number>, l) => ((a[f(l)] = (a[f(l)] || 0) + 1), a), {});
  return { total: leads.length, charged: leads.filter((l) => l.charged).length, byType: by((l) => l.type), byStatus: by((l) => l.status) };
}
