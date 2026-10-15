'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Check, Loader2 } from 'lucide-react';
import { useAccount } from '@/components/app/AccountContext';

type Profile = {
  business?: string; website?: string; goals?: string; targetCpa?: number | ''; targetRoas?: number | ''; monthlyBudget?: number | '';
  serviceArea?: string; audience?: string; offers?: string; rules?: string; updatedAt?: string; updatedBy?: string;
};
type Status = { googleAds: boolean; testMode: boolean; apiVersion: string; agent: boolean; model: string; n8n: boolean; storage: boolean };

export default function SettingsPage() {
  const { active } = useAccount();
  const [p, setP] = useState<Profile>({});
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => { fetch('/api/status').then((r) => r.json()).then(setStatus); }, []);
  useEffect(() => {
    if (!active) return;
    setP({});
    fetch(`/api/profile?customerId=${active.customerId}`).then((r) => r.json()).then((d) => setP(d.profile || {}));
  }, [active?.customerId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setSaved('saving');
    const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...p, customerId: active.customerId }) });
    if (res.ok) { setP((await res.json()).profile); setSaved('saved'); setTimeout(() => setSaved('idle'), 2500); } else setSaved('error');
  }

  const field = (key: keyof Profile, label: string, hint: string, opts: { area?: boolean; type?: string; prefix?: string } = {}) => (
    <label className="block">
      <span className="block text-[13px] font-[580] text-ink">{label}</span>
      <span className="mb-1.5 block text-[12px] text-ink-3">{hint}</span>
      {opts.area
        ? <textarea className="field min-h-[84px] py-2.5 leading-snug" value={(p[key] as string) || ''} onChange={(e) => setP({ ...p, [key]: e.target.value })} />
        : <span className="relative block">
            {opts.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">{opts.prefix}</span>}
            <input className={clsx('field', opts.prefix && 'pl-7')} type={opts.type || 'text'} value={(p[key] as any) ?? ''} step="any"
              onChange={(e) => setP({ ...p, [key]: opts.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })} />
          </span>}
    </label>
  );

  return (
    <div className="mx-auto grid max-w-[1100px] gap-8 lg:grid-cols-[1fr_300px]">
      <div>
        <h1 className="t-title text-[24px] leading-tight">Account settings</h1>
        <p className="mt-1 max-w-[62ch] text-ink-3">
          The strategy profile tells the strategist what {active ? <span className="font-[560] text-ink-2">{active.name}</span> : 'this account'} sells, what a good result is, and any rules to follow. It reads this before every conversation.
        </p>
        {!active ? <p className="mt-10 text-ink-3">Choose a client account first.</p> : (
          <form onSubmit={save} className="mt-6 space-y-5 rounded-[10px] border border-line bg-white p-6">
            {field('business', 'What the business sells', 'One or two sentences. Services, specialty, who they serve.', { area: true })}
            <div className="grid gap-5 sm:grid-cols-2">
              {field('website', 'Website', 'Used for site scans and sitelinks.', { type: 'url' })}
              {field('serviceArea', 'Service area', 'Cities, counties or a radius.')}
            </div>
            {field('goals', 'What counts as a win', 'e.g. booked implant consults; calls over 60 seconds.', { area: true })}
            <div className="grid gap-5 sm:grid-cols-3">
              {field('targetCpa', 'Target cost per lead', 'Leave blank to use the agency default.', { type: 'number', prefix: '$' })}
              {field('monthlyBudget', 'Monthly budget', 'Total across campaigns.', { type: 'number', prefix: '$' })}
              {field('targetRoas', 'Target ROAS', 'Ratio, e.g. 4 = 400%.', { type: 'number' })}
            </div>
            {field('offers', 'Offers and proof', 'Free consults, financing, years in business, credentials, reviews.', { area: true })}
            {field('audience', 'Ideal customer', 'Who converts best and why.', { area: true })}
            {field('rules', 'Standing rules', 'Things the strategist must always or never do on this account.', { area: true })}
            <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
              <span className="text-[12px] text-ink-3">{p.updatedAt ? `Last saved ${new Date(p.updatedAt).toLocaleString()} by ${p.updatedBy}` : 'Not saved yet'}</span>
              <button className="btn btn-primary" disabled={saved === 'saving'}>
                {saved === 'saving' ? <><Loader2 size={15} className="animate-spin" /> Saving</> : saved === 'saved' ? <><Check size={15} /> Saved</> : 'Save profile'}
              </button>
            </div>
            {saved === 'error' && <p className="text-[13px] text-bad">The profile didn&rsquo;t save. Try again.</p>}
          </form>
        )}
      </div>

      <aside>
        <h2 className="t-title text-[15px] lg:mt-[76px]">Connections</h2>
        <ul className="mt-3 divide-y divide-line rounded-[10px] border border-line bg-white text-[13px]">
          {status && ([
            ['Google Ads', status.googleAds, status.googleAds ? `API ${status.apiVersion}${status.testMode ? ', test mode (changes checked, not applied)' : ', live'}` : 'Showing sample accounts'],
            ['Strategist', status.agent, status.agent ? status.model : 'Needs ANTHROPIC_API_KEY'],
            ['n8n', status.n8n, status.n8n ? 'Webhooks ready' : 'Needs N8N_WEBHOOK_BASE'],
            ['Storage', status.storage, status.storage ? 'Profiles and history are saved' : 'In memory until Upstash Redis is added'],
          ] as [string, boolean, string][]).map(([name, ok, note]) => (
            <li key={name} className="flex gap-3 px-4 py-3">
              <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', ok ? 'bg-good' : 'bg-brass')} />
              <span><span className="block font-[580] text-ink">{name}</span><span className="text-ink-3">{note}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-3">Connections are set as environment variables in Vercel. The README lists each one.</p>
      </aside>
    </div>
  );
}
