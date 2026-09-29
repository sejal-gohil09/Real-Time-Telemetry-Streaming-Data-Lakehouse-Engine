import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Region {
  region_id: number;
  shortname: string;
  nation: string;
}

export interface Customer {
  customer_id: string;
  customer_name: string;
  mpan: string;
  region_id: number;
  nation: string;
  tariff_type: string;
}

export interface CarbonIntensity {
  period_start: string;
  forecast: number | null;
  actual: number | null;
  index: string;
}

export interface SmartMeterReading {
  customer_id: string;
  reading_time: string;
  kwh: number;
  is_peak_period: boolean;
  day_of_week: number;
  hour_of_day: number;
  season: string;
}

export interface Settlement {
  customer_id: string;
  reading_time: string;
  kwh: number;
  carbon_intensity_gco2: number;
  kg_co2: number;
  tariff_band: string;
  cost_gbp: number;
}

export interface DashboardSummary {
  totalCustomers: number;
  totalReadings: number;
  totalKwh: number;
  totalCostGbp: number;
  totalKgCo2: number;
  avgCarbonIntensity: number;
  peakKwh: number;
  offPeakKwh: number;
  standardKwh: number;
  nations: { nation: string; customers: number; kwh: number; co2: number }[];
  hourlyProfile: { hour: number; kwh: number; co2: number; intensity: number }[];
  dailyProfile: { day: string; kwh: number; cost: number; co2: number }[];
  carbonIntensityTrend: { time: string; actual: number; index: string }[];
  topConsumers: { customer_id: string; kwh: number; cost: number; co2: number }[];
  tariffBreakdown: { band: string; kwh: number; cost: number; percentage: number }[];
}
