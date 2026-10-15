'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowDownRight, ArrowUpRight, Check, CircleAlert, Loader2, Minus, RotateCcw, SendHorizontal, X } from 'lucide-react';
import { useAccount } from '@/components/app/AccountContext';
import type { Proposal } from '@/lib/agent/tools';

// ---------------------------------------------------------------
// The Strategist: a conversation with the agent about the selected
// account. Its proposals appear as cards; nothing changes in Google
// Ads until someone clicks Apply on a card.
// ---------------------------------------------------------------

type ToolStep = { name: string; status: 'running' | 'done' | 'error'; message?: string };
type ProposalState = Proposal & { state: 'open' | 'applying' | 'applied' | 'dismissed'; results?: { summary: string; ok: boolean; message: string }[]; testMode?: boolean; demo?: boolean };
// An assistant reply is an ordered list of parts, so a proposal card sits
// exactly where the strategist made it, between the words around it.
type Part = { kind: 'text'; text: string } | { kind: 'tools'; tools: ToolStep[] } | { kind: 'proposal'; p: ProposalState };
type Item = { id: string; role: 'user' | 'assistant' | 'note'; text: string; parts?: Part[]; error?: string; status?: string };

const textOf = (i: Item) => (i.parts ? i.parts.filter((p): p is Extract<Part, { kind: 'text' }> => p.kind === 'text').map((p) => p.text).join('').trim() : i.text);
function addText(parts: Part[], delta: string): Part[] {
  const last = parts[parts.length - 1];
  if (last?.kind === 'text') return [...parts.slice(0, -1), { kind: 'text', text: last.text + delta }];
  return delta.trim() ? [...parts, { kind: 'text', text: delta.replace(/^\s+/, '') }] : parts;
}

const TOOL_LABEL: Record<string, string> = {
  get_performance: 'Reading account performance',
  get_keywords: 'Reviewing keywords and Quality Scores',
  get_search_terms: 'Reviewing search terms',
  run_query: 'Running a custom report',
  scan_website: 'Scanning the website',
  keyword_ideas: 'Pulling keyword ideas from Keyword Planner',
  save_strategy_profile: 'Saving the strategy profile',
  propose_changes: 'Preparing a proposal',
  run_automation: 'Starting an n8n workflow',
};

const STARTERS = [
  'Audit this account and give me the three changes that would help most.',
  'Find wasted spend in the search terms and propose negatives.',
  'Scan the website and build a keyword plan for each service.',
  'Is it time to change any bid strategies? Show the numbers.',
  'Write a new responsive search ad for the top campaign.',
  'How are Local Services leads doing, and what would you change?',
];

const uid = () => Math.random().toString(36).slice(2);
const storeKey = (id: string) => `bm.chat.${id}`;

