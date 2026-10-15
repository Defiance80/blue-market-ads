// ---------------------------------------------------------------
// THE CHANGE ENGINE
// The agent never sends raw API calls. It proposes typed "changes"
// from this fixed menu. Each change is validated here (Google's
// character limits, IDs, sensible ranges) and only then turned into
// a Google Ads API operation. Anything malformed is rejected with a
// reason the agent can read and fix.
// ---------------------------------------------------------------

export type MatchType = 'EXACT' | 'PHRASE' | 'BROAD';
export type Strategy = 'MANUAL_CPC' | 'MAXIMIZE_CLICKS' | 'MAXIMIZE_CONVERSIONS' | 'TARGET_CPA' | 'MAXIMIZE_CONVERSION_VALUE' | 'TARGET_ROAS';
export type Day = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type Change =
  | { kind: 'add_negative_keywords'; campaignId: string; keywords: { text: string; matchType: MatchType }[] }
  | { kind: 'add_keywords'; adGroupId: string; keywords: { text: string; matchType: MatchType; cpcBid?: number }[] }
  | { kind: 'set_keyword_bid'; adGroupId: string; criterionId: string; cpcBid: number; label?: string }
  | { kind: 'set_keyword_status'; adGroupId: string; criterionId: string; status: 'ENABLED' | 'PAUSED'; label?: string }
  | { kind: 'set_ad_group_bid'; adGroupId: string; cpcBid: number }
  | { kind: 'set_campaign_budget'; campaignId: string; dailyBudget: number }
  | { kind: 'set_campaign_status'; campaignId: string; status: 'ENABLED' | 'PAUSED' }
  | { kind: 'set_bidding_strategy'; campaignId: string; strategy: Strategy; targetCpa?: number; targetRoas?: number; maxCpc?: number }
  | { kind: 'set_device_bid_adjustment'; campaignId: string; device: 'MOBILE' | 'DESKTOP' | 'TABLET'; percent: number }
  | { kind: 'add_ad_schedule'; campaignId: string; slots: { day: Day; startHour: number; endHour: number; percent?: number }[] }
  | { kind: 'create_responsive_search_ad'; adGroupId: string; finalUrl: string; headlines: string[]; descriptions: string[]; path1?: string; path2?: string }
  | { kind: 'add_callouts'; campaignId: string; callouts: string[] }
  | { kind: 'add_sitelinks'; campaignId: string; sitelinks: { text: string; description1?: string; description2?: string; finalUrl: string }[] }
  | { kind: 'add_structured_snippet'; campaignId: string; header: string; values: string[] };

export const CHANGE_KINDS = [
  'add_negative_keywords', 'add_keywords', 'set_keyword_bid', 'set_keyword_status', 'set_ad_group_bid',
  'set_campaign_budget', 'set_campaign_status', 'set_bidding_strategy', 'set_device_bid_adjustment',
  'add_ad_schedule', 'create_responsive_search_ad', 'add_callouts', 'add_sitelinks', 'add_structured_snippet',
] as const;

// Google's published limits
export const LIMITS = {
  headline: 30, description: 90, path: 15, callout: 25, sitelinkText: 25, sitelinkDesc: 35, snippetValue: 25, keyword: 80,
  maxBid: 100, maxDailyBudget: 5000,
};
export const SNIPPET_HEADERS = ['Amenities', 'Brands', 'Courses', 'Degree programs', 'Destinations', 'Featured hotels',
  'Insurance coverage', 'Models', 'Neighborhoods', 'Service catalog', 'Shows', 'Styles', 'Types'];

const isId = (v: unknown) => typeof v === 'string' && /^\d{1,20}$/.test(v);
const isUrl = (v: unknown) => { try { const u = new URL(String(v)); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; } };
const MATCH = ['EXACT', 'PHRASE', 'BROAD'];
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

