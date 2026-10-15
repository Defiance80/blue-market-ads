import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession, demoLoginAllowed, DEMO_USER } from '@/lib/auth';
import { Wordmark } from '@/components/Brand';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSession()) redirect('/');
  const { next } = await searchParams;
  const demo = demoLoginAllowed();

  return (
    <main className="min-h-dvh grid lg:grid-cols-[1.05fr_1fr] bg-white">
      {/* Left: the brand panel. One orchestrated moment: the line draws once. */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-harbor px-14 py-12 text-white">
        <Wordmark inverse />
        <div className="relative z-10 max-w-[30rem]">
          <h1 className="t-display text-[44px] leading-[1.05]">
            Every account,<br />every dollar, one desk.
          </h1>
          <p className="mt-5 max-w-[26rem] text-[15px] leading-relaxed text-[#b7c9e0]">
            Google Ads and Local Services Ads for the whole book of business, with a strategist that
            proposes the change and waits for your sign-off.
          </p>
        </div>
        <MarketLine />
        <div aria-hidden className="h-[38%]" />
      </section>

      {/* Right: the form */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden mb-10"><Wordmark /></div>
          <h2 className="t-title text-[26px] leading-tight">Sign in</h2>
          <p className="mt-1.5 text-ink-3">Use your Blue Market team login.</p>
          <LoginForm next={next} demo={demo ? { email: DEMO_USER.email, password: DEMO_USER.password } : null} />
          <p className="mt-8 text-[12.5px] text-ink-3">Team access only. You stay signed in for seven days on this device.</p>
        </div>
      </section>
    </main>
  );
}

/** A quiet market line across the bottom of the brand panel. Draws once. */
function MarketLine() {
  const d = 'M0 236 C 60 228, 90 240, 140 220 S 230 196, 270 204 S 350 158, 400 166 S 480 128, 520 134 S 590 84, 630 74';
  return (
    <svg viewBox="0 0 660 260" preserveAspectRatio="xMaxYMax slice" aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] w-full">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f5fad" stopOpacity="0.35" />
          <stop offset="1" stopColor="#1f5fad" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[60, 120, 180, 240].map((y) => <line key={y} x1="0" x2="660" y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.06" />)}
      <path d={`${d} L 660 66 L 660 260 L 0 260 Z`} fill="url(#fade)" className="animate-[fadein_1.6s_ease-out_both]" />
      <path d={d} fill="none" stroke="#6fa3db" strokeWidth="2.5" pathLength={1} strokeDasharray="1" className="animate-[draw_1.8s_cubic-bezier(.3,.7,.2,1)_both]" />
      <circle cx="630" cy="74" r="6" fill="#b8862b" className="animate-[fadein_.4s_1.6s_ease-out_both]" />
      <style>{`@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}@keyframes fadein{from{opacity:0}to{opacity:1}}`}</style>
    </svg>
  );
}
