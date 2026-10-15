// ---------------------------------------------------------------
// DEMO DATA — used whenever Google Ads credentials are not set.
// Fictional businesses with realistic numbers, generated from a fixed
// seed so the same account and date always show the same figures.
// ---------------------------------------------------------------
import { rangeDates, addDays, daysBetween } from '../dates';
import type { Account, CampaignRow, Channel, ClientAccount, DailyRow, LsaLead, RangeKey, Report, Totals } from './types';

export const DEMO_MANAGER: Account = { id: '4815162342', name: 'Blue Market Ads (Manager)', isManager: true, currency: 'USD', timeZone: 'America/Los_Angeles' };
const HOUSE: Account = { id: '9081726354', name: 'Blue Market Ads — House', isManager: false, currency: 'USD', timeZone: 'America/Los_Angeles' };

type DemoCampaign = { id: string; name: string; channel: Channel; strategy: string; budget: number; cpc: number; cvr: number; ctr: number; value: number; status?: string; adGroups: { id: string; name: string; keywords: string[] }[] };
type DemoAccount = ClientAccount & { site: string; campaigns: DemoCampaign[] };

const ag = (id: string, name: string, keywords: string[]) => ({ id, name, keywords });

const CLIENTS: DemoAccount[] = [
  { id: '1029384756', name: 'Harbor Periodontics', isManager: false, level: 1, currency: 'USD', site: 'https://harborperio.example.com', campaigns: [
    { id: '21001', name: 'Dental Implants - Search', channel: 'SEARCH', strategy: 'MAXIMIZE_CONVERSIONS', budget: 85, cpc: 11.4, cvr: 0.085, ctr: 0.071, value: 4200,
      adGroups: [ag('31001', 'Implants', ['dental implants', 'dental implants near me', 'tooth implant cost', 'same day implants']), ag('31002', 'All-on-4', ['all on 4 dental implants', 'full mouth implants', 'all on four cost'])] },
    { id: '21002', name: 'Gum Disease - Search', channel: 'SEARCH', strategy: 'MANUAL_CPC', budget: 40, cpc: 7.2, cvr: 0.06, ctr: 0.058, value: 1400,
      adGroups: [ag('31003', 'Periodontal Treatment', ['periodontist near me', 'gum disease treatment', 'gum grafting', 'deep cleaning teeth'])] },
    { id: '21003', name: 'Brand', channel: 'SEARCH', strategy: 'TARGET_SPEND', budget: 10, cpc: 1.9, cvr: 0.21, ctr: 0.24, value: 900,
      adGroups: [ag('31004', 'Brand', ['harbor periodontics', 'harbor perio'])] },
    { id: '21004', name: 'Local Services - Periodontist', channel: 'LOCAL_SERVICES', strategy: 'MAXIMIZE_CONVERSIONS', budget: 45, cpc: 38, cvr: 0.62, ctr: 0.12, value: 2600, adGroups: [] },
  ] },
  { id: '2038475610', name: 'Ironline Tattoo Studio', isManager: false, level: 1, currency: 'USD', site: 'https://ironlinetattoo.example.com', campaigns: [
    { id: '22001', name: 'Cover-Ups - Search', channel: 'SEARCH', strategy: 'MANUAL_CPC', budget: 30, cpc: 3.1, cvr: 0.072, ctr: 0.083, value: 900,
      adGroups: [ag('32001', 'Cover-Ups', ['cover up tattoo artist near me', 'tattoo cover up', 'dark tattoo cover up', 'name cover up tattoo'])] },
    { id: '22002', name: 'Portraits - Search', channel: 'SEARCH', strategy: 'MANUAL_CPC', budget: 25, cpc: 2.6, cvr: 0.055, ctr: 0.069, value: 1100,
      adGroups: [ag('32002', 'Portraits', ['portrait tattoo artist', 'memorial tattoo', 'pet portrait tattoo', 'black and grey realism tattoo'])] },
    { id: '22003', name: 'Walk-ins - Search', channel: 'SEARCH', strategy: 'TARGET_SPEND', budget: 15, cpc: 1.8, cvr: 0.04, ctr: 0.052, value: 180,
      adGroups: [ag('32003', 'Walk-ins', ['tattoo shop near me', 'walk in tattoo', 'tattoo shops open now'])] },
  ] },
  { id: '3047561029', name: 'Summit Air HVAC', isManager: false, level: 1, currency: 'USD', site: 'https://summitairhvac.example.com', campaigns: [
    { id: '23001', name: 'AC Repair - Search', channel: 'SEARCH', strategy: 'TARGET_CPA', budget: 120, cpc: 14.8, cvr: 0.11, ctr: 0.064, value: 650,
      adGroups: [ag('33001', 'AC Repair', ['ac repair near me', 'air conditioner repair', 'emergency ac repair', 'ac not cooling'])] },
    { id: '23002', name: 'Furnace & Heating - Search', channel: 'SEARCH', strategy: 'MAXIMIZE_CONVERSIONS', budget: 60, cpc: 12.1, cvr: 0.09, ctr: 0.057, value: 700,
      adGroups: [ag('33002', 'Furnace', ['furnace repair', 'heater repair near me', 'furnace replacement cost'])] },
    { id: '23003', name: 'Local Services - HVAC', channel: 'LOCAL_SERVICES', strategy: 'MAXIMIZE_CONVERSIONS', budget: 90, cpc: 42, cvr: 0.7, ctr: 0.14, value: 900, adGroups: [] },
  ] },
  { id: '4056102938', name: 'Lumen MedSpa', isManager: false, level: 1, currency: 'USD', site: 'https://lumenmedspa.example.com', campaigns: [
    { id: '24001', name: 'Botox & Fillers - Search', channel: 'SEARCH', strategy: 'TARGET_CPA', budget: 55, cpc: 6.4, cvr: 0.078, ctr: 0.074, value: 520,
      adGroups: [ag('34001', 'Injectables', ['botox near me', 'lip filler', 'botox cost', 'dermal fillers'])] },
    { id: '24002', name: 'Laser Hair Removal - Search', channel: 'SEARCH', strategy: 'MAXIMIZE_CONVERSIONS', budget: 35, cpc: 4.9, cvr: 0.064, ctr: 0.061, value: 900,
      adGroups: [ag('34002', 'Laser Hair', ['laser hair removal', 'laser hair removal near me', 'brazilian laser hair removal'])] },
    { id: '24003', name: 'Skincare Shop - Performance Max', channel: 'PERFORMANCE_MAX', strategy: 'MAXIMIZE_CONVERSION_VALUE', budget: 30, cpc: 0.9, cvr: 0.028, ctr: 0.018, value: 74, adGroups: [] },
  ] },
];

