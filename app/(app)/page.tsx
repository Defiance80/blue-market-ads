'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, MessagesSquare, RefreshCw } from 'lucide-react';
import { useAccount, fmtId } from '@/components/app/AccountContext';
import { TrendChart, Donut, CampaignBars, Spark, type Slice } from '@/components/app/charts';
import { CHANNEL_LABEL, type Report, type Channel } from '@/lib/ads/types';
import { CHANNEL_COLOR, SERIES, STRATEGY_LABEL, dec, delta, int, money, moneyAuto, pct, ratio, shortDate } from '@/lib/format';

export default function OverviewPage() {
  const { active, range, loading: acctLoading, top } = useAccount();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetCpa, setTargetCpa] = useState<number | undefined>();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const q = new URLSearchParams({ customerId: active.customerId, loginCustomerId: active.loginCustomerId, range });
    setLoading(true);
    setError('');
    let live = true;
    fetch(`/api/report?${q}`).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not load the report');
      if (live) setReport(d);
    }).catch((e) => live && setError(e.message)).finally(() => live && setLoading(false));
    fetch(`/api/profile?customerId=${active.customerId}`).then((r) => r.json()).then((d) => live && setTargetCpa(d.profile?.targetCpa)).catch(() => {});
    return () => { live = false; };
  }, [active?.customerId, active?.loginCustomerId, range, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) {
    return <Empty title={acctLoading ? 'Loading accounts' : top?.isManager ? 'Choose a client account' : 'No accounts yet'}
      body={top?.isManager ? 'Manager accounts hold no campaigns of their own. Pick a client in the second dropdown.' : 'Accounts appear here once Google Ads is connected.'} />;
  }
  if (error) return <Empty title="This report didn't load" body={error} action={<button className="btn btn-quiet" onClick={() => setTick(tick + 1)}><RefreshCw size={15} /> Try again</button>} />;
  if (!report) return <Skeleton />;

  return <Dashboard report={report} loading={loading} targetCpa={targetCpa} currency={active.currency} />;
}

