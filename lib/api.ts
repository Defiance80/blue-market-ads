import 'server-only';
import type { AccountRef } from './ads/types';

/** Reads ?customerId=&loginCustomerId= (or a JSON body) into a safe AccountRef. */
export function refFrom(src: URLSearchParams | Record<string, any>): AccountRef | null {
  const get = (k: string) => (src instanceof URLSearchParams ? src.get(k) : src?.[k]);
  const customerId = String(get('customerId') || '').replace(/\D/g, '');
  const loginCustomerId = String(get('loginCustomerId') || customerId).replace(/\D/g, '');
  if (!/^\d{6,12}$/.test(customerId) || !/^\d{6,12}$/.test(loginCustomerId)) return null;
  return { customerId, loginCustomerId };
}

export const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

/** Wraps a handler so any thrown error becomes a readable JSON message. */
export async function safe(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e: any) {
    console.error(e);
    return Response.json({ error: e?.message || 'Something went wrong talking to Google Ads.', details: e?.details }, { status: 502 });
  }
}
