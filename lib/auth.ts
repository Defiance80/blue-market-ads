import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { env } from './env';
import { SESSION_COOKIE, demoLoginAllowed, secretKey, verifySessionToken, type Session } from './session';

export { SESSION_COOKIE, demoLoginAllowed, verifySessionToken };
export type { Session };

// HOW LOGIN WORKS
// 1. The login form posts email + password to /api/auth/login.
// 2. We compare the password to a bcrypt hash stored in TEAM_USERS.
//    (A hash can be checked but not reversed, so the real password is
//    never stored anywhere.)
// 3. On success we set a signed cookie (a JWT). The signature uses
//    AUTH_SECRET, so nobody can forge or edit the cookie.
// 4. proxy.ts checks that cookie before any page or API route runs.

const SESSION_DAYS = 7;

export const DEMO_USER = { email: 'demo@bluemarketads.com', name: 'Demo', password: 'bluemarket' };

type TeamUser = { email: string; name: string; passwordHash: string };

function teamUsers(): TeamUser[] {
  if (!env.teamUsers) return [];
  try {
    const list = JSON.parse(env.teamUsers);
    return Array.isArray(list) ? list : [];
  } catch {
    console.error('TEAM_USERS is not valid JSON');
    return [];
  }
}

export async function checkCredentials(email: string, password: string): Promise<Session | null> {
  const e = email.trim().toLowerCase();
  if (demoLoginAllowed() && e === DEMO_USER.email && password === DEMO_USER.password) {
    return { email: DEMO_USER.email, name: DEMO_USER.name, demo: true };
  }
  const user = teamUsers().find((u) => u.email.toLowerCase() === e);
  // Compare against a dummy hash when the user doesn't exist, so a wrong
  // email takes as long as a wrong password (no account enumeration).
  const hash = user?.passwordHash || '$2b$12$vTPWTLt5A30CFjGgEtNmX.R/dXioGFXqbmBzetuQOjSqjOYn0er8u';
  const ok = await bcrypt.compare(password, hash);
  return ok && user ? { email: user.email, name: user.name, demo: false } : null;
}

export async function createSessionToken(s: Session) {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function getSession() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};

/** For API routes: returns the session or a 401 response. */
export async function requireSession() {
  const s = await getSession();
  if (!s) return { session: null, error: Response.json({ error: 'Sign in again to continue.' }, { status: 401 }) };
  return { session: s, error: null };
}
