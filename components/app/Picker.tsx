'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

// A searchable dropdown. Keyboard: arrows move, Enter picks, Esc closes.

export type PickerItem = { id: string; label: string; detail?: string; group?: string; badge?: string };

export function Picker({ label, items, value, onChange, placeholder = 'Choose…', width = 280, disabled }: {
  label: string; items: PickerItem[]; value: string; onChange: (id: string) => void;
  placeholder?: string; width?: number; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = items.find((i) => i.id === value);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/-/g, '');
    return s ? items.filter((i) => i.label.toLowerCase().includes(s) || i.id.includes(s)) : items;
  }, [q, items]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  useEffect(() => { setHi(0); }, [q, open]);

  const pick = (id: string) => { onChange(id); setOpen(false); setQ(''); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && filtered[hi]) { e.preventDefault(); pick(filtered[hi].id); }
    if (e.key === 'Escape') setOpen(false);
  };

  let lastGroup = '';
  return (
    <div ref={wrap} className="relative" style={{ width }}>
      <span className="mb-1 block text-[11.5px] font-[560] text-ink-3">{label}</span>
      <button type="button" disabled={disabled} onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}
        className="flex h-9 w-full items-center gap-2 rounded-[6px] border border-line bg-white px-3 text-left hover:border-[#b9c7d9] disabled:opacity-50">
        <span className="min-w-0 flex-1 truncate font-[560]">{current?.label || <span className="font-normal text-ink-3">{placeholder}</span>}</span>
        {current?.badge && <span className="chip bg-mist text-market-2">{current.badge}</span>}
        <ChevronsUpDown size={15} className="shrink-0 text-ink-3" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[max(100%,320px)] overflow-hidden rounded-[10px] border border-line bg-white shadow-[0_12px_32px_-12px_rgba(16,41,74,.28)]">
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search size={15} className="text-ink-3" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
              placeholder="Search by name or ID" aria-controls={listId}
              className="h-10 w-full bg-transparent outline-none placeholder:text-ink-3" />
          </div>
          <ul id={listId} role="listbox" className="max-h-[340px] overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-ink-3">No accounts match “{q}”.</li>}
            {filtered.map((i, n) => {
              const header = i.group && i.group !== lastGroup ? i.group : '';
              lastGroup = i.group || lastGroup;
              return (
                <li key={i.id}>
                  {header && <div className="px-3 pb-1 pt-2.5 text-[11.5px] font-[600] text-ink-3">{header}</div>}
                  <button type="button" role="option" aria-selected={i.id === value} onMouseEnter={() => setHi(n)} onClick={() => pick(i.id)}
                    className={clsx('flex w-full items-center gap-3 px-3 py-2 text-left', n === hi && 'bg-paper')}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-[560]">{i.label}</span>
                      {i.detail && <span className="block text-[12px] text-ink-3 tnum">{i.detail}</span>}
                    </span>
                    {i.badge && <span className="chip bg-mist text-market-2">{i.badge}</span>}
                    <Check size={15} className={clsx('text-market', i.id === value ? 'opacity-100' : 'opacity-0')} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
