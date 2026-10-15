// Number formatting used across the UI.
export const money = (n: number, currency = 'USD', cents = false) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 }).format(n || 0);
export const moneyAuto = (n: number, currency = 'USD') => money(n, currency, Math.abs(n) < 100);
export const int = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n || 0);
export const dec = (n: number, d = 1) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(n || 0);
export const pct = (n: number | null | undefined, d = 1) => (n === null || n === undefined || !isFinite(n) ? '—' : `${(n * 100).toFixed(d)}%`);
export const compact = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
export const ratio = (a: number, b: number) => (b ? a / b : 0);

/** Change vs previous period as a fraction, or null when there's no base. */
export const delta = (now: number, before: number) => (before ? (now - before) / before : null);

export const shortDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export const STRATEGY_LABEL: Record<string, string> = {
  MANUAL_CPC: 'Manual CPC', TARGET_SPEND: 'Maximize clicks', MAXIMIZE_CONVERSIONS: 'Maximize conversions',
  TARGET_CPA: 'Target CPA', MAXIMIZE_CONVERSION_VALUE: 'Maximize conv. value', TARGET_ROAS: 'Target ROAS',
  TARGET_IMPRESSION_SHARE: 'Target impr. share', MANUAL_CPM: 'Manual CPM', TARGET_CPM: 'Target CPM', ENHANCED_CPC: 'Enhanced CPC',
};

// Chart colours: one family, assigned in a fixed order so a campaign
// keeps its colour across every chart on the page.
export const SERIES = ['#1f5fad', '#b8862b', '#2e7d5b', '#6fa3db', '#183a63', '#c9a35e', '#7fae95', '#a9c4e2', '#5b7088', '#8a6a3a'];
export const CHANNEL_COLOR: Record<string, string> = {
  SEARCH: '#1f5fad', LOCAL_SERVICES: '#b8862b', PERFORMANCE_MAX: '#2e7d5b', DISPLAY: '#6fa3db',
  VIDEO: '#183a63', DEMAND_GEN: '#7fae95', SHOPPING: '#c9a35e', OTHER: '#8b98a9',
};
