import 'server-only';
import { adsFetch, search, micros, num, cleanId } from './client';
import { rangeDates } from '../dates';
import type { Account, AccountRef, CampaignRow, Channel, ClientAccount, DailyRow, LsaLead, RangeKey, Report, Totals } from './types';

// ---------------------------------------------------------------
// Live Google Ads reads. Each function is one or more GAQL queries
// (Google Ads Query Language — SQL for your ad account).
// ---------------------------------------------------------------

/** Accounts your login can open directly: usually your MCC(s). */
export async function listTopAccounts(): Promise<Account[]> {
  const data = await adsFetch('customers:listAccessibleCustomers', { method: 'GET' });
  const ids: string[] = (data.resourceNames || []).map((r: string) => r.split('/')[1]).slice(0, 40);
  const out = await Promise.all(ids.map(async (id) => {
    try {
      const [r] = await search({ customerId: id, loginCustomerId: id },
        'SELECT customer.id, customer.descriptive_name, customer.manager, customer.currency_code, customer.time_zone FROM customer LIMIT 1');
      const c = r?.customer;
      return c ? { id: String(c.id), name: c.descriptiveName || `Account ${id}`, isManager: !!c.manager,
        currency: c.currencyCode || 'USD', timeZone: c.timeZone } as Account : null;
    } catch {
      return null; // cancelled or inaccessible accounts are skipped
    }
  }));
  // A sub-account you also reach through your manager would show twice;
  // keep managers and true stand-alone accounts.
  return out.filter((a): a is Account => !!a).sort((a, b) => Number(b.isManager) - Number(a.isManager) || a.name.localeCompare(b.name));
}

