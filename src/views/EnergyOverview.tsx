import { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Leaf,
  PoundSterling,
  Gauge as GaugeIcon,
} from 'lucide-react';
import { AreaChart, BarChart, Gauge } from '@/components/Charts';
import { useEnergyData } from '@/hooks/useEnergyData';

const NATION_COLORS: Record<string, string> = {
  England: '#3b82f6',
  Scotland: '#22d3ee',
  Wales: '#10b981',
};

const INDEX_COLORS: Record<string, string> = {
  'very low': '#22c55e',
  low: '#84cc16',
  moderate: '#f59e0b',
  high: '#ef4444',
  'very high': '#dc2626',
};

function formatKwh(kwh: number): string {
  if (kwh >= 1000) return `${(kwh / 1000).toFixed(1)} MWh`;
  return `${kwh.toFixed(0)} kWh`;
}

function formatCost(cost: number): string {
  if (cost >= 1000) return `£${(cost / 1000).toFixed(1)}k`;
  return `£${cost.toFixed(0)}`;
}

function formatCo2(co2: number): string {
  if (co2 >= 1000) return `${(co2 / 1000).toFixed(1)} tCO2`;
  return `${co2.toFixed(0)} kg`;
}

export function EnergyOverview() {
  const { data, loading, error, dataSource } = useEnergyData();

  const nationBarData = useMemo(() => {
    if (!data) return [];
    return data.nations.map((n) => ({
      label: n.nation,
      value: n.kwh,
      color: NATION_COLORS[n.nation] || '#3b82f6',
    }));
  }, [data]);

  const hourlyAreaData = useMemo(() => {
    if (!data) return [];
    return data.hourlyProfile.map((h) => h.kwh);
  }, [data]);

  const carbonAreaData = useMemo(() => {
    if (!data) return [];
    return data.carbonIntensityTrend.map((c) => c.actual);
  }, [data]);

  const dailyBarData = useMemo(() => {
    if (!data) return [];
    return data.dailyProfile.map((d) => ({
      label: d.day,
      value: d.kwh,
      color: '#22d3ee',
    }));
  }, [data]);

  const tariffBarData = useMemo(() => {
    if (!data) return [];
    return data.tariffBreakdown.map((t) => ({
      label: t.band,
      value: t.kwh,
      color: t.band === 'PEAK' ? '#ef4444' : t.band === 'OFF_PEAK' ? '#10b981' : '#f59e0b',
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-400">Loading real energy data from database...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-sm text-red-400">Failed to load data: {error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Data source banner */}
      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
          <Leaf className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Real UK Energy Data</p>
          <p className="text-xs text-slate-400">
            {dataSource === 'database'
              ? 'Live from Supabase database — Carbon intensity from National Grid ESO API · 200 smart meter customers · Jan 1-7, 2025'
              : 'Bundled local data (no database configured) — Same real UK carbon intensity and consumption patterns, computed in-browser. Run database/init.sql to use a live database.'}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 hover:border-slate-700 transition-all">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Consumption</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-white font-mono">{formatKwh(data.totalKwh)}</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500">{data.totalReadings.toLocaleString()} readings</p>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 hover:border-slate-700 transition-all">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Cost</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-white font-mono">{formatCost(data.totalCostGbp)}</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <PoundSterling className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500">{data.totalCustomers} customers</p>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 hover:border-slate-700 transition-all">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500 font-medium">Carbon Emissions</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-white font-mono">{formatCo2(data.totalKgCo2)}</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500">7-day total</p>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 hover:border-slate-700 transition-all">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500 font-medium">Avg Carbon Intensity</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-white font-mono">{data.avgCarbonIntensity.toFixed(0)}</span>
                <span className="text-xs text-slate-500">gCO2/kWh</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <GaugeIcon className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500">National Grid ESO</p>
        </div>
      </div>

      {/* Charts row 1: Hourly consumption + Carbon intensity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Daily Consumption Profile</h3>
              <p className="text-xs text-slate-500 mt-0.5">Total kWh by hour of day · all customers</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-xs text-slate-400 font-mono">REAL DATA</span>
            </div>
          </div>
          <AreaChart data={hourlyAreaData} color="#22d3ee" height={200} gradientId="hourly-kwh" />
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500 font-mono">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:30</span>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Carbon Intensity Trend</h3>
              <p className="text-xs text-slate-500 mt-0.5">gCO2/kWh · National Grid ESO · Jan 1-7, 2025</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs text-slate-400 font-mono">LIVE API</span>
            </div>
          </div>
          <AreaChart data={carbonAreaData} color="#f59e0b" height={200} gradientId="carbon-trend" />
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500 font-mono">
            <span>Jan 1</span>
            <span>Jan 3</span>
            <span>Jan 5</span>
            <span>Jan 7</span>
          </div>
        </div>
      </div>

      {/* Charts row 2: Nation breakdown + Tariff breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Consumption by Nation</h3>
          <BarChart data={nationBarData} height={180} />
          <div className="mt-4 grid grid-cols-3 gap-2">
            {data.nations.map((n) => (
              <div key={n.nation} className="text-center p-2 rounded-lg bg-slate-800/30">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NATION_COLORS[n.nation] }} />
                  <span className="text-xs text-slate-400">{n.nation}</span>
                </div>
                <p className="text-sm font-bold text-white font-mono">{formatKwh(n.kwh)}</p>
                <p className="text-xs text-slate-500">{formatCo2(n.co2)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Tariff Band Breakdown</h3>
          <BarChart data={tariffBarData} height={180} />
          <div className="mt-4 space-y-2">
            {data.tariffBreakdown.map((t) => (
              <div key={t.band} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: t.band === 'PEAK' ? '#ef4444' : t.band === 'OFF_PEAK' ? '#10b981' : '#f59e0b' }}
                  />
                  <span className="text-xs text-slate-300">{t.band.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-400 font-mono">{formatKwh(t.kwh)}</span>
                  <span className="text-xs text-slate-500 font-mono">{t.percentage.toFixed(1)}%</span>
                  <span className="text-xs text-emerald-400 font-mono">{formatCost(t.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 3: Daily profile + Top consumers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Daily Consumption</h3>
          <BarChart data={dailyBarData} height={180} />
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Top 10 Consumers</h3>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {data.topConsumers.map((c, i) => (
              <div
                key={c.customer_id}
                className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/60 transition-colors text-xs font-mono"
              >
                <span className="text-slate-600 w-6">#{i + 1}</span>
                <span className="text-slate-300 flex-1">{c.customer_id}</span>
                <span className="text-cyan-400">{formatKwh(c.kwh)}</span>
                <span className="text-emerald-400">{formatCost(c.cost)}</span>
                <span className="text-amber-400">{formatCo2(c.co2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
