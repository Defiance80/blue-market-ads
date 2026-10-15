import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

// Runs before every page and API route (except the ones listed in
// `matcher` below). No valid session cookie = back to the login page,
// or a 401 for API calls.
export async function proxy(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in again to continue.' }, { status: 401 });
  }
  const url = new URL('/login', req.url);
  if (req.nextUrl.pathname !== '/') url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the login page, the login/logout API, and static files.
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico|icon.svg|.*\\.png$).*)'],
};
