export interface HistoricalDataPoint {
  date: string;
  value: number;
  unitPrice?: number; // $/kg
}

export interface IndicatorData {
  name: string;
  symbol: string;
  value: number;

  // 1-day change
  change: number;
  changePercent: number;

  // 7-day change
  change7d?: number;
  changePercent7d?: number;

  // 30-day change
  change30d?: number;
  changePercent30d?: number;

  lastUpdated: string;
  unit?: string;
  history?: HistoricalDataPoint[];
  countryCode?: string; // ISO 2-letter code for flags
  isExportData?: boolean; // Flag to identify export metrics vs financial
  isLive?: boolean; // True if real API data, False if simulation
}

export interface CustomsExportData {
  countryName: string;
  countryCode: string;
  currentValue: number;
  history: HistoricalDataPoint[];
  lastUpdated: string;
  isLive?: boolean;
}

export interface DashboardData {
  indicators: {
    // Export Fundamentals
    totalExport: IndicatorData;
    usExport: IndicatorData;
    cnExport: IndicatorData;
    jpExport: IndicatorData;
    othersExport: IndicatorData;
    frExport: IndicatorData;
    mxExport: IndicatorData;
    aeExport: IndicatorData;
  };
  timestamp: string;
}

export interface FREDResponse {
  observations: Array<{
    date: string;
    value: string;
  }>;
}

export interface YahooFinanceQuote {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        chartPreviousClose: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: (number | null)[];
        }>;
      };
    }>;
  };
}

export interface CoinGeckoSimplePrice {
  bitcoin: {
    usd: number;
    usd_24h_change: number;
    last_updated_at: number;
  };
}

export interface CoinGeckoMarketChart {
  prices: [number, number][]; // [timestamp, price]
}

// Re-export GeminiModelName from central constants file
export type { GeminiModelName } from '../constants/gemini-models';
