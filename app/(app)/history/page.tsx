'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useAccount } from '@/components/app/AccountContext';

type Entry = { at: string; by: string; customerId: string; accountName: string; summary: string; ok: boolean; message: string; testMode: boolean };

export default function HistoryPage() {
  const { active } = useAccount();
  const [all, setAll] = useState(false);
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [persistent, setPersistent] = useState(true);

  useEffect(() => {
    const id = !all && active ? `?customerId=${active.customerId}` : '';
    fetch(`/api/activity${id}`).then((r) => r.json()).then((d) => { setRows(d.activity || []); setPersistent(!!d.persistent); });
  }, [all, active?.customerId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-title text-[24px] leading-tight">Change history</h1>
          <p className="mt-1 text-ink-3">Every change applied from this app, newest first.</p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4 accent-market" /> All accounts
        </label>
      </div>
      {!persistent && <p className="mt-4 text-[12.5px] text-ink-3">History is kept in memory until storage is connected (Upstash Redis in Vercel), so it resets on redeploy.</p>}
      <div className="mt-5 overflow-x-auto rounded-[10px] border border-line bg-white">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead><tr className="border-b border-line bg-paper text-left text-[12px] text-ink-3">
            {['When', 'Account', 'Change', 'Result', 'By'].map((h) => <th key={h} className="px-4 py-2.5 font-[560]">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-3">Loading</td></tr>}
            {rows?.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-3">No changes yet. Apply a proposal from the Strategist and it shows up here.</td></tr>}
            {rows?.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0 align-top">
                <td className="whitespace-nowrap px-4 py-3 text-ink-2 tnum">{new Date(r.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                <td className="px-4 py-3">{r.accountName}</td>
                <td className="px-4 py-3">{r.summary}</td>
                <td className={clsx('px-4 py-3', r.ok ? 'text-good' : 'text-bad')}>{r.testMode && r.ok ? 'Tested, not applied' : r.ok ? 'Applied' : r.message}</td>
                <td className="px-4 py-3 text-ink-3">{r.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
