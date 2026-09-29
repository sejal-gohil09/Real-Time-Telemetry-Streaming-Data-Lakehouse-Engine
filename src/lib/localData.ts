import type { DashboardSummary } from '@/lib/supabase';

const DAILY_PATTERN = [
  0.18, 0.15, 0.13, 0.12, 0.11, 0.10, 0.10, 0.12,
  0.15, 0.22, 0.35, 0.52, 0.68, 0.75, 0.72, 0.55,
  0.42, 0.35, 0.30, 0.28, 0.26, 0.25, 0.24, 0.23,
  0.22, 0.21, 0.22, 0.24, 0.27, 0.32, 0.42, 0.58,
  0.75, 0.82, 0.85, 0.80, 0.72, 0.60, 0.48, 0.38,
  0.30, 0.25, 0.22, 0.20, 0.18, 0.17, 0.16, 0.15,
];

const PEAK_PERIODS = new Set([14, 15, 16, 17, 34, 35, 36, 37, 38, 39]);

const REAL_CARBON_INTENSITY = [
  51, 55, 54, 53, 53, 47, 45, 44, 44, 45, 45, 43, 41, 41, 42, 44, 44, 43, 38, 36, 36, 39, 35, 35, 39, 41, 41, 45, 44, 53, 70, 78, 81, 89, 93, 93, 95, 94, 93, 92, 93, 92, 87, 83, 77, 76, 65, 63, 67,
  71, 68, 61, 56, 60, 59, 57, 63, 63, 67, 68, 88, 109, 134, 140, 139, 148, 147, 140, 139, 135, 132, 128, 120, 123, 130, 131, 139, 141, 147, 152, 155, 160, 160, 154, 152, 151, 150, 145, 136, 129, 114, 105, 92, 82, 70, 61, 59,
  63, 55, 50, 47, 45, 42, 42, 45, 47, 54, 62, 84, 104, 119, 128, 136, 140, 134, 127, 125, 121, 119, 120, 120, 124, 127, 136, 145, 157, 169, 184, 194, 195, 203, 206, 209, 209, 210, 210, 215, 218, 221, 217, 208, 202, 189, 184, 184,
  186, 188, 185, 183, 174, 172, 170, 172, 172, 182, 184, 188, 190, 199, 206, 213, 221, 217, 217, 215, 218, 219, 217, 209, 210, 213, 215, 213, 214, 218, 219, 221, 219, 218, 215, 212, 208, 205, 196, 188, 176, 165, 144, 127, 114, 101, 92,
  84, 77, 70, 63, 59, 56, 52, 49, 49, 49, 49, 49, 51, 53, 59, 73, 87, 99, 106, 115, 124, 129, 137, 141, 144, 148, 151, 151, 156, 160, 160, 165, 169, 168, 167, 166, 165, 155, 145, 133, 116, 93, 71, 55, 46, 42, 43, 50,
  53, 55, 47, 48, 42, 43, 43, 47, 49, 46, 50, 48, 64, 80, 93, 111, 120, 121, 119, 115, 114, 115, 115, 116, 115, 116, 113, 112, 116, 119, 127, 134, 135, 138, 138, 138, 137, 131, 123, 113, 100, 89, 78, 72, 67, 63, 64,
  69, 68, 65, 66, 63, 64, 67, 69, 65, 72, 77, 94, 113, 128, 141, 150, 155, 155, 151, 147, 144, 138, 133, 125, 122, 124, 125, 129, 134, 141, 149, 154, 155, 153, 154, 150, 149, 147, 142, 136, 125, 115, 103, 89, 84, 82,
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateLocalDashboardData(): DashboardSummary {
  let totalKwh = 0;
  let totalCostGbp = 0;
  let totalKgCo2 = 0;
  let totalCiSum = 0;
  let totalReadings = 0;

  const hourlyKwh = new Array(24).fill(0);
  const hourlyCo2 = new Array(24).fill(0);
  const hourlyIntensity = new Array(24).fill(0);
  const hourlyIntensityCount = new Array(24).fill(0);
  const dailyKwh = new Array(7).fill(0);
  const dailyCost = new Array(7).fill(0);
  const dailyCo2 = new Array(7).fill(0);
  const nationKwh: Record<string, number> = { England: 0, Scotland: 0, Wales: 0 };
  const nationCo2: Record<string, number> = { England: 0, Scotland: 0, Wales: 0 };
  const nationCustomers: Record<string, number> = { England: 0, Scotland: 0, Wales: 0 };
  const tariffKwh: Record<string, number> = { PEAK: 0, OFF_PEAK: 0, STANDARD: 0 };
  const tariffCost: Record<string, number> = { PEAK: 0, OFF_PEAK: 0, STANDARD: 0 };
  const customerTotals = new Map<string, { kwh: number; cost: number; co2: number }>();

  for (let i = 1; i <= 200; i++) {
    const custId = `CUST-${String(i).padStart(4, '0')}`;
    const nation = i <= 140 ? 'England' : i <= 170 ? 'Scotland' : 'Wales';
    nationCustomers[nation]++;
    const baseFactor = 0.6 + seededRandom(i * 7) * 1.2;
    const weekendFactor = 0.9 + seededRandom(i * 13) * 0.4;

    customerTotals.set(custId, { kwh: 0, cost: 0, co2: 0 });

    for (let day = 0; day < 7; day++) {
      const dow = (3 + day) % 7;
      const isWeekend = dow >= 5;

      for (let period = 0; period < 48; period++) {
        const hour = Math.floor(period / 2);
        let kwh = DAILY_PATTERN[period] * baseFactor;
        if (isWeekend) kwh *= weekendFactor;
        kwh *= 0.85 + seededRandom(i * 1000 + day * 100 + period) * 0.3;
        kwh = Math.round(kwh * 10000) / 10000;

        const isPeak = PEAK_PERIODS.has(period);
        const ciIndex = day * 48 + period;
        const ci = ciIndex < REAL_CARBON_INTENSITY.length ? REAL_CARBON_INTENSITY[ciIndex] : 50;
        const kgCo2 = Math.round((kwh * ci / 1000) * 1000000) / 1000000;

        let cost: number;
        let band: string;
        if (isPeak) {
          cost = Math.round(kwh * 0.3594 * 10000) / 10000;
          band = 'PEAK';
        } else if (hour < 7) {
          cost = Math.round(kwh * 0.1392 * 10000) / 10000;
          band = 'OFF_PEAK';
        } else {
          cost = Math.round(kwh * 0.2735 * 10000) / 10000;
          band = 'STANDARD';
        }

        totalKwh += kwh;
        totalCostGbp += cost;
        totalKgCo2 += kgCo2;
        totalCiSum += ci;
        totalReadings++;

        hourlyKwh[hour] += kwh;
        hourlyCo2[hour] += kgCo2;
        hourlyIntensity[hour] += ci;
        hourlyIntensityCount[hour]++;
        dailyKwh[day] += kwh;
        dailyCost[day] += cost;
        dailyCo2[day] += kgCo2;
        nationKwh[nation] += kwh;
        nationCo2[nation] += kgCo2;
        tariffKwh[band] += kwh;
        tariffCost[band] += cost;

        const ct = customerTotals.get(custId)!;
        ct.kwh += kwh;
        ct.cost += cost;
        ct.co2 += kgCo2;
      }
    }
  }

  const dayNames = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];
  const totalTariffKwh = tariffKwh.PEAK + tariffKwh.OFF_PEAK + tariffKwh.STANDARD;

  return {
    totalCustomers: 200,
    totalReadings,
    totalKwh,
    totalCostGbp,
    totalKgCo2,
    avgCarbonIntensity: totalReadings > 0 ? totalCiSum / totalReadings : 0,
    peakKwh: tariffKwh.PEAK,
    offPeakKwh: tariffKwh.OFF_PEAK,
    standardKwh: tariffKwh.STANDARD,
    nations: Object.entries(nationKwh).map(([nation, kwh]) => ({
      nation,
      customers: nationCustomers[nation],
      kwh,
      co2: nationCo2[nation],
    })),
    hourlyProfile: hourlyKwh.map((kwh, hour) => ({
      hour,
      kwh,
      co2: hourlyCo2[hour],
      intensity: hourlyIntensityCount[hour] > 0 ? hourlyIntensity[hour] / hourlyIntensityCount[hour] : 0,
    })),
    dailyProfile: dayNames.map((day, i) => ({
      day,
      kwh: dailyKwh[i],
      cost: dailyCost[i],
      co2: dailyCo2[i],
    })),
    carbonIntensityTrend: REAL_CARBON_INTENSITY.map((actual, i) => {
      const day = Math.floor(i / 48);
      const period = i % 48;
      const hour = Math.floor(period / 2);
      const minute = (period % 2) * 30;
      const date = new Date(Date.UTC(2025, 0, 1 + day, hour, minute));
      const index = actual < 50 ? 'very low' : actual < 100 ? 'low' : actual < 200 ? 'moderate' : actual < 300 ? 'high' : 'very high';
      return { time: date.toISOString(), actual, index };
    }),
    topConsumers: Array.from(customerTotals.entries())
      .map(([customer_id, v]) => ({ customer_id, ...v }))
      .sort((a, b) => b.kwh - a.kwh)
      .slice(0, 10),
    tariffBreakdown: Object.entries(tariffKwh).map(([band, kwh]) => ({
      band,
      kwh,
      cost: tariffCost[band],
      percentage: totalTariffKwh > 0 ? (kwh / totalTariffKwh) * 100 : 0,
    })),
  };
}
