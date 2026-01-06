
export interface AdAccount {
  id: string;
  name: string;
  currencyCode: string;
  timeZone: string;
}

export interface MetricData {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  metrics: MetricData;
}

export interface DashboardStats {
  current: MetricData;
  comparison: MetricData;
  trend: {
    date: string;
    value: number;
    comparisonValue: number;
  }[];
}

export interface DateRange {
  start: string;
  end: string;
}

export type AuthStatus = 'unauthenticated' | 'authenticating' | 'authenticated';