/** Every active client account under a manager, at any depth. */
export async function listClients(managerId: string): Promise<ClientAccount[]> {
  const rows = await search({ customerId: managerId, loginCustomerId: managerId }, `
    SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager,
           customer_client.level, customer_client.currency_code, customer_client.time_zone,
           customer_client.status
    FROM customer_client
    WHERE customer_client.level >= 1 AND customer_client.manager = false
      AND customer_client.status = 'ENABLED'`);
  return rows.map((r: any) => ({
    id: String(r.customerClient.id),
    name: r.customerClient.descriptiveName || `Account ${r.customerClient.id}`,
    isManager: false,
    level: num(r.customerClient.level),
    currency: r.customerClient.currencyCode || 'USD',
    timeZone: r.customerClient.timeZone,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

const CHANNELS: Channel[] = ['SEARCH', 'LOCAL_SERVICES', 'PERFORMANCE_MAX', 'DISPLAY', 'VIDEO', 'DEMAND_GEN', 'SHOPPING'];
const channelOf = (t: string): Channel => (CHANNELS as string[]).includes(t) ? (t as Channel) : 'OTHER';
const share = (v: unknown) => (v === undefined || v === null ? null : Number(v));

function totalsOf(rows: Totals[]): Totals {
  return rows.reduce((a, r) => ({
    cost: a.cost + r.cost, clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions,
    conversions: a.conversions + r.conversions, value: a.value + r.value,
  }), { cost: 0, clicks: 0, impressions: 0, conversions: 0, value: 0 });
}
const metricsOf = (m: any): Totals => ({
  cost: micros(m?.costMicros), clicks: num(m?.clicks), impressions: num(m?.impressions),
  conversions: num(m?.conversions), value: num(m?.conversionsValue),
});

export async function getReport(ref: AccountRef, rangeKey: RangeKey): Promise<Report> {
  const [info] = await search(ref, 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1');
  const tz = info?.customer?.timeZone;
  const r = rangeDates(rangeKey, tz);
  const between = (a: string, b: string) => `segments.date BETWEEN '${a}' AND '${b}'`;
  const dailyQ = (a: string, b: string) => `SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions,
    metrics.conversions, metrics.conversions_value FROM customer WHERE ${between(a, b)}`;

  const [daily, prev, camps, leads] = await Promise.all([
    search(ref, dailyQ(r.start, r.end)),
    search(ref, dailyQ(r.prevStart, r.prevEnd)),
    search(ref, `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
        campaign.bidding_strategy_type, campaign_budget.amount_micros,
        metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions,
        metrics.conversions_value, metrics.search_impression_share,
        metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share
      FROM campaign WHERE ${between(r.start, r.end)} AND campaign.status != 'REMOVED'`),
    // Local Services leads. Accounts without LSA simply return nothing.
    search(ref, `SELECT local_services_lead.lead_type, local_services_lead.lead_status,
        local_services_lead.creation_date_time, local_services_lead.lead_charged,
        local_services_lead.category_id
      FROM local_services_lead
      WHERE local_services_lead.creation_date_time >= '${r.start} 00:00:00'
        AND local_services_lead.creation_date_time <= '${r.end} 23:59:59'`).catch(() => []),
  ]);

  const dailyRows: DailyRow[] = daily.map((x: any) => ({ date: x.segments.date, ...metricsOf(x.metrics) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const campaigns: CampaignRow[] = camps.map((x: any) => ({
    id: String(x.campaign.id),
    name: x.campaign.name,
    status: x.campaign.status,
    channel: channelOf(x.campaign.advertisingChannelType),
    biddingStrategy: x.campaign.biddingStrategyType || '',
    dailyBudget: micros(x.campaignBudget?.amountMicros),
    impressionShare: share(x.metrics?.searchImpressionShare),
    lostToBudget: share(x.metrics?.searchBudgetLostImpressionShare),
    lostToRank: share(x.metrics?.searchRankLostImpressionShare),
    ...metricsOf(x.metrics),
  })).sort((a, b) => b.cost - a.cost);

  const lsaLeads: LsaLead[] = leads.map((x: any) => ({
    type: x.localServicesLead?.leadType || 'UNKNOWN',
    status: x.localServicesLead?.leadStatus || 'UNKNOWN',
    createdAt: x.localServicesLead?.creationDateTime || '',
    charged: !!x.localServicesLead?.leadCharged,
    category: x.localServicesLead?.categoryId || '',
  }));

  return {
    account: { id: cleanId(ref.customerId), name: info?.customer?.descriptiveName || ref.customerId, currency: info?.customer?.currencyCode || 'USD' },
    range: { key: rangeKey, start: r.start, end: r.end },
    totals: totalsOf(dailyRows),
    previous: totalsOf(prev.map((x: any) => metricsOf(x.metrics))),
    daily: dailyRows,
    campaigns,
    lsaLeads,
    demo: false,
  };
}

/** Keyword discovery with real search volumes (Keyword Planner). */
export async function keywordIdeas(ref: AccountRef, opts: { seeds: string[]; url?: string; locationIds?: string[]; limit?: number }) {
  const seed = opts.url && opts.seeds.length
    ? { keywordAndUrlSeed: { url: opts.url, keywords: opts.seeds } }
    : opts.url ? { urlSeed: { url: opts.url } } : { keywordSeed: { keywords: opts.seeds } };
  const data = await adsFetch(`customers/${cleanId(ref.customerId)}:generateKeywordIdeas`, {
    loginCustomerId: ref.loginCustomerId,
    body: {
      language: 'languageConstants/1000', // English
      geoTargetConstants: (opts.locationIds?.length ? opts.locationIds : ['2840']).map((id) => `geoTargetConstants/${id}`),
      keywordPlanNetwork: 'GOOGLE_SEARCH',
      includeAdultKeywords: false,
      pageSize: Math.min(opts.limit || 50, 200),
      ...seed,
    },
  });
  return (data.results || []).map((r: any) => ({
    keyword: r.text,
    avgMonthlySearches: num(r.keywordIdeaMetrics?.avgMonthlySearches),
    competition: r.keywordIdeaMetrics?.competition || 'UNSPECIFIED',
    lowBid: micros(r.keywordIdeaMetrics?.lowTopOfPageBidMicros),
    highBid: micros(r.keywordIdeaMetrics?.highTopOfPageBidMicros),
  })).slice(0, opts.limit || 50);
}

/** Turns place names ("Murrieta, CA") into Google location IDs. */
export async function suggestLocations(names: string[]) {
  const data = await adsFetch('geoTargetConstants:suggest', {
    body: { locale: 'en', countryCode: 'US', locationNames: { names } },
  });
  return (data.geoTargetConstantSuggestions || []).map((s: any) => ({
    id: String(s.geoTargetConstant?.id),
    name: s.geoTargetConstant?.canonicalName,
    type: s.geoTargetConstant?.targetType,
  }));
}

/** Keyword performance for the agent (last 30 days by default). */
export async function getKeywords(ref: AccountRef, opts: { campaignId?: string; days?: number } = {}) {
  const r = rangeDates(opts.days === 90 ? 'LAST_90_DAYS' : opts.days === 7 ? 'LAST_7_DAYS' : 'LAST_30_DAYS');
  const rows = await search(ref, `SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
      ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
      ad_group_criterion.status, ad_group_criterion.cpc_bid_micros, ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.quality_info.creative_quality_score, ad_group_criterion.quality_info.post_click_quality_score,
      ad_group_criterion.quality_info.search_predicted_ctr,
      metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions,
      metrics.search_rank_lost_impression_share
    FROM keyword_view
    WHERE segments.date BETWEEN '${r.start}' AND '${r.end}' AND ad_group_criterion.status != 'REMOVED'
      ${opts.campaignId ? `AND campaign.id = ${cleanId(opts.campaignId)}` : ''}
    ORDER BY metrics.cost_micros DESC LIMIT 300`);
  return rows.map((x: any) => ({
    campaignId: String(x.campaign.id), campaign: x.campaign.name, adGroupId: String(x.adGroup.id), adGroup: x.adGroup.name,
    criterionId: String(x.adGroupCriterion.criterionId), keyword: x.adGroupCriterion.keyword?.text,
    matchType: x.adGroupCriterion.keyword?.matchType, status: x.adGroupCriterion.status,
    cpcBid: x.adGroupCriterion.cpcBidMicros ? micros(x.adGroupCriterion.cpcBidMicros) : null,
    qualityScore: x.adGroupCriterion.qualityInfo?.qualityScore ?? null,
    qsParts: x.adGroupCriterion.qualityInfo ? {
      expectedCtr: x.adGroupCriterion.qualityInfo.searchPredictedCtr, adRelevance: x.adGroupCriterion.qualityInfo.creativeQualityScore,
      landingPage: x.adGroupCriterion.qualityInfo.postClickQualityScore } : null,
    clicks: num(x.metrics.clicks), impressions: num(x.metrics.impressions), cost: micros(x.metrics.costMicros),
    conversions: num(x.metrics.conversions), lostToRank: x.metrics.searchRankLostImpressionShare ?? null,
  }));
}

/** What people actually typed (last 30 days). */
export async function getSearchTerms(ref: AccountRef, opts: { campaignId?: string } = {}) {
  const r = rangeDates('LAST_30_DAYS');
  const rows = await search(ref, `SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
      search_term_view.search_term, search_term_view.status, segments.keyword.info.text,
      metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM search_term_view
    WHERE segments.date BETWEEN '${r.start}' AND '${r.end}' AND metrics.clicks > 0
      ${opts.campaignId ? `AND campaign.id = ${cleanId(opts.campaignId)}` : ''}
    ORDER BY metrics.cost_micros DESC LIMIT 400`);
  return rows.map((x: any) => ({
    campaignId: String(x.campaign.id), campaign: x.campaign.name, adGroupId: String(x.adGroup.id), adGroup: x.adGroup.name,
    searchTerm: x.searchTermView.searchTerm, status: x.searchTermView.status, matchedKeyword: x.segments?.keyword?.info?.text,
    clicks: num(x.metrics.clicks), cost: micros(x.metrics.costMicros), conversions: num(x.metrics.conversions),
  }));
}

/** Free-form read-only query for anything the fixed tools don't cover. */
export async function readQuery(ref: AccountRef, gaql: string) {
  const q = gaql.trim();
  if (!/^select\s/i.test(q) || /;|\b(mutate|create|remove|update)\b\s*\(/i.test(q)) throw new Error('Only SELECT queries are allowed.');
  const rows = await search(ref, q, 500);
  return rows.slice(0, 200);
}
