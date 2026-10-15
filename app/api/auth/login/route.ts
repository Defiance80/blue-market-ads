import { NextResponse } from 'next/server';
import { checkCredentials, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

// Slows down password guessing: 8 attempts per IP per 15 minutes.
// (In-memory, so it resets when Vercel starts a fresh instance. Good enough
// for a small internal team; use Vercel Firewall rules for more.)
const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && a.until > now && a.n >= 8) {
    return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  }

  let body: { email?: string; password?: string };
  try { body = await req.json(); } catch { body = {}; }
  const session = await checkCredentials(String(body.email || ''), String(body.password || ''));

  if (!session) {
    attempts.set(ip, { n: (a && a.until > now ? a.n : 0) + 1, until: now + 15 * 60 * 1000 });
    return NextResponse.json({ error: 'That email and password don’t match a team login.' }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(session), sessionCookieOptions);
  return res;
}
