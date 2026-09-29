import { useEffect, useState } from 'react';
import { supabase, type DashboardSummary } from '@/lib/supabase';
import { generateLocalDashboardData } from '@/lib/localData';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.includes('supabase.co'));

export function useEnergyData() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'database' | 'local'>('database');

  useEffect(() => {
    if (!hasSupabase) {
      const local = generateLocalDashboardData();
      setData(local);
      setDataSource('local');
      setLoading(false);
      return;
    }

    async function fetchAll() {
      try {
        const [
          customersRes,
          summaryRes,
          hourlyRes,
          carbonRes,
          topConsumersRes,
          tariffRes,
        ] = await Promise.all([
          supabase.from('customers').select('customer_id', { count: 'exact', head: true }),
          supabase.from('settlements').select('kwh, cost_gbp, kg_co2, carbon_intensity_gco2, tariff_band, customer_id, reading_time'),
          supabase.from('smart_meter_readings')
            .select('hour_of_day, kwh')
            .order('hour_of_day'),
          supabase.from('carbon_intensity')
            .select('period_start, actual, index')
            .order('period_start'),
          supabase.from('settlements')
            .select('customer_id, kwh, cost_gbp, kg_co2')
            .order('kwh', { ascending: false })
            .limit(10),
          supabase.from('settlements')
            .select('tariff_band, kwh, cost_gbp'),
        ]);

        const totalCustomers = customersRes.count || 0;

        const settlements = summaryRes.data || [];
        const totalKwh = settlements.reduce((s: number, r: { kwh: number }) => s + Number(r.kwh), 0);
        const totalCostGbp = settlements.reduce((s: number, r: { cost_gbp: number }) => s + Number(r.cost_gbp), 0);
        const totalKgCo2 = settlements.reduce((s: number, r: { kg_co2: number }) => s + Number(r.kg_co2), 0);
        const avgCarbonIntensity = settlements.length > 0
          ? settlements.reduce((s: number, r: { carbon_intensity_gco2: number }) => s + (r.carbon_intensity_gco2 || 0), 0) / settlements.length
          : 0;

        const peakKwh = settlements.filter((r: { tariff_band: string }) => r.tariff_band === 'PEAK').reduce((s: number, r: { kwh: number }) => s + Number(r.kwh), 0);
        const offPeakKwh = settlements.filter((r: { tariff_band: string }) => r.tariff_band === 'OFF_PEAK').reduce((s: number, r: { kwh: number }) => s + Number(r.kwh), 0);
        const standardKwh = settlements.filter((r: { tariff_band: string }) => r.tariff_band === 'STANDARD').reduce((s: number, r: { kwh: number }) => s + Number(r.kwh), 0);

        const customersData = (await supabase.from('customers').select('customer_id, nation')).data || [];
        const nationMap = new Map<string, { customers: number; kwh: number; co2: number }>();
        for (const c of customersData) {
          if (!nationMap.has(c.nation)) nationMap.set(c.nation, { customers: 0, kwh: 0, co2: 0 });
          nationMap.get(c.nation)!.customers++;
        }
        for (const s of settlements) {
          const customer = customersData.find((c: { customer_id: string }) => c.customer_id === s.customer_id);
          if (customer) {
            const n = nationMap.get(customer.nation);
            if (n) { n.kwh += Number(s.kwh); n.co2 += Number(s.kg_co2); }
          }
        }
        const nations = Array.from(nationMap.entries()).map(([nation, v]) => ({ nation, ...v }));

        const hourlyMap = new Map<number, { kwh: number; co2: number; intensity: number; count: number }>();
        for (let h = 0; h < 24; h++) hourlyMap.set(h, { kwh: 0, co2: 0, intensity: 0, count: 0 });
        for (const r of (hourlyRes.data || [])) {
          const entry = hourlyMap.get(r.hour_of_day);
          if (entry) { entry.kwh += Number(r.kwh); entry.count++; }
        }
        for (const s of settlements) {
          const hour = new Date(s.reading_time).getUTCHours();
          const entry = hourlyMap.get(hour);
          if (entry) { entry.co2 += Number(s.kg_co2); entry.intensity += s.carbon_intensity_gco2 || 0; }
        }
        const hourlyProfile = Array.from(hourlyMap.entries()).map(([hour, v]) => ({
          hour, kwh: v.kwh, co2: v.co2, intensity: v.count > 0 ? v.intensity / v.count : 0,
        }));

        const dayNames = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];
        const dailyMap = new Map<string, { kwh: number; cost: number; co2: number }>();
        for (const s of settlements) {
          const date = s.reading_time.split('T')[0];
          if (!dailyMap.has(date)) dailyMap.set(date, { kwh: 0, cost: 0, co2: 0 });
          const d = dailyMap.get(date)!;
          d.kwh += Number(s.kwh); d.cost += Number(s.cost_gbp); d.co2 += Number(s.kg_co2);
        }
        const dailyProfile = Array.from(dailyMap.entries()).map(([date, v], i) => ({ day: dayNames[i] || date, ...v }));

        const carbonIntensityTrend = (carbonRes.data || []).map((r: { period_start: string; actual: number | null; index: string }) => ({
          time: r.period_start, actual: r.actual || 0, index: r.index,
        }));

        const topConsumersMap = new Map<string, { kwh: number; cost: number; co2: number }>();
        for (const s of (topConsumersRes.data || [])) {
          if (!topConsumersMap.has(s.customer_id)) topConsumersMap.set(s.customer_id, { kwh: 0, cost: 0, co2: 0 });
          const e = topConsumersMap.get(s.customer_id)!;
          e.kwh += Number(s.kwh); e.cost += Number(s.cost_gbp); e.co2 += Number(s.kg_co2);
        }
        const topConsumers = Array.from(topConsumersMap.entries())
          .map(([customer_id, v]) => ({ customer_id, ...v }))
          .sort((a, b) => b.kwh - a.kwh)
          .slice(0, 10);

        const tariffMap = new Map<string, { kwh: number; cost: number }>();
        for (const s of (tariffRes.data || [])) {
          if (!tariffMap.has(s.tariff_band)) tariffMap.set(s.tariff_band, { kwh: 0, cost: 0 });
          const e = tariffMap.get(s.tariff_band)!;
          e.kwh += Number(s.kwh); e.cost += Number(s.cost_gbp);
        }
        const totalTariffKwh = peakKwh + offPeakKwh + standardKwh;
        const tariffBreakdown = Array.from(tariffMap.entries()).map(([band, v]) => ({
          band, kwh: v.kwh, cost: v.cost,
          percentage: totalTariffKwh > 0 ? (v.kwh / totalTariffKwh) * 100 : 0,
        }));

        setData({
          totalCustomers, totalReadings: settlements.length, totalKwh, totalCostGbp,
          totalKgCo2, avgCarbonIntensity, peakKwh, offPeakKwh, standardKwh,
          nations, hourlyProfile, dailyProfile, carbonIntensityTrend,
          topConsumers, tariffBreakdown,
        });
        setDataSource('database');
        setLoading(false);
      } catch (err) {
        const local = generateLocalDashboardData();
        setData(local);
        setDataSource('local');
        setError(null);
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  return { data, loading, error, dataSource };
}
