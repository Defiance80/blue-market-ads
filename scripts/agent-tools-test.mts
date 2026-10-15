// Exercises every agent tool against demo data (no API keys needed).
// Run: node --conditions=react-server --import tsx scripts/agent-tools-test.mts
import assert from 'node:assert';
import { runTool, TOOLS } from '../lib/agent/tools.ts';

const events: any[] = [];
const ctx = { ref: { customerId: '1029384756', loginCustomerId: '4815162342' }, accountName: 'Harbor Periodontics', user: 'test@x.com', emit: (e: any) => events.push(e) };

const perf: any = await runTool('get_performance', { range: 'LAST_30_DAYS' }, ctx);
assert(perf.campaigns.length === 4 && perf.totals.cost > 0 && perf.lsa.total > 0);
console.log('get_performance ok:', perf.campaigns.map((c: any) => `${c.name} $${c.cost} cpa ${c.cpa}`).join(' | '));

const kws: any = await runTool('get_keywords', {}, ctx);
assert(kws.length > 5 && kws[0].criterionId);
const terms: any = await runTool('get_search_terms', { campaignId: '21001' }, ctx);
assert(terms.some((t: any) => / (jobs|salary|free|diy|school|reddit|cheap|how to)$/.test(t.searchTerm)));
const ideas: any = await runTool('keyword_ideas', { seeds: ['dental implants'], locations: ['Charleston, South Carolina'] }, ctx);
assert(ideas.length > 5 && ideas[0].avgMonthlySearches > 0);
console.log('reads ok:', kws.length, 'keywords,', terms.length, 'search terms,', ideas.length, 'ideas');

await runTool('save_strategy_profile', { business: 'Periodontal practice', targetCpa: 300, rules: 'Never bid on competitor names' }, ctx);
assert(events.some((e) => e.type === 'profile' && e.profile.targetCpa === 300));

// Valid proposal
await runTool('propose_changes', { title: 'Block job seekers', rationale: 'x', changes: [
  { kind: 'add_negative_keywords', campaignId: '21001', keywords: [{ text: 'dental implants jobs', matchType: 'PHRASE' }] },
  { kind: 'create_responsive_search_ad', adGroupId: '31001', finalUrl: 'https://harborperio.example.com/implants',
    headlines: ['Dental Implants in Charleston', 'Board-Certified Periodontist', 'Book a Free Consultation'], descriptions: ['Permanent, natural-looking implants placed by a specialist. Book your consult today.', 'Financing available. Same-week appointments for new patients.'] },
] }, ctx);
const prop = events.find((e) => e.type === 'proposal');
assert(prop && prop.proposal.changes[0].direction === 'down');
console.log('proposal ok:', prop.proposal.changes.map((c: any) => c.summary).join(' | '));

// Invalid proposal must be rejected with readable reasons
await assert.rejects(() => runTool('propose_changes', { title: 't', rationale: 'r', changes: [
  { kind: 'create_responsive_search_ad', adGroupId: '31001', finalUrl: 'not a url', headlines: ['This headline is definitely far too long for Google'], descriptions: ['ok'] },
  { kind: 'add_callouts', campaignId: 'abc', callouts: ['A callout that is way past twenty-five chars'] },
] }, ctx), (e: any) => { console.log('validation ok:\n  ' + e.message.split('\n').slice(1).join('\n  ')); return true; });

// Custom GAQL is refused in demo mode, and n8n reports it is not connected
await assert.rejects(() => runTool('run_query', { gaql: 'SELECT campaign.id FROM campaign' }, ctx));
await assert.rejects(() => runTool('run_automation', { workflow: 'optimizer' }, ctx));
console.log(`all ${TOOLS.length} tools exercised — PASS`);