function Dashboard({ report, loading, targetCpa, currency }: { report: Report; loading: boolean; targetCpa?: number; currency: string }) {
  const t = report.totals, p = report.previous;
  const campColor = useMemo(() => Object.fromEntries(report.campaigns.map((c, i) => [c.id, SERIES[i % SERIES.length]])), [report]);

  const spendSlices: Slice[] = report.campaigns.filter((c) => c.cost > 0)
    .map((c) => ({ id: c.id, name: c.name, value: c.cost, color: campColor[c.id] }));
  const channelSlices: Slice[] = Object.entries(report.campaigns.reduce((a: Record<string, number>, c) => ((a[c.channel] = (a[c.channel] || 0) + c.cost), a), {}))
    .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ id: k, name: CHANNEL_LABEL[k as Channel] || k, value: v, color: CHANNEL_COLOR[k] || '#8b98a9' }));

  const cpa = ratio(t.cost, t.conversions), prevCpa = ratio(p.cost, p.conversions);
  const kpis = [
    { label: 'Spend', value: money(t.cost, currency), d: delta(t.cost, p.cost), good: 'none' as const, spark: report.daily.map((x) => x.cost) },
    { label: 'Conversions', value: dec(t.conversions), d: delta(t.conversions, p.conversions), good: 'up' as const, spark: report.daily.map((x) => x.conversions) },
    { label: 'Cost per conversion', value: t.conversions ? moneyAuto(cpa, currency) : '—', d: prevCpa && cpa ? delta(cpa, prevCpa) : null, good: 'down' as const,
      spark: report.daily.map((x) => (x.conversions ? x.cost / x.conversions : 0)), note: targetCpa ? `Target ${money(targetCpa, currency)}` : undefined, warn: !!(targetCpa && cpa > targetCpa) },
    { label: 'Conversion rate', value: pct(ratio(t.conversions, t.clicks)), d: delta(ratio(t.conversions, t.clicks), ratio(p.conversions, p.clicks)), good: 'up' as const, spark: report.daily.map((x) => ratio(x.conversions, x.clicks)) },
    { label: 'Click-through rate', value: pct(ratio(t.clicks, t.impressions)), d: delta(ratio(t.clicks, t.impressions), ratio(p.clicks, p.impressions)), good: 'up' as const, spark: report.daily.map((x) => ratio(x.clicks, x.impressions)) },
    { label: 'Avg. cost per click', value: moneyAuto(ratio(t.cost, t.clicks), currency), d: delta(ratio(t.cost, t.clicks), ratio(p.cost, p.clicks)), good: 'down' as const, spark: report.daily.map((x) => ratio(x.cost, x.clicks)) },
  ];

  const lsa = report.lsaLeads;
  const lsaTypes = Object.entries(lsa.reduce((a: Record<string, number>, l) => ((a[l.type] = (a[l.type] || 0) + 1), a), {}));
  const LSA_COLOR: Record<string, string> = { PHONE_CALL: '#b8862b', MESSAGE: '#1f5fad', BOOKING: '#2e7d5b' };
  const LSA_LABEL: Record<string, string> = { PHONE_CALL: 'Phone calls', MESSAGE: 'Messages', BOOKING: 'Bookings' };

  return (
    <div className={clsx('mx-auto max-w-[1360px] space-y-6 transition-opacity', loading && 'opacity-60')}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-title text-[26px] leading-tight">{report.account.name}</h1>
          <p className="mt-1 text-ink-3 tnum">{shortDate(report.range.start)} to {shortDate(report.range.end)}, compared with the previous {report.daily.length} days. Account {fmtId(report.account.id)}.</p>
        </div>
        <Link href="/strategist" className="btn btn-primary"><MessagesSquare size={16} /> Ask the strategist</Link>
      </div>

      {/* KPI strip: one surface, figures in condensed type */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line md:grid-cols-3 xl:grid-cols-6" aria-label="Key metrics">
        {kpis.map((k, i) => (
          <div key={k.label} className="bg-white px-5 pb-3 pt-4">
            <div className="text-[12.5px] font-[540] text-ink-3">{k.label}</div>
            <div className={clsx('t-figure mt-1 text-[30px] leading-none', k.warn && 'text-bad')}>{k.value}</div>
            <div className="mt-2 flex items-center gap-2 text-[12px]">
              <DeltaTag d={k.d} good={k.good} />
              {k.note && <span className="text-ink-3">{k.note}</span>}
            </div>
            <div className="mt-2"><Spark values={k.spark} color={k.warn ? '#b4442e' : i === 1 ? '#b8862b' : '#1f5fad'} /></div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Spend and conversions by day" note={<Legend items={[['#a9c4e2', 'Spend'], ['#b8862b', 'Conversions']]} />}>
          <TrendChart data={report.daily} currency={currency} />
        </Panel>
        <Panel title="Where the money went">
          {spendSlices.length ? <Donut slices={spendSlices} center={{ value: money(t.cost, currency), label: 'total spend' }} format={(n) => money(n, currency)} />
            : <p className="py-10 text-center text-ink-3">No spend in this range.</p>}
        </Panel>
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Conversions by campaign" note={<span className="text-[12px] text-ink-3">Label shows conversions · cost per conversion{targetCpa ? '. Red is over target.' : ''}</span>}>
          <CampaignBars rows={report.campaigns.map((c) => ({ ...c, color: campColor[c.id] }))} currency={currency} targetCpa={targetCpa} />
        </Panel>
        <div className="grid gap-6">
          <Panel title="Spend by channel">
            <Donut slices={channelSlices} center={{ value: String(channelSlices.length), label: channelSlices.length === 1 ? 'channel' : 'channels' }} format={(n) => money(n, currency)} />
          </Panel>
          {lsa.length > 0 && (
            <Panel title="Local Services leads" note={<span className="text-[12px] text-ink-3 tnum">{lsa.filter((l) => l.charged).length} charged · {lsa.filter((l) => l.status === 'BOOKED').length} booked</span>}>
              <Donut slices={lsaTypes.map(([k, v]) => ({ id: k, name: LSA_LABEL[k] || k, value: v, color: LSA_COLOR[k] || '#8b98a9' }))}
                center={{ value: int(lsa.length), label: 'leads' }} format={int} />
            </Panel>
          )}
        </div>
      </section>

      <Panel title="Campaigns" pad={false} note={<span className="text-[12px] text-ink-3">{report.campaigns.length} campaigns, sorted by spend</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-[13px]">
            <thead>
              <tr className="border-y border-line bg-paper text-left text-[12px] text-ink-3">
                {['Campaign', 'Bidding', 'Budget / day', 'Spend', 'Clicks', 'CTR', 'Conv.', 'Cost / conv.', 'Impr. share', 'Lost to budget'].map((h, i) => (
                  <th key={h} className={clsx('px-4 py-2.5 font-[560]', i > 1 && 'text-right')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.campaigns.map((c) => {
                const ccpa = c.conversions ? c.cost / c.conversions : null;
                return (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-paper/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: campColor[c.id] }} />
                        <span className="font-[560] text-ink">{c.name}</span>
                        {c.status !== 'ENABLED' && <span className="chip bg-paper text-ink-3">{c.status.toLowerCase()}</span>}
                      </div>
                      <div className="ml-5 mt-0.5 text-[12px] text-ink-3">{CHANNEL_LABEL[c.channel]}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{STRATEGY_LABEL[c.biddingStrategy] || c.biddingStrategy.toLowerCase().replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-right tnum">{money(c.dailyBudget, currency)}</td>
                    <td className="px-4 py-3 text-right font-[560] tnum">{money(c.cost, currency)}</td>
                    <td className="px-4 py-3 text-right tnum">{int(c.clicks)}</td>
                    <td className="px-4 py-3 text-right tnum">{pct(ratio(c.clicks, c.impressions))}</td>
                    <td className="px-4 py-3 text-right tnum">{dec(c.conversions)}</td>
                    <td className={clsx('px-4 py-3 text-right font-[560] tnum', targetCpa && ccpa && ccpa > targetCpa ? 'text-bad' : targetCpa && ccpa ? 'text-good' : '')}>
                      {ccpa ? moneyAuto(ccpa, currency) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tnum">{pct(c.impressionShare, 0)}</td>
                    <td className={clsx('px-4 py-3 text-right tnum', (c.lostToBudget || 0) > 0.15 && 'font-[560] text-brass')}>{pct(c.lostToBudget, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function DeltaTag({ d, good }: { d: number | null; good: 'up' | 'down' | 'none' }) {
  if (d === null || !isFinite(d)) return <span className="text-ink-3">no prior data</span>;
  const up = d >= 0;
  const tone = good === 'none' || Math.abs(d) < 0.005 ? 'text-ink-3' : (up === (good === 'up')) ? 'text-good' : 'text-bad';
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return <span className={clsx('inline-flex items-center gap-0.5 font-[600] tnum', tone)}><Icon size={14} />{pct(Math.abs(d))}</span>;
}

function Panel({ title, note, children, pad = true }: { title: string; note?: React.ReactNode; children: React.ReactNode; pad?: boolean }) {
  return (
    <section className="panel">
      <header className={clsx('flex flex-wrap items-center justify-between gap-2 px-5 pt-4', pad ? 'pb-2' : 'pb-3')}>
        <h2 className="t-title text-[15px]">{title}</h2>
        {note}
      </header>
      <div className={pad ? 'px-5 pb-5' : ''}>{children}</div>
    </section>
  );
}

const Legend = ({ items }: { items: [string, string][] }) => (
  <span className="flex gap-4 text-[12px] text-ink-3">
    {items.map(([c, l]) => <span key={l} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>)}
  </span>
);

function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <h1 className="t-title text-[20px]">{title}</h1>
      <p className="mt-2 text-ink-3">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1360px] animate-pulse space-y-6" aria-busy>
      <div className="h-8 w-72 rounded bg-mist" />
      <div className="h-[132px] rounded-[10px] bg-mist/70" />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]"><div className="h-[320px] rounded-[10px] bg-mist/70" /><div className="h-[320px] rounded-[10px] bg-mist/70" /></div>
    </div>
  );
}
