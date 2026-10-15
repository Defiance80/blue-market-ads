import 'server-only';
import { adsFetch, search, toMicros, cleanId } from './client';
import { describeChange, validateChange, type Change } from './changes';
import type { AccountRef } from './types';

// Turns validated changes into ONE googleAds:mutate request.
// WHY one request: Google applies it as a batch, and `partialFailure`
// means one bad change doesn't block the good ones. `validateOnly`
// makes Google check everything without changing anything.

export type ChangeResult = { index: number; summary: string; ok: boolean; message: string };

const DEVICE_CRITERION: Record<string, string> = { DESKTOP: '30000', MOBILE: '30001', TABLET: '30002' };

export async function applyChangesLive(ref: AccountRef, changes: Change[], validateOnly: boolean): Promise<ChangeResult[]> {
  const cid = cleanId(ref.customerId);
  const C = `customers/${cid}`;
  const ops: any[] = [];
  const owner: number[] = [];          // which change produced each operation
  const results: ChangeResult[] = [];
  let temp = -1;                       // temporary IDs link a new asset to its campaign in one request

  // Look up campaign budgets once, for any budget changes.
  const budgetIds = changes.filter((c) => c.kind === 'set_campaign_budget').map((c: any) => cleanId(c.campaignId));
  const budgets: Record<string, { res: string; shared: boolean }> = {};
  if (budgetIds.length) {
    const rows = await search(ref, `SELECT campaign.id, campaign_budget.resource_name, campaign_budget.explicitly_shared
      FROM campaign WHERE campaign.id IN (${budgetIds.join(',')})`);
    for (const r of rows) budgets[String(r.campaign.id)] = { res: r.campaignBudget.resourceName, shared: !!r.campaignBudget.explicitlyShared };
  }

  changes.forEach((c, i) => {
    const problems = validateChange(c);
    if (problems.length) { results.push({ index: i, summary: describeChange(c), ok: false, message: problems.join('; ') }); return; }
    const push = (op: any) => { ops.push(op); owner.push(i); };
    const camp = (id: string) => `${C}/campaigns/${cleanId(id)}`;

    switch (c.kind) {
      case 'add_negative_keywords':
        c.keywords.forEach((k) => push({ campaignCriterionOperation: { create: { campaign: camp(c.campaignId), negative: true, keyword: { text: k.text.trim().toLowerCase(), matchType: k.matchType } } } }));
        break;
      case 'add_keywords':
        c.keywords.forEach((k) => push({ adGroupCriterionOperation: { create: {
          adGroup: `${C}/adGroups/${cleanId(c.adGroupId)}`, status: 'ENABLED',
          keyword: { text: k.text.trim().toLowerCase(), matchType: k.matchType },
          ...(k.cpcBid ? { cpcBidMicros: toMicros(k.cpcBid) } : {}),
        } } }));
        break;
      case 'set_keyword_bid':
        push({ adGroupCriterionOperation: { update: { resourceName: `${C}/adGroupCriteria/${cleanId(c.adGroupId)}~${cleanId(c.criterionId)}`, cpcBidMicros: toMicros(c.cpcBid) }, updateMask: 'cpcBidMicros' } });
        break;
      case 'set_keyword_status':
        push({ adGroupCriterionOperation: { update: { resourceName: `${C}/adGroupCriteria/${cleanId(c.adGroupId)}~${cleanId(c.criterionId)}`, status: c.status }, updateMask: 'status' } });
        break;
      case 'set_ad_group_bid':
        push({ adGroupOperation: { update: { resourceName: `${C}/adGroups/${cleanId(c.adGroupId)}`, cpcBidMicros: toMicros(c.cpcBid) }, updateMask: 'cpcBidMicros' } });
        break;
      case 'set_campaign_budget': {
        const b = budgets[cleanId(c.campaignId)];
        if (!b) { results.push({ index: i, summary: describeChange(c), ok: false, message: 'Campaign not found in this account' }); return; }
        push({ campaignBudgetOperation: { update: { resourceName: b.res, amountMicros: toMicros(c.dailyBudget) }, updateMask: 'amountMicros' } });
        break;
      }
      case 'set_campaign_status':
        push({ campaignOperation: { update: { resourceName: camp(c.campaignId), status: c.status }, updateMask: 'status' } });
        break;
      case 'set_bidding_strategy': {
        const res = camp(c.campaignId);
        const map: Record<string, [any, string]> = {
          MANUAL_CPC: [{ manualCpc: { enhancedCpcEnabled: false } }, 'manualCpc.enhancedCpcEnabled'],
          MAXIMIZE_CLICKS: [{ targetSpend: { cpcBidCeilingMicros: toMicros(c.maxCpc || 0) } }, 'targetSpend.cpcBidCeilingMicros'],
          MAXIMIZE_CONVERSIONS: [{ maximizeConversions: { targetCpaMicros: '0' } }, 'maximizeConversions.targetCpaMicros'],
          TARGET_CPA: [{ maximizeConversions: { targetCpaMicros: toMicros(c.targetCpa || 0) } }, 'maximizeConversions.targetCpaMicros'],
          MAXIMIZE_CONVERSION_VALUE: [{ maximizeConversionValue: { targetRoas: 0 } }, 'maximizeConversionValue.targetRoas'],
          TARGET_ROAS: [{ maximizeConversionValue: { targetRoas: c.targetRoas } }, 'maximizeConversionValue.targetRoas'],
        };
        const [fields, mask] = map[c.strategy];
        push({ campaignOperation: { update: { resourceName: res, ...fields }, updateMask: mask } });
        break;
      }
      case 'set_device_bid_adjustment':
        push({ campaignCriterionOperation: { update: {
          resourceName: `${C}/campaignCriteria/${cleanId(c.campaignId)}~${DEVICE_CRITERION[c.device]}`,
          bidModifier: c.percent === -100 ? 0 : 1 + c.percent / 100,
        }, updateMask: 'bidModifier' } });
        break;
      case 'add_ad_schedule':
        c.slots.forEach((s) => push({ campaignCriterionOperation: { create: {
          campaign: camp(c.campaignId),
          adSchedule: { dayOfWeek: s.day, startHour: s.startHour, startMinute: 'ZERO', endHour: s.endHour, endMinute: 'ZERO' },
          ...(s.percent !== undefined ? { bidModifier: 1 + s.percent / 100 } : {}),
        } } }));
        break;
      case 'create_responsive_search_ad':
        // Created PAUSED so a human sees it in the account before it runs.
        push({ adGroupAdOperation: { create: {
          adGroup: `${C}/adGroups/${cleanId(c.adGroupId)}`, status: 'PAUSED',
          ad: { finalUrls: [c.finalUrl], responsiveSearchAd: {
            headlines: c.headlines.map((text) => ({ text })), descriptions: c.descriptions.map((text) => ({ text })),
            ...(c.path1 ? { path1: c.path1 } : {}), ...(c.path2 ? { path2: c.path2 } : {}),
          } },
        } } });
        break;
      case 'add_callouts':
        c.callouts.forEach((text) => {
          const asset = `${C}/assets/${temp--}`;
          push({ assetOperation: { create: { resourceName: asset, calloutAsset: { calloutText: text } } } });
          push({ campaignAssetOperation: { create: { campaign: camp(c.campaignId), asset, fieldType: 'CALLOUT' } } });
        });
        break;
      case 'add_sitelinks':
        c.sitelinks.forEach((s) => {
          const asset = `${C}/assets/${temp--}`;
          push({ assetOperation: { create: { resourceName: asset, finalUrls: [s.finalUrl], sitelinkAsset: {
            linkText: s.text, ...(s.description1 ? { description1: s.description1, description2: s.description2 } : {}) } } } });
          push({ campaignAssetOperation: { create: { campaign: camp(c.campaignId), asset, fieldType: 'SITELINK' } } });
        });
        break;
      case 'add_structured_snippet': {
        const asset = `${C}/assets/${temp--}`;
        push({ assetOperation: { create: { resourceName: asset, structuredSnippetAsset: { header: c.header, values: c.values } } } });
        push({ campaignAssetOperation: { create: { campaign: camp(c.campaignId), asset, fieldType: 'STRUCTURED_SNIPPET' } } });
        break;
      }
    }
  });

  if (ops.length) {
    // Collect per-operation failures from the partial-failure report.
    const failed: Record<number, string> = {};
    let fatal = '';
    try {
      const data = await adsFetch(`customers/${cid}/googleAds:mutate`, {
        loginCustomerId: ref.loginCustomerId,
        body: { mutateOperations: ops, partialFailure: true, validateOnly },
      });
      for (const d of data.partialFailureError?.details || []) {
        for (const err of d.errors || []) {
          const idx = Number(err.location?.fieldPathElements?.find((f: any) => (f.fieldName === 'mutate_operations' || f.fieldName === 'mutateOperations'))?.index ?? -1);
          if (idx >= 0) failed[idx] = err.message;
        }
      }
    } catch (e: any) {
      fatal = e.message || 'Google Ads rejected the request';
    }
    const done = new Set(results.map((r) => r.index));
    changes.forEach((c, i) => {
      if (done.has(i)) return;
      const myOps = owner.map((o, k) => (o === i ? k : -1)).filter((k) => k >= 0);
      const errs = myOps.map((k) => failed[k]).filter(Boolean);
      results.push({
        index: i, summary: describeChange(c),
        ok: !fatal && errs.length === 0,
        message: fatal || (errs.length ? errs.join('; ') : validateOnly ? 'Checked by Google. Not applied (test mode).' : 'Applied'),
      });
    });
  }
  return results.sort((a, b) => a.index - b.index);
}
