// Shapes shared by the server (Google Ads calls) and the browser (UI).

export type AccountRef = {
  /** The account whose data we read or change. */
  customerId: string;
  /** The manager (MCC) we reach it through. Same as customerId for a direct account. */
  loginCustomerId: string;
};

export type Account = {
  id: string;
  name: string;
  isManager: boolean;
  currency: string;
  timeZone?: string;
};

export type ClientAccount = Account & { level: number };

export type RangeKey = 'LAST_7_DAYS' | 'LAST_14_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_90_DAYS';

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'LAST_7_DAYS', label: 'Last 7 days' },
  { key: 'LAST_14_DAYS', label: 'Last 14 days' },
  { key: 'LAST_30_DAYS', label: 'Last 30 days' },
  { key: 'THIS_MONTH', label: 'This month' },
  { key: 'LAST_MONTH', label: 'Last month' },
  { key: 'LAST_90_DAYS', label: 'Last 90 days' },
];

export type Totals = {
  cost: number; clicks: number; impressions: number; conversions: number; value: number;
};

export type DailyRow = Totals & { date: string };

export type Channel = 'SEARCH' | 'LOCAL_SERVICES' | 'PERFORMANCE_MAX' | 'DISPLAY' | 'VIDEO' | 'DEMAND_GEN' | 'SHOPPING' | 'OTHER';

export type CampaignRow = Totals & {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED' | string;
  channel: Channel;
  biddingStrategy: string;
  dailyBudget: number;
  impressionShare: number | null;
  lostToBudget: number | null;
  lostToRank: number | null;
};

export type LsaLead = {
  type: 'PHONE_CALL' | 'MESSAGE' | 'BOOKING' | string;
  status: string;
  createdAt: string;
  charged: boolean;
  category: string;
};

export type Report = {
  account: { id: string; name: string; currency: string };
  range: { key: RangeKey; start: string; end: string };
  totals: Totals;
  previous: Totals;
  daily: DailyRow[];
  campaigns: CampaignRow[];
  lsaLeads: LsaLead[];
  demo: boolean;
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  SEARCH: 'Search',
  LOCAL_SERVICES: 'Local Services',
  PERFORMANCE_MAX: 'Performance Max',
  DISPLAY: 'Display',
  VIDEO: 'YouTube',
  DEMAND_GEN: 'Demand Gen',
  SHOPPING: 'Shopping',
  OTHER: 'Other',
};
