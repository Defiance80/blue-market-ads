'use client';

import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compact, dec, money, moneyAuto, pct, shortDate } from '@/lib/format';
import type { DailyRow } from '@/lib/ads/types';

// All charts share the same axis, grid and tooltip styling so the page
// reads as one system. Colours come from lib/format (SERIES, CHANNEL_COLOR).

const AXIS = { fontSize: 11.5, fill: '#6b7a8e' };
const GRID = '#e8eef5';

function Tip({ active, payload, label, render, labelFmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[8px] border border-line bg-white px-3 py-2 text-[12.5px] shadow-[0_8px_24px_-12px_rgba(16,41,74,.35)]">
      {label && labelFmt && <div className="mb-1 font-[600] text-ink">{labelFmt(label)}</div>}
      {render(payload)}
    </div>
  );
}
const Row = ({ color, name, value }: { color: string; name: string; value: string }) => (
  <div className="flex items-center gap-2 tnum">
    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    <span className="text-ink-2">{name}</span>
    <span className="ml-auto pl-4 font-[600] text-ink">{value}</span>
  </div>
);

/** Spend as bars, conversions as a line, on two axes. */
export function TrendChart({ data, currency }: { data: DailyRow[]; currency: string }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -6, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis yAxisId="cost" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => '$' + compact(v)} width={52} />
        <YAxis yAxisId="conv" orientation="right" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
        <Tooltip cursor={{ fill: '#1f5fad0d' }} content={<Tip labelFmt={shortDate} render={(p: any[]) => (<>
          <Row color="#a9c4e2" name="Spend" value={money(p.find((x) => x.dataKey === 'cost')?.value, currency, true)} />
          <Row color="#b8862b" name="Conversions" value={dec(p.find((x) => x.dataKey === 'conversions')?.value)} />
        </>)} />} />
        <Bar yAxisId="cost" dataKey="cost" fill="#a9c4e2" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        <Line yAxisId="conv" dataKey="conversions" stroke="#b8862b" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} type="monotone" isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export type Slice = { id: string; name: string; value: number; color: string };

/** Donut with the share and value listed beside it (the list is the legend). */
export function Donut({ slices, center, format }: { slices: Slice[]; center: { value: string; label: string }; format: (n: number) => string }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-[176px] w-[176px] shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={1.5} stroke="none" isAnimationActive={false}>
              {slices.map((s) => <Cell key={s.id} fill={s.color} />)}
            </Pie>
            <Tooltip content={<Tip render={(p: any[]) => <Row color={p[0].payload.color} name={p[0].name} value={`${format(p[0].value)} · ${pct(p[0].value / total)}`} />} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="t-figure text-[22px] leading-none">{center.value}</div>
            <div className="mt-1 text-[11.5px] text-ink-3">{center.label}</div>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {slices.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-2" title={s.name}>{s.name}</span>
            <span className="tnum text-ink-3">{pct(total ? s.value / total : 0, 0)}</span>
            <span className="w-[72px] text-right font-[600] tnum">{format(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Conversions per campaign, horizontal bars in each campaign's colour, CPA beside. */
export function CampaignBars({ rows, currency, targetCpa }: {
  rows: { id: string; name: string; conversions: number; cost: number; color: string }[]; currency: string; targetCpa?: number;
}) {
  const data = rows.filter((r) => r.cost > 0).slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40 + 20)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 76, left: 0, bottom: 0 }} barCategoryGap={10}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={150} tick={{ ...AXIS, fill: '#3c4d63' }} axisLine={false} tickLine={false}
          tickFormatter={(v: string) => (v.length > 21 ? v.slice(0, 20) + '…' : v)} />
        <Tooltip cursor={{ fill: '#1f5fad0d' }} content={<Tip labelFmt={(l: string) => l} render={(p: any[]) => {
          const r = p[0].payload;
          return (<><Row color={r.color} name="Conversions" value={dec(r.conversions)} />
            <Row color="transparent" name="Cost / conv." value={r.conversions ? moneyAuto(r.cost / r.conversions, currency) : '—'} /></>);
        }} />} />
        <Bar dataKey="conversions" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}
          label={({ x, y, width, height, index }: any) => {
            const r = data[index];
            const cpa = r.conversions ? r.cost / r.conversions : null;
            const over = targetCpa && cpa && cpa > targetCpa;
            return (
              <text x={x + width + 8} y={y + height / 2 + 4} fontSize={12} className="tnum" fill={over ? '#b4442e' : '#3c4d63'}>
                {dec(r.conversions)} · {cpa ? moneyAuto(cpa, currency) : '—'}
              </text>
            );
          }}>
          {data.map((r) => <Cell key={r.id} fill={r.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Tiny trend line for the KPI strip. */
export function Spark({ values, color = '#1f5fad' }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-7" />;
  const max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24 - 2}`);
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full" aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
