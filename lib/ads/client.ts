import 'server-only';
import { env } from '../env';
import type { AccountRef } from './types';

// ---------------------------------------------------------------
// Low-level Google Ads REST client.
//
// Every request needs three things:
//   1. An OAuth access token (short-lived; we trade the long-lived
//      refresh token for a new one every ~hour and cache it).
//   2. The developer token (identifies this app to Google).
//   3. login-customer-id: the manager account we act through.
// ---------------------------------------------------------------

let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.ads.clientId,
      client_secret: env.ads.clientSecret,
      refresh_token: env.ads.refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new AdsError(`Google sign-in failed: ${data.error_description || data.error || res.status}. Check the OAuth client and refresh token.`);
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

export class AdsError extends Error {
  details: string[];
  constructor(message: string, details: string[] = []) {
    super(message);
    this.details = details;
  }
}

/** Pulls the human-readable messages out of Google's nested error format. */
function parseError(data: any, status: number): AdsError {
  const details: string[] = [];
  for (const d of data?.error?.details || []) {
    for (const e of d.errors || []) {
      const field = e.location?.fieldPathElements?.map((f: any) => f.fieldName).join('.') || '';
      details.push(field ? `${e.message} (${field})` : e.message);
    }
  }
  const msg = details[0] || data?.error?.message || `Google Ads API error ${status}`;
  return new AdsError(msg, details);
}

const clean = (id: string) => String(id).replace(/\D/g, '');

export async function adsFetch(path: string, opts: { method?: string; body?: unknown; loginCustomerId?: string } = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    'developer-token': env.ads.developerToken,
    'Content-Type': 'application/json',
  };
  if (opts.loginCustomerId) headers['login-customer-id'] = clean(opts.loginCustomerId);

  const res = await fetch(`https://googleads.googleapis.com/${env.ads.apiVersion}/${path}`, {
    method: opts.method || 'POST',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: 'no-store',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw parseError(data, res.status);
  return data;
}

/** Runs a GAQL query and follows every page of results. */
export async function search<T = any>(ref: AccountRef, query: string, maxRows = 20_000): Promise<T[]> {
  const rows: T[] = [];
  let pageToken: string | undefined;
  do {
    const data = await adsFetch(`customers/${clean(ref.customerId)}/googleAds:search`, {
      body: { query, ...(pageToken ? { pageToken } : {}) },
      loginCustomerId: ref.loginCustomerId,
    });
    rows.push(...(data.results || []));
    pageToken = data.nextPageToken;
  } while (pageToken && rows.length < maxRows);
  return rows;
}

export const micros = (v: unknown) => Number(v || 0) / 1e6;
export const toMicros = (dollars: number) => String(Math.round(dollars * 100) * 10_000);
export const num = (v: unknown) => Number(v || 0);
export { clean as cleanId };