export default function StrategistPage() {
  const { active } = useAccount();
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  // Load and save the conversation per account
  useEffect(() => {
    if (!active) return;
    try { setItems(JSON.parse(localStorage.getItem(storeKey(active.customerId)) || '[]')); } catch { setItems([]); }
  }, [active?.customerId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!active || busy) return;
    try { localStorage.setItem(storeKey(active.customerId), JSON.stringify(items.slice(-60))); } catch { /* storage full */ }
  }, [items, busy]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [items.length, busy]);

  const update = (id: string, fn: (i: Item) => Item) => setItems((all) => all.map((i) => (i.id === id ? fn(i) : i)));

  async function send(text: string) {
    if (!active || !text.trim() || busy) return;
    const user: Item = { id: uid(), role: 'user', text: text.trim() };
    const reply: Item = { id: uid(), role: 'assistant', text: '', parts: [] };
    const next = [...items, user];
    setItems([...next, reply]);
    setInput('');
    setBusy(true);

    // The agent sees text only: user messages, its own replies, and notes
    // about proposals that were applied or dismissed.
    const history = next.filter((i) => textOf(i)).map((i) => ({ role: i.role === 'assistant' ? 'assistant' : 'user', content: i.role === 'note' ? `[Note from the app] ${i.text}` : textOf(i) }))
      .reduce((acc: { role: string; content: string }[], m) => {
        const last = acc[acc.length - 1];
        if (last && last.role === m.role) last.content += '\n\n' + m.content; else acc.push({ ...m });
        return acc;
      }, []);

    abort.current = new AbortController();
    try {
      const res = await fetch('/api/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.current.signal,
        body: JSON.stringify({ ...active, accountName: active.name, messages: history }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `The strategist is unavailable (${res.status}).`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          const e = JSON.parse(part.slice(6));
          if (e.type === 'text') update(reply.id, (i) => ({ ...i, parts: addText(i.parts || [], e.delta), status: undefined }));
          if (e.type === 'status') update(reply.id, (i) => ({ ...i, status: e.text }));
          if (e.type === 'tool') update(reply.id, (i) => {
            const parts = [...(i.parts || [])];
            const last = parts[parts.length - 1];
            if (e.status === 'running') {
              if (last?.kind === 'tools') parts[parts.length - 1] = { kind: 'tools', tools: [...last.tools, { name: e.name, status: 'running' }] };
              else parts.push({ kind: 'tools', tools: [{ name: e.name, status: 'running' }] });
            } else {
              for (let k = parts.length - 1; k >= 0; k--) {
                const pt = parts[k];
                if (pt.kind !== 'tools') continue;
                const idx = pt.tools.map((t) => t.name === e.name && t.status === 'running').lastIndexOf(true);
                if (idx >= 0) { const tools = [...pt.tools]; tools[idx] = { ...tools[idx], status: e.status, message: e.message }; parts[k] = { kind: 'tools', tools }; break; }
              }
            }
            return { ...i, parts };
          });
          if (e.type === 'proposal') update(reply.id, (i) => ({ ...i, parts: [...(i.parts || []), { kind: 'proposal', p: { ...e.proposal, state: 'open' } }] }));
          if (e.type === 'error') update(reply.id, (i) => ({ ...i, error: e.message }));
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') update(reply.id, (i) => ({ ...i, error: err.message }));
    } finally {
      update(reply.id, (i) => ({ ...i, parts: i.parts?.map((pt) => (pt.kind === 'tools' ? { ...pt, tools: pt.tools.map((t) => (t.status === 'running' ? { ...t, status: 'done' as const } : t)) } : pt)) }));
      setBusy(false);
    }
  }

  async function apply(itemId: string, p: ProposalState) {
    if (!active) return;
    const setP = (patch: Partial<ProposalState>) => update(itemId, (i) => ({ ...i, parts: i.parts?.map((pt) => (pt.kind === 'proposal' && pt.p.id === p.id ? { kind: 'proposal', p: { ...pt.p, ...patch } } : pt)) }));
    setP({ state: 'applying' });
    try {
      const res = await fetch('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...active, accountName: active.name, changes: p.changes.map(({ summary, direction, ...c }) => c) }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Apply failed');
      setP({ state: 'applied', results: d.results, testMode: d.testMode, demo: d.demo });
      const ok = d.results.filter((r: any) => r.ok).length;
      setItems((all) => [...all, { id: uid(), role: 'note', text: `${d.testMode ? 'Tested (not applied)' : 'Applied'} "${p.title}": ${ok} of ${d.results.length} changes succeeded.${d.results.filter((r: any) => !r.ok).map((r: any) => ` Failed: ${r.summary} — ${r.message}.`).join('')}` }]);
    } catch (e: any) {
      setP({ state: 'open', results: [{ summary: 'Request', ok: false, message: e.message }] });
    }
  }

  function dismiss(itemId: string, p: ProposalState) {
    update(itemId, (i) => ({ ...i, parts: i.parts?.map((pt) => (pt.kind === 'proposal' && pt.p.id === p.id ? { kind: 'proposal', p: { ...pt.p, state: 'dismissed' } } : pt)) }));
    setItems((all) => [...all, { id: uid(), role: 'note', text: `Dismissed the proposal "${p.title}".` }]);
  }

  if (!active) return <p className="mt-16 text-center text-ink-3">Choose a client account to talk to the strategist about it.</p>;

  return (
    <div className="mx-auto flex h-[calc(100dvh-150px)] max-w-[920px] flex-col">
      <div className="flex items-end justify-between gap-4 pb-4">
        <div>
          <h1 className="t-title text-[24px] leading-tight">Strategist</h1>
          <p className="mt-0.5 text-ink-3">Working on <span className="font-[560] text-ink-2">{active.name}</span>. Proposals wait for your approval.</p>
        </div>
        {items.length > 0 && (
          <button className="btn btn-quiet" disabled={busy} onClick={() => { setItems([]); localStorage.removeItem(storeKey(active.customerId)); }}>
            <RotateCcw size={15} /> New conversation
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-[10px] border border-line bg-white">
        {items.length === 0 ? (
          <div className="px-6 py-10 sm:px-10">
            <h2 className="t-title text-[18px]">What should we work on?</h2>
            <p className="mt-1 max-w-[56ch] text-ink-3">The strategist reads this account&rsquo;s data, the website and Keyword Planner, then proposes changes you can apply in one click.</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-[8px] border border-line px-4 py-3 text-left text-ink-2 transition-colors hover:border-market/40 hover:bg-paper hover:text-ink">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 px-5 py-6 sm:px-8">
            {items.map((i) => <Message key={i.id} item={i} busy={busy} onApply={(p) => apply(i.id, p)} onDismiss={(p) => dismiss(i.id, p)} />)}
            <div ref={bottom} />
          </div>
        )}
      </div>

      <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder="Ask about this account, or tell the strategist what to do"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          className="field max-h-40 min-h-[46px] resize-none py-3 leading-snug" />
        {busy
          ? <button type="button" className="btn btn-quiet h-[46px]" onClick={() => abort.current?.abort()}><X size={16} /> Stop</button>
          : <button className="btn btn-primary h-[46px]" disabled={!input.trim()}><SendHorizontal size={16} /> Send</button>}
      </form>
    </div>
  );
}

function Message({ item, busy, onApply, onDismiss }: { item: Item; busy: boolean; onApply: (p: ProposalState) => void; onDismiss: (p: ProposalState) => void }) {
  if (item.role === 'user') {
    return <div className="ml-auto max-w-[80%] rounded-[10px] bg-harbor px-4 py-2.5 text-white whitespace-pre-wrap">{item.text}</div>;
  }
  if (item.role === 'note') {
    return <p className="border-l-2 border-line pl-3 text-[12.5px] text-ink-3">{item.text}</p>;
  }
  const parts = item.parts || (item.text ? [{ kind: 'text', text: item.text } as Part] : []);
  const working = busy && parts.length === 0 && !item.error;
  return (
    <div className="space-y-3">
      {working && <p className="flex items-center gap-2 text-ink-3"><Loader2 size={15} className="animate-spin" /> Thinking it through</p>}
      {parts.map((pt, n) => {
        if (pt.kind === 'text') return <div key={n} className="prose-bm"><ReactMarkdown remarkPlugins={[remarkGfm]}>{pt.text}</ReactMarkdown></div>;
        if (pt.kind === 'proposal') return <ProposalCard key={pt.p.id} p={pt.p} onApply={() => onApply(pt.p)} onDismiss={() => onDismiss(pt.p)} />;
        return (
          <ul key={n} className="space-y-1">
            {pt.tools.map((t, k) => (
              <li key={k} className="flex items-center gap-2 text-[12.5px] text-ink-3">
                {t.status === 'running' ? <Loader2 size={13} className="animate-spin text-market" /> : t.status === 'error' ? <CircleAlert size={13} className="text-bad" /> : <Check size={13} className="text-good" />}
                {TOOL_LABEL[t.name] || t.name}{t.status === 'error' && t.message ? `: ${t.message.split('\n')[0]}` : ''}
              </li>
            ))}
          </ul>
        );
      })}
      {item.status && <p className="text-[12.5px] text-ink-3">{item.status}</p>}
      {item.error && <p className="rounded-[8px] bg-bad-soft px-3 py-2 text-[13px] text-bad">{item.error}</p>}
    </div>
  );
}

function ProposalCard({ p, onApply, onDismiss }: { p: ProposalState; onApply: () => void; onDismiss: () => void }) {
  const Dir = { up: ArrowUpRight, down: ArrowDownRight, neutral: Minus };
  const done = p.state === 'applied';
  return (
    <div className={clsx('overflow-hidden rounded-[10px] border', p.state === 'dismissed' ? 'border-line opacity-60' : 'border-market/30')}>
      <div className={clsx('px-4 py-3', p.state === 'dismissed' ? 'bg-paper' : 'bg-[#f1f6fd]')}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="t-title text-[14.5px]">{p.title}</h3>
          <span className="chip shrink-0 bg-white text-market-2">{p.changes.length} change{p.changes.length === 1 ? '' : 's'}</span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{p.rationale}</p>
      </div>
      <ul className="divide-y divide-line">
        {p.changes.map((c, n) => {
          const r = p.results?.[n];
          const Icon = Dir[c.direction];
          return (
            <li key={n} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
              <Icon size={15} className={clsx('mt-0.5 shrink-0', c.direction === 'up' ? 'text-brass' : c.direction === 'down' ? 'text-good' : 'text-ink-3')}
                aria-label={c.direction === 'up' ? 'Raises spend' : c.direction === 'down' ? 'Lowers spend' : 'No direct spend change'} />
              <span className="min-w-0 flex-1">
                <span className="text-ink">{c.summary}</span>
                {r && <span className={clsx('mt-0.5 block text-[12px]', r.ok ? 'text-good' : 'text-bad')}>{r.message}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {p.state !== 'dismissed' && (
        <div className="flex items-center justify-end gap-2 border-t border-line bg-white px-4 py-2.5">
          {done ? (
            <span className="text-[12.5px] text-ink-3">{p.demo ? 'Demo mode: changes were checked here and not sent to Google.' : p.testMode ? 'Test mode: Google checked these changes. Nothing was changed.' : 'Applied to Google Ads.'}</span>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={onDismiss} disabled={p.state === 'applying'}>Dismiss</button>
              <button className="btn btn-primary" onClick={onApply} disabled={p.state === 'applying'}>
                {p.state === 'applying' ? <><Loader2 size={15} className="animate-spin" /> Applying</> : `Apply ${p.changes.length} change${p.changes.length === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
