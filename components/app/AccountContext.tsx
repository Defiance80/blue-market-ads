'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Account, ClientAccount, RangeKey } from '@/lib/ads/types';

// ---------------------------------------------------------------
// Which account is selected, shared by every page.
//
// Top picker: accounts your login opens directly (usually your MCC).
// If the pick is a MANAGER, a second picker lists its client accounts.
// The data shown is always for a client account (`customerId`), reached
// THROUGH the manager (`loginCustomerId`). Choices are remembered in
// the browser so the app reopens where you left it.
// ---------------------------------------------------------------

type State = {
  accounts: Account[];
  clients: ClientAccount[];
  top: Account | null;
  client: ClientAccount | null;
  /** The account we read and change, or null while a manager has no client picked. */
  active: { customerId: string; loginCustomerId: string; name: string; currency: string } | null;
  range: RangeKey;
  demo: boolean;
  loading: boolean;
  error: string;
  selectTop: (id: string) => void;
  selectClient: (id: string) => void;
  setRange: (r: RangeKey) => void;
};

const Ctx = createContext<State | null>(null);
export const useAccount = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAccount must be inside AccountProvider');
  return v;
};

const KEY = 'bm.selection.v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = (v: object) => { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...v })); } catch { /* private mode */ } };

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [topId, setTopId] = useState('');
  const [clientId, setClientId] = useState('');
  const [range, setRangeState] = useState<RangeKey>('LAST_30_DAYS');
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = read();
    if (saved.range) setRangeState(saved.range);
    fetch('/api/accounts').then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not load accounts');
      setAccounts(d.accounts);
      setDemo(!!d.demo);
      const pick = d.accounts.find((a: Account) => a.id === saved.topId) || d.accounts[0];
      if (pick) setTopId(pick.id);
      if (!pick) setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const top = accounts.find((a) => a.id === topId) || null;

  // When the top account is a manager, load its clients.
  useEffect(() => {
    if (!top) return;
    if (!top.isManager) { setClients([]); setClientId(''); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/clients?managerId=${top.id}`).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not load client accounts');
      setClients(d.clients);
      const saved = read();
      const keep = d.clients.find((c: ClientAccount) => c.id === saved.clientId) || d.clients[0];
      setClientId(keep?.id || '');
      setError('');
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [top?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const client = clients.find((c) => c.id === clientId) || null;
  const active = useMemo(() => {
    if (!top) return null;
    if (top.isManager) return client ? { customerId: client.id, loginCustomerId: top.id, name: client.name, currency: client.currency } : null;
    return { customerId: top.id, loginCustomerId: top.id, name: top.name, currency: top.currency };
  }, [top, client]);

  const selectTop = useCallback((id: string) => { setTopId(id); setClientId(''); write({ topId: id, clientId: '' }); }, []);
  const selectClient = useCallback((id: string) => { setClientId(id); write({ clientId: id }); }, []);
  const setRange = useCallback((r: RangeKey) => { setRangeState(r); write({ range: r }); }, []);

  return (
    <Ctx.Provider value={{ accounts, clients, top, client, active, range, demo, loading, error, selectTop, selectClient, setRange }}>
      {children}
    </Ctx.Provider>
  );
}

/** Formats a Google Ads ID the way the Ads UI shows it: 123-456-7890 */
export const fmtId = (id: string) => (id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id);