/** Returns a list of problems. Empty list = the change is valid. */
export function validateChange(c: Change): string[] {
  const e: string[] = [];
  const need = (cond: boolean, msg: string) => { if (!cond) e.push(msg); };
  const len = (s: string, max: number, what: string) => need(typeof s === 'string' && s.trim().length > 0 && s.length <= max, `${what} "${s}" must be 1–${max} characters (is ${s?.length ?? 0})`);

  switch (c.kind) {
    case 'add_negative_keywords':
      need(isId(c.campaignId), 'campaignId must be numeric');
      need(Array.isArray(c.keywords) && c.keywords.length > 0 && c.keywords.length <= 200, '1–200 negative keywords');
      c.keywords?.forEach((k) => { len(k.text, LIMITS.keyword, 'Keyword'); need(MATCH.includes(k.matchType), `matchType for "${k.text}" must be EXACT, PHRASE or BROAD`); });
      break;
    case 'add_keywords':
      need(isId(c.adGroupId), 'adGroupId must be numeric');
      need(Array.isArray(c.keywords) && c.keywords.length > 0 && c.keywords.length <= 100, '1–100 keywords');
      c.keywords?.forEach((k) => {
        len(k.text, LIMITS.keyword, 'Keyword'); need(MATCH.includes(k.matchType), `matchType for "${k.text}" must be EXACT, PHRASE or BROAD`);
        if (k.cpcBid !== undefined) need(k.cpcBid >= 0.05 && k.cpcBid <= LIMITS.maxBid, `Bid for "${k.text}" must be $0.05–$${LIMITS.maxBid}`);
      });
      break;
    case 'set_keyword_bid':
      need(isId(c.adGroupId) && isId(c.criterionId), 'adGroupId and criterionId must be numeric');
      need(c.cpcBid >= 0.05 && c.cpcBid <= LIMITS.maxBid, `Bid must be $0.05–$${LIMITS.maxBid}`);
      break;
    case 'set_keyword_status':
      need(isId(c.adGroupId) && isId(c.criterionId), 'adGroupId and criterionId must be numeric');
      need(c.status === 'ENABLED' || c.status === 'PAUSED', 'status must be ENABLED or PAUSED');
      break;
    case 'set_ad_group_bid':
      need(isId(c.adGroupId), 'adGroupId must be numeric');
      need(c.cpcBid >= 0.05 && c.cpcBid <= LIMITS.maxBid, `Bid must be $0.05–$${LIMITS.maxBid}`);
      break;
    case 'set_campaign_budget':
      need(isId(c.campaignId), 'campaignId must be numeric');
      need(c.dailyBudget >= 1 && c.dailyBudget <= LIMITS.maxDailyBudget, `Daily budget must be $1–$${LIMITS.maxDailyBudget}`);
      break;
    case 'set_campaign_status':
      need(isId(c.campaignId), 'campaignId must be numeric');
      need(c.status === 'ENABLED' || c.status === 'PAUSED', 'status must be ENABLED or PAUSED');
      break;
    case 'set_bidding_strategy':
      need(isId(c.campaignId), 'campaignId must be numeric');
      if (c.strategy === 'TARGET_CPA') need(!!c.targetCpa && c.targetCpa > 0, 'TARGET_CPA needs targetCpa');
      if (c.strategy === 'TARGET_ROAS') need(!!c.targetRoas && c.targetRoas > 0 && c.targetRoas < 100, 'TARGET_ROAS needs targetRoas as a ratio, e.g. 4 for 400%');
      if (c.strategy === 'MAXIMIZE_CLICKS') need(!!c.maxCpc && c.maxCpc > 0, 'MAXIMIZE_CLICKS needs a maxCpc ceiling');
      need(['MANUAL_CPC', 'MAXIMIZE_CLICKS', 'MAXIMIZE_CONVERSIONS', 'TARGET_CPA', 'MAXIMIZE_CONVERSION_VALUE', 'TARGET_ROAS'].includes(c.strategy), 'Unknown strategy');
      break;
    case 'set_device_bid_adjustment':
      need(isId(c.campaignId), 'campaignId must be numeric');
      need(['MOBILE', 'DESKTOP', 'TABLET'].includes(c.device), 'device must be MOBILE, DESKTOP or TABLET');
      need(c.percent >= -100 && c.percent <= 900, 'percent must be between -100 (exclude) and +900');
      break;
    case 'add_ad_schedule':
      need(isId(c.campaignId), 'campaignId must be numeric');
      c.slots?.forEach((s) => {
        need(DAYS.includes(s.day), `day "${s.day}" is not valid`);
        need(Number.isInteger(s.startHour) && Number.isInteger(s.endHour) && s.startHour >= 0 && s.endHour <= 24 && s.startHour < s.endHour, 'hours must be whole numbers 0–24, start before end');
        if (s.percent !== undefined) need(s.percent >= -90 && s.percent <= 900, 'schedule adjustment must be -90 to +900%');
      });
      break;
    case 'create_responsive_search_ad':
      need(isId(c.adGroupId), 'adGroupId must be numeric');
      need(isUrl(c.finalUrl), 'finalUrl must be a full https:// URL');
      need(c.headlines?.length >= 3 && c.headlines.length <= 15, 'RSA needs 3–15 headlines');
      need(c.descriptions?.length >= 2 && c.descriptions.length <= 4, 'RSA needs 2–4 descriptions');
      c.headlines?.forEach((h) => len(h, LIMITS.headline, 'Headline'));
      c.descriptions?.forEach((d) => len(d, LIMITS.description, 'Description'));
      if (new Set(c.headlines?.map((h) => h.toLowerCase())).size !== c.headlines?.length) e.push('Headlines must all be different');
      if (c.path1) len(c.path1, LIMITS.path, 'Path 1');
      if (c.path2) len(c.path2, LIMITS.path, 'Path 2');
      break;
    case 'add_callouts':
      need(isId(c.campaignId), 'campaignId must be numeric');
      need(c.callouts?.length >= 1 && c.callouts.length <= 20, '1–20 callouts');
      c.callouts?.forEach((t) => len(t, LIMITS.callout, 'Callout'));
      break;
    case 'add_sitelinks':
      need(isId(c.campaignId), 'campaignId must be numeric');
      need(c.sitelinks?.length >= 1 && c.sitelinks.length <= 20, '1–20 sitelinks');
      c.sitelinks?.forEach((s) => {
        len(s.text, LIMITS.sitelinkText, 'Sitelink text');
        if (s.description1 || s.description2) {
          need(!!s.description1 && !!s.description2, `Sitelink "${s.text}" needs both descriptions or neither`);
          if (s.description1) len(s.description1, LIMITS.sitelinkDesc, 'Sitelink description');
          if (s.description2) len(s.description2, LIMITS.sitelinkDesc, 'Sitelink description');
        }
        need(isUrl(s.finalUrl), `Sitelink "${s.text}" needs a full URL`);
      });
      break;
    case 'add_structured_snippet':
      need(isId(c.campaignId), 'campaignId must be numeric');
      need(SNIPPET_HEADERS.includes(c.header), `header must be one of: ${SNIPPET_HEADERS.join(', ')}`);
      need(c.values?.length >= 3 && c.values.length <= 10, 'structured snippet needs 3–10 values');
      c.values?.forEach((v) => len(v, LIMITS.snippetValue, 'Snippet value'));
      break;
    default:
      e.push(`Unknown change kind "${(c as any).kind}"`);
  }
  return e;
}

