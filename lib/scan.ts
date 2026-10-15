import 'server-only';
import { parse } from 'node-html-parser';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// ---------------------------------------------------------------
// WEBSITE SCAN — lets the agent understand what a business sells.
// Reads the home page plus a few important inner pages (services,
// pricing, about, contact) and returns clean text, headings, and the
// offers/CTAs it finds. The agent turns this into keywords and copy.
//
// Safety: only public http(s) sites. Private and internal network
// addresses are refused so the scanner can't be pointed at our own
// infrastructure (a classic attack called SSRF).
// ---------------------------------------------------------------

function privateIp(ip: string) {
  return /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip);
}

async function assertPublic(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https sites can be scanned.');
  const host = url.hostname;
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('That address is not a public website.');
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (ips.some(privateIp)) throw new Error('That address is not a public website.');
}

async function fetchPage(url: string) {
  const u = new URL(url);
  await assertPublic(u);
  const res = await fetch(u, {
    headers: { 'User-Agent': 'BlueMarketAds-SiteScan/1.0 (+ad strategy review)', Accept: 'text/html' },
    redirect: 'follow', signal: AbortSignal.timeout(12_000), cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${u.hostname} returned ${res.status}`);
  if (!(res.headers.get('content-type') || '').includes('html')) throw new Error('Not an HTML page');
  return { html: (await res.text()).slice(0, 1_500_000), finalUrl: res.url };
}

function extract(html: string, base: string) {
  const root = parse(html);
  root.querySelectorAll('script,style,noscript,svg,iframe').forEach((n) => n.remove());
  const text = (sel: string) => root.querySelectorAll(sel).map((n) => n.text.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const links = root.querySelectorAll('a[href]').map((a) => {
    try { return { text: a.text.replace(/\s+/g, ' ').trim(), url: new URL(a.getAttribute('href')!, base).toString() }; } catch { return null; }
  }).filter(Boolean) as { text: string; url: string }[];
  const phone = html.match(/(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0];
  return {
    title: root.querySelector('title')?.text.trim() || '',
    description: root.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    h1: text('h1').slice(0, 5),
    headings: text('h2, h3').slice(0, 30),
    ctas: [...new Set(text('a.btn, a.button, button, [class*="cta"]').filter((t) => t.length < 40))].slice(0, 15),
    phone,
    links,
    body: (root.querySelector('main') || root.querySelector('body') || root).text.replace(/\s+/g, ' ').trim().slice(0, 5000),
  };
}

const IMPORTANT = /service|treatment|procedure|pricing|price|cost|about|contact|book|appointment|special|offer|financ|location|area/i;

export async function scanWebsite(url: string, maxPages = 5) {
  const start = url.startsWith('http') ? url : `https://${url}`;
  const home = await fetchPage(start);
  const h = extract(home.html, home.finalUrl);
  const origin = new URL(home.finalUrl).origin;

  // Pick inner pages whose link text or URL looks commercially important.
  const inner = [...new Map(h.links
    .filter((l) => l.url.startsWith(origin) && l.url !== home.finalUrl && !l.url.includes('#') && IMPORTANT.test(l.text + ' ' + l.url))
    .map((l) => [l.url.split('?')[0], l])).values()].slice(0, maxPages - 1);

  const pages = await Promise.all(inner.map(async (l) => {
    try {
      const p = await fetchPage(l.url);
      const x = extract(p.html, p.finalUrl);
      return { url: p.finalUrl, title: x.title, h1: x.h1, headings: x.headings.slice(0, 12), body: x.body.slice(0, 2500) };
    } catch { return null; }
  }));

  return {
    url: home.finalUrl,
    title: h.title, description: h.description, h1: h.h1, headings: h.headings, ctas: h.ctas, phone: h.phone,
    navigation: [...new Set(h.links.filter((l) => l.url.startsWith(origin) && l.text && l.text.length < 40).map((l) => l.text))].slice(0, 30),
    homeText: h.body,
    pages: pages.filter(Boolean),
  };
}
