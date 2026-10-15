import { jwtVerify } from 'jose';
import { env, adsConfigured } from './env';

// Session essentials with no heavy imports, so proxy.ts can use them.

export const SESSION_COOKIE = 'bm_session';
export type Session = { email: string; name: string; demo: boolean };

export function teamUserCount() {
  try {
    const list = JSON.parse(env.teamUsers || '[]');
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

/** Demo login is only allowed while no real accounts are connected. */
export const demoLoginAllowed = () => !adsConfigured() && teamUserCount() === 0;

export function secretKey() {
  const s = env.authSecret || (demoLoginAllowed() ? 'blue-market-demo-only-secret-change-me' : '');
  if (!s) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(s);
}

export async function verifySessionToken(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    // A demo session stops working the moment real accounts are connected.
    if (payload.demo && !demoLoginAllowed()) return null;
    return { email: String(payload.email), name: String(payload.name), demo: Boolean(payload.demo) };
  } catch {
    return null;
  }
}
