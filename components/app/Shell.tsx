'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import { LayoutDashboard, MessagesSquare, Workflow, SlidersHorizontal, History, LogOut, Menu } from 'lucide-react';
import { Wordmark } from '../Brand';
import { Picker } from './Picker';
import { useAccount, fmtId } from './AccountContext';
import { RANGES, type RangeKey } from '@/lib/ads/types';

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/strategist', label: 'Strategist', icon: MessagesSquare },
  { href: '/automations', label: 'Automations', icon: Workflow },
  { href: '/history', label: 'Change history', icon: History },
  { href: '/settings', label: 'Account settings', icon: SlidersHorizontal },
];

export function Shell({ user, children }: { user: { name: string; email: string }; children: React.ReactNode }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const { accounts, clients, top, client, range, demo, selectTop, selectClient, setRange, error } = useAccount();

  const rail = (
    <nav className="flex h-full flex-col bg-harbor px-3 py-5 text-[#c6d5e8]">
      <div className="px-2 pb-7"><Wordmark inverse /></div>
      <ul className="space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} onClick={() => setMenu(false)}
                className={clsx('flex h-9 items-center gap-3 rounded-[6px] px-2.5 font-[540] transition-colors',
                  on ? 'bg-harbor-2 text-white' : 'hover:bg-white/5 hover:text-white')}>
                <Icon size={17} strokeWidth={1.9} className={on ? 'text-sky' : ''} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto space-y-3 px-2">
        {demo && (
          <p className="rounded-[6px] border border-brass/40 bg-brass/10 px-3 py-2 text-[12px] leading-snug text-[#e8cf9a]">
            Sample accounts. Connect Google Ads in Vercel to see real data.
          </p>
        )}
        <div className="flex items-center gap-2.5 border-t border-white/10 pt-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-harbor-2 text-[13px] font-[650] text-white">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-[560] text-white">{user.name}</span>
            <span className="block truncate text-[11.5px] text-[#8fa7c4]">{user.email}</span>
          </span>
          <form action="/api/auth/logout" method="post">
            <button aria-label="Sign out" title="Sign out" className="grid h-8 w-8 place-items-center rounded-[6px] hover:bg-white/10 hover:text-white">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh lg:block">{rail}</aside>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-ink/40" onClick={() => setMenu(false)} />
          <div className="relative h-full w-[260px]">{rail}</div>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
            <button className="btn btn-ghost -ml-2 h-9 w-9 px-0 lg:hidden" aria-label="Open menu" onClick={() => setMenu(true)}><Menu size={19} /></button>
            <Picker label="Account" width={300} value={top?.id || ''} onChange={selectTop}
              items={accounts.map((a) => ({ id: a.id, label: a.name, detail: fmtId(a.id), badge: a.isManager ? 'Manager' : undefined,
                group: a.isManager ? 'Manager accounts' : 'Accounts' }))} />
            {top?.isManager && (
              <Picker label={`Client account · ${clients.length}`} width={280} value={client?.id || ''} onChange={selectClient}
                placeholder={clients.length ? 'Choose a client' : 'No active clients'}
                items={clients.map((c) => ({ id: c.id, label: c.name, detail: `${fmtId(c.id)}${c.level > 1 ? ` · level ${c.level}` : ''}` }))} />
            )}
            <label className="ml-auto block">
              <span className="mb-1 block text-[11.5px] font-[560] text-ink-3">Date range</span>
              <select value={range} onChange={(e) => setRange(e.target.value as RangeKey)}
                className="h-9 rounded-[6px] border border-line bg-white px-2.5 font-[540] hover:border-[#b9c7d9]">
                {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
          </div>
          {error && <p className="border-t border-bad/20 bg-bad-soft px-8 py-2 text-[13px] text-bad">{error}</p>}
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
