
import { AdAccount, Campaign, DashboardStats, DateRange, MetricData } from '../types';

export class GoogleAdsService {
  private accessToken: string | null = null;
  private developerToken: string | null = null;
  private apiVersion = 'v18';

  setCredentials(accessToken: string, developerToken: string) {
    this.accessToken = accessToken;
    this.developerToken = developerToken;
  }

  private async request(path: string, method = 'GET', body?: any) {
    if (!this.accessToken || !this.developerToken) {
      throw new Error('Credentials not set');
    }

    const response = await fetch(`https://googleads.googleapis.com/${this.apiVersion}/${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'developer-token': this.developerToken,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'API request failed');
    }

    return response.json();
  }

  async fetchAccounts(): Promise<AdAccount[]> {
    const data = await this.request('customers:listAccessibleCustomers');
    const customerIds: string[] = data.resourceNames.map((rn: string) => rn.split('/')[1]);
    
    // For each ID, fetch basic details (simplified for this example)
    // In a real app, you'd query 'customer' resource to get the descriptiveName
    return customerIds.map(id => ({
      id,
      name: `Conta ${id}`,
      currencyCode: 'BRL',
      timeZone: 'America/Sao_Paulo'
    }));
  }

  async fetchDashboardData(
    customerId: string, 
    range: DateRange, 
    compareRange: DateRange
  ): Promise<DashboardStats> {
    const query = (start: string, end: string) => `
      SELECT 
        metrics.impressions, 
        metrics.clicks, 
        metrics.cost_micros, 
        metrics.conversions,
        segments.date
      FROM customer
      WHERE segments.date BETWEEN '${start.replace(/-/g, '')}' AND '${end.replace(/-/g, '')}'
    `;

    const [currentData, comparisonData] = await Promise.all([
      this.request(`customers/${customerId}/googleAds:search`, 'POST', { query: query(range.start, range.end) }),
      this.request(`customers/${customerId}/googleAds:search`, 'POST', { query: query(compareRange.start, compareRange.end) })
    ]);

    const processMetrics = (results: any[]): MetricData => {
      const totals = (results || []).reduce((acc: any, row: any) => {
        acc.impressions += parseInt(row.metrics.impressions || 0);
        acc.clicks += parseInt(row.metrics.clicks || 0);
        acc.cost += (parseInt(row.metrics.costMicros || 0) / 1000000);
        acc.conversions += parseFloat(row.metrics.conversions || 0);
        return acc;
      }, { impressions: 0, clicks: 0, cost: 0, conversions: 0 });

      return {
        ...totals,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        cpc: totals.clicks > 0 ? totals.cost / totals.clicks : 0,
        cpa: totals.conversions > 0 ? totals.cost / totals.conversions : 0,
        roas: 0 // Google Ads requires conversion value to calculate ROAS
      };
    };

    const currentMetrics = processMetrics(currentData.results);
    const comparisonMetrics = processMetrics(comparisonData.results);

    // Map trend data
    const trend = (currentData.results || []).map((row: any) => ({
      date: row.segments.date,
      value: parseInt(row.metrics.costMicros || 0) / 1000000,
      comparisonValue: 0 // Simulating trend comparison for logic
    })).sort((a: any, b: any) => a.date.localeCompare(b.date));

    return {
      current: currentMetrics,
      comparison: comparisonMetrics,
      trend
    };
  }

  async fetchCampaigns(customerId: string): Promise<Campaign[]> {
    const query = `
      SELECT 
        campaign.id, 
        campaign.name, 
        campaign.status,
        metrics.impressions, 
        metrics.clicks, 
        metrics.cost_micros, 
        metrics.conversions
      FROM campaign
      WHERE campaign.status != 'REMOVED'
    `;

    const data = await this.request(`customers/${customerId}/googleAds:search`, 'POST', { query });

    return (data.results || []).map((row: any) => {
      const cost = parseInt(row.metrics.costMicros || 0) / 1000000;
      const conversions = parseFloat(row.metrics.conversions || 0);
      return {
        id: row.campaign.id,
        name: row.campaign.name,
        status: row.campaign.status,
        metrics: {
          impressions: parseInt(row.metrics.impressions || 0),
          clicks: parseInt(row.metrics.clicks || 0),
          cost,
          conversions,
          ctr: parseInt(row.metrics.impressions) > 0 ? parseInt(row.metrics.clicks) / parseInt(row.metrics.impressions) : 0,
          cpc: parseInt(row.metrics.clicks) > 0 ? cost / parseInt(row.metrics.clicks) : 0,
          cpa: conversions > 0 ? cost / conversions : 0,
          roas: 0
        }
      };
    });
  }
}

export const googleAds = new GoogleAdsService();