// --- deterministic pseudo-random numbers -------------------------------
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rand = (key: string) => (hash(key) % 10_000) / 10_000;                 // 0..1
const wobble = (key: string, spread = 0.35) => 1 - spread + 2 * spread * rand(key); // around 1

function campaignDay(acct: DemoAccount, c: DemoCampaign, date: string): Totals {
  const dow = new Date(date + 'T12:00:00Z').getUTCDay();
  const weekday = dow === 0 ? 0.62 : dow === 6 ? 0.78 : 1.04;
  const cost = c.budget * 0.93 * weekday * wobble(`${acct.id}${c.id}${date}c`, 0.22);
  const clicks = Math.max(1, Math.round(cost / (c.cpc * wobble(`${c.id}${date}p`, 0.15))));
  const impressions = Math.round(clicks / (c.ctr * wobble(`${c.id}${date}t`, 0.2)));
  const expected = clicks * c.cvr * wobble(`${c.id}${date}v`, 0.55);
  const conversions = Math.floor(expected) + (rand(`${c.id}${date}r`) < expected % 1 ? 1 : 0);
  return { cost: Math.round(cost * 100) / 100, clicks, impressions, conversions, value: conversions * c.value * wobble(`${c.id}${date}x`, 0.3) };
}

export const demoAccounts = (): Account[] => [DEMO_MANAGER, HOUSE];
export const demoClients = (managerId: string): ClientAccount[] =>
  managerId === DEMO_MANAGER.id ? CLIENTS.map(({ campaigns, site, ...a }) => a) : [];
export const findDemo = (id: string) => CLIENTS.find((c) => c.id === id) || (id === HOUSE.id ? { ...HOUSE, level: 0, site: 'https://bluemarketads.example.com', campaigns: CLIENTS[1].campaigns } as DemoAccount : undefined);

const sum = (rows: Totals[]): Totals => rows.reduce((a, r) => ({ cost: a.cost + r.cost, clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions, conversions: a.conversions + r.conversions, value: a.value + r.value }), { cost: 0, clicks: 0, impressions: 0, conversions: 0, value: 0 });

