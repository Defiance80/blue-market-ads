'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginForm({ next, demo }: { next?: string; demo: { email: string; password: string } | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      // Only allow redirects inside this app.
      window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error || 'Sign-in failed. Try again.');
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-[560] text-ink-2">Work email</span>
        <input className="field" type="email" autoComplete="username" required value={email}
          onChange={(e) => setEmail(e.target.value)} autoFocus />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-[560] text-ink-2">Password</span>
        <span className="relative block">
          <input className="field pr-11" type={show ? 'text' : 'password'} autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded text-ink-3 hover:text-ink">
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </span>
      </label>

      {error && <p role="alert" className="rounded-md bg-bad-soft px-3 py-2.5 text-[13px] text-bad">{error}</p>}

      <button className="btn btn-primary h-[42px] w-full text-[14px]" disabled={busy || !email || !password}>
        {busy ? <><Loader2 size={16} className="animate-spin" /> Signing in</> : 'Sign in'}
      </button>

      {demo && (
        <div className="rounded-md border border-line bg-paper px-4 py-3 text-[13px] text-ink-2">
          <p><span className="font-[600] text-ink">Demo mode.</span> No Google Ads account is connected yet, so the app shows sample accounts.</p>
          <button type="button" className="mt-2 font-[600] text-market hover:underline"
            onClick={() => { setEmail(demo.email); setPassword(demo.password); }}>
            Fill in the demo login
          </button>
        </div>
      )}
    </form>
  );
}