/** One-line, plain-English description for approval cards and the log. */
export function describeChange(c: Change): string {
  const $ = (n: number) => '$' + n.toFixed(2);
  switch (c.kind) {
    case 'add_negative_keywords': return `Block ${c.keywords.length} search${c.keywords.length === 1 ? '' : 'es'}: ${c.keywords.slice(0, 4).map((k) => `"${k.text}"`).join(', ')}${c.keywords.length > 4 ? '…' : ''}`;
    case 'add_keywords': return `Add ${c.keywords.length} keyword${c.keywords.length === 1 ? '' : 's'}: ${c.keywords.slice(0, 4).map((k) => `"${k.text}" [${k.matchType.toLowerCase()}]`).join(', ')}${c.keywords.length > 4 ? '…' : ''}`;
    case 'set_keyword_bid': return `Set bid on ${c.label ? `"${c.label}"` : 'keyword ' + c.criterionId} to ${$(c.cpcBid)}`;
    case 'set_keyword_status': return `${c.status === 'PAUSED' ? 'Pause' : 'Enable'} ${c.label ? `"${c.label}"` : 'keyword ' + c.criterionId}`;
    case 'set_ad_group_bid': return `Set ad group default bid to ${$(c.cpcBid)}`;
    case 'set_campaign_budget': return `Set daily budget to ${$(c.dailyBudget)}`;
    case 'set_campaign_status': return `${c.status === 'PAUSED' ? 'Pause' : 'Enable'} campaign`;
    case 'set_bidding_strategy': return `Switch bidding to ${c.strategy.replace(/_/g, ' ').toLowerCase()}${c.targetCpa ? ` at ${$(c.targetCpa)} CPA` : ''}${c.targetRoas ? ` at ${Math.round(c.targetRoas * 100)}% ROAS` : ''}${c.maxCpc ? ` with ${$(c.maxCpc)} max CPC` : ''}`;
    case 'set_device_bid_adjustment': return `${c.device.toLowerCase()} bids ${c.percent >= 0 ? '+' : ''}${c.percent}%`;
    case 'add_ad_schedule': return `Ad schedule: ${c.slots.length} time slot${c.slots.length === 1 ? '' : 's'}`;
    case 'create_responsive_search_ad': return `New responsive search ad (${c.headlines.length} headlines, ${c.descriptions.length} descriptions), created paused`;
    case 'add_callouts': return `Add callouts: ${c.callouts.join(' · ')}`;
    case 'add_sitelinks': return `Add sitelinks: ${c.sitelinks.map((s) => s.text).join(', ')}`;
    case 'add_structured_snippet': return `Add "${c.header}" snippet: ${c.values.join(', ')}`;
  }
}

/** Which way a change moves spend, so the UI can flag risk. */
export function spendDirection(c: Change): 'up' | 'down' | 'neutral' {
  if (c.kind === 'set_campaign_status' || c.kind === 'set_keyword_status') return c.status === 'PAUSED' ? 'down' : 'up';
  if (c.kind === 'add_negative_keywords') return 'down';
  if (c.kind === 'add_keywords') return 'up';
  if (c.kind === 'set_device_bid_adjustment') return c.percent > 0 ? 'up' : 'down';
  return 'neutral';
}