export function demoReport(customerId: string, rangeKey: RangeKey): Report {
  const acct = findDemo(customerId);
  if (!acct) throw new Error('This is a manager account. Pick a client account to see its campaigns.');
  const r = rangeDates(rangeKey, 'America/Los_Angeles');
  const days = (a: string, b: string) => Array.from({ length: daysBetween(a, b) }, (_, i) => addDays(a, i));

  const daily: DailyRow[] = days(r.start, r.end).map((date) => ({ date, ...sum(acct.campaigns.filter((c) => c.status !== 'PAUSED').map((c) => campaignDay(acct, c, date))) }));
  const previous = sum(days(r.prevStart, r.prevEnd).flatMap((date) => acct.campaigns.map((c) => campaignDay(acct, c, date))));

  const campaigns: CampaignRow[] = acct.campaigns.map((c) => {
    const t = sum(days(r.start, r.end).map((d) => campaignDay(acct, c, d)));
    const search = c.channel === 'SEARCH';
    return {
      id: c.id, name: c.name, status: c.status || 'ENABLED', channel: c.channel, biddingStrategy: c.strategy, dailyBudget: c.budget,
      impressionShare: search ? 0.38 + 0.4 * rand(c.id + 'is') : null,
      lostToBudget: search ? 0.05 + 0.3 * rand(c.id + 'lb') : null,
      lostToRank: search ? 0.08 + 0.3 * rand(c.id + 'lr') : null,
      ...t,
    };
  }).sort((a, b) => b.cost - a.cost);

  const lsa = acct.campaigns.filter((c) => c.channel === 'LOCAL_SERVICES');
  const lsaLeads: LsaLead[] = lsa.flatMap((c) => days(r.start, r.end).flatMap((date) => {
    const n = campaignDay(acct, c, date).conversions;
    return Array.from({ length: n }, (_, i): LsaLead => {
      const x = rand(`${c.id}${date}${i}lead`);
      return { type: x < 0.72 ? 'PHONE_CALL' : x < 0.93 ? 'MESSAGE' : 'BOOKING', status: x < 0.08 ? 'DISPUTED' : x < 0.85 ? 'BOOKED' : 'NEW',
        createdAt: `${date} ${String(8 + Math.floor(x * 10)).padStart(2, '0')}:15:00`, charged: x > 0.08, category: 'Primary service' };
    });
  }));

  return { account: { id: acct.id, name: acct.name, currency: acct.currency }, range: { key: rangeKey, start: r.start, end: r.end },
    totals: sum(daily), previous, daily, campaigns, lsaLeads, demo: true };
}

/** Keyword-level rows for the agent, built from the same campaigns. */
export function demoKeywords(customerId: string, campaignId?: string) {
  const acct = findDemo(customerId);
  if (!acct) return [];
  return acct.campaigns.filter((c) => !campaignId || c.id === campaignId).flatMap((c) => c.adGroups.flatMap((g) => g.keywords.map((k, i) => {
    const w = 0.4 + 1.4 * rand(c.id + k);
    const clicks = Math.round(30 * (c.budget / c.cpc) / Math.max(c.adGroups.length * g.keywords.length, 1) * w);
    const cost = Math.round(clicks * c.cpc * wobble(k + 'cp', 0.25) * 100) / 100;
    const conv = Math.round(clicks * c.cvr * wobble(k + 'cv', 0.9) * 10) / 10;
    return { campaignId: c.id, campaign: c.name, adGroupId: g.id, adGroup: g.name, criterionId: String(5000 + hash(k) % 90000), keyword: k,
      matchType: i % 3 === 0 ? 'EXACT' : i % 3 === 1 ? 'PHRASE' : 'BROAD', status: 'ENABLED', cpcBid: c.strategy === 'MANUAL_CPC' ? Math.round(c.cpc * 1.15 * 100) / 100 : null,
      qualityScore: 3 + (hash(k + 'qs') % 8), clicks, impressions: Math.round(clicks / c.ctr), cost, conversions: conv };
  })));
}

const JUNK = ['jobs', 'salary', 'free', 'diy', 'school', 'reddit', 'cheap', 'how to'];
export function demoSearchTerms(customerId: string, campaignId?: string) {
  return demoKeywords(customerId, campaignId).flatMap((k) => {
    const junk = JUNK[hash(k.keyword) % JUNK.length];
    return [
      { ...k, searchTerm: k.keyword, clicks: Math.round(k.clicks * 0.4), cost: Math.round(k.cost * 40) / 100, conversions: Math.round(k.conversions * 4) / 10 },
      { ...k, searchTerm: `${k.keyword} ${junk}`, clicks: Math.max(1, Math.round(k.clicks * 0.08)), cost: Math.round(k.cost * 9) / 100, conversions: 0 },
      { ...k, searchTerm: `best ${k.keyword} reviews`, clicks: Math.max(1, Math.round(k.clicks * 0.12)), cost: Math.round(k.cost * 12) / 100, conversions: Math.round(k.conversions * 1) / 10 },
    ];
  }).map(({ keyword, matchType, status, cpcBid, qualityScore, criterionId, impressions, ...t }) => ({ ...t, matchedKeyword: keyword }));
}

export function demoKeywordIdeas(seeds: string[]) {
  const mods = ['near me', 'cost', 'best', 'affordable', 'specialist', 'reviews', 'same day', 'consultation', 'before and after', 'financing'];
  return seeds.flatMap((s) => mods.map((m, i) => {
    const kw = i % 2 ? `${s} ${m}` : `${m} ${s}`;
    return { keyword: kw, avgMonthlySearches: [90, 140, 210, 320, 480, 720, 1300][hash(kw) % 7], competition: ['LOW', 'MEDIUM', 'HIGH'][hash(kw + 'c') % 3],
      lowBid: 1 + (hash(kw) % 600) / 100, highBid: 4 + (hash(kw + 'h') % 1600) / 100 };
  })).slice(0, 60);
}
