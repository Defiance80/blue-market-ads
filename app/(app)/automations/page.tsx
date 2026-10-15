'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Loader2, Play } from 'lucide-react';
import { useAccount } from '@/components/app/AccountContext';

type Wf = { key: string; name: string; schedule: string; does: string };

export default function AutomationsPage() {
  const { active } = useAccount();
  const [workflows, setWorkflows] = useState<Wf[]>([]);
  const [connected, setConnected] = useState(true);
  const [running, setRunning] = useState('');
  const [result, setResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  useEffect(() => { fetch('/api/n8n').then((r) => r.json()).then((d) => { setWorkflows(d.workflows || []); setConnected(!!d.connected); }); }, []);

  async function run(key: string) {
    if (!active) return;
    setRunning(key);
    const res = await fetch('/api/n8n', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...active, accountName: active.name, workflow: key }) });
    const d = await res.json().catch(() => ({ ok: false, message: 'No response' }));
    setResult((r) => ({ ...r, [key]: d }));
    setRunning('');
  }

  return (
    <div className="mx-auto max-w-[980px]">
      <h1 className="t-title text-[24px] leading-tight">Automations</h1>
      <p className="mt-1 max-w-[64ch] text-ink-3">
        These n8n workflows run on their own schedules. Use Run now to start one immediately for {active ? <span className="font-[560] text-ink-2">{active.name}</span> : 'the selected account'}.
      </p>
      {!connected && (
        <p className="mt-5 rounded-[8px] border border-brass/40 bg-brass-soft px-4 py-3 text-[13px] text-[#6d5017]">
          n8n isn&rsquo;t connected yet. Add <code>N8N_WEBHOOK_BASE</code> and <code>N8N_WEBHOOK_SECRET</code> in Vercel, then redeploy.
        </p>
      )}
      <ul className="mt-6 divide-y divide-line rounded-[10px] border border-line bg-white">
        {workflows.map((w) => (
          <li key={w.key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h2 className="t-title text-[15px]">{w.name}</h2>
              <p className="mt-0.5 text-[13px] text-ink-2">{w.does}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-3"><CalendarClock size={13} /> {w.schedule}</p>
              {result[w.key] && <p className={`mt-1.5 text-[12.5px] ${result[w.key].ok ? 'text-good' : 'text-bad'}`}>{result[w.key].message}</p>}
            </div>
            <button className="btn btn-quiet shrink-0" disabled={!active || !connected || running === w.key} onClick={() => run(w.key)}>
              {running === w.key ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Run now
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
