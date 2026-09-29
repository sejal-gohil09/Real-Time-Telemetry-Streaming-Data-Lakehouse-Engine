import { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Server,
  HardDrive,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { AreaChart, BarChart, Gauge } from '@/components/Charts';
import { getTopics, formatNumber, type MetricSeries, type StreamEvent, type AlertItem, type NodeInfo } from '@/lib/telemetry';

interface OverviewProps {
  metrics: MetricSeries[];
  events: StreamEvent[];
  alerts: AlertItem[];
  nodes: NodeInfo[];
}

const METRIC_ICONS: Record<string, typeof Zap> = {
  ingestRate: Zap,
  throughput: TrendingUp,
  latency: Clock,
  errorRate: AlertTriangle,
  cpuLoad: Server,
  memoryUsage: Server,
  storageUsed: HardDrive,
  activeConsumers: Server,
};

const METRIC_COLORS: Record<string, string> = {
  ingestRate: '#22d3ee',
  throughput: '#3b82f6',
  latency: '#f59e0b',
  errorRate: '#ef4444',
  cpuLoad: '#8b5cf6',
  memoryUsage: '#ec4899',
  storageUsed: '#10b981',
  activeConsumers: '#06b6d4',
};

export function Overview({ metrics, events, alerts, nodes }: OverviewProps) {
  const topics = useMemo(() => getTopics(), []);
  const healthyNodes = nodes.filter((n) => n.status === 'healthy').length;
  const degradedNodes = nodes.filter((n) => n.status === 'degraded').length;
  const downNodes = nodes.filter((n) => n.status === 'down').length;

  const topicBarData = topics.map((t) => ({
    label: t.name.split('.').pop() || t.name,
    value: t.throughput,
    color: t.lag > 1000 ? '#ef4444' : t.lag > 100 ? '#f59e0b' : '#3b82f6',
  }));

  const recentErrors = events.filter((e) => e.status !== 'ok').length;
  const errorPct = events.length > 0 ? (recentErrors / events.length) * 100 : 0;

  const cpuMetric = metrics.find((m) => m.key === 'cpuLoad');
  const memMetric = metrics.find((m) => m.key === 'memoryUsage');
  const storageMetric = metrics.find((m) => m.key === 'storageUsed');
  const latencyMetric = metrics.find((m) => m.key === 'latency');

  return (
    <div className="p-6 space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = METRIC_ICONS[m.key] || Zap;
          const color = METRIC_COLORS[m.key] || '#3b82f6';
          const prev = m.history.length > 1 ? m.history[m.history.length - 2] : m.value;
          const diff = m.value - prev;
          const isUp = diff >= 0;
          const isWarning = m.value >= m.threshold.warning;
          const isCritical = m.value >= m.threshold.critical;

          return (
            <div
              key={m.key}
              className="bg-slate-900 rounded-xl border border-slate-800 p-4 hover:border-slate-700 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-500 font-medium">{m.label}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold text-white font-mono">
                      {m.value < 100 ? m.value.toFixed(m.value < 10 ? 2 : 1) : formatNumber(m.value)}
                    </span>
                    {m.unit && <span className="text-xs text-slate-500">{m.unit}</span>}
                  </div>
                </div>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div
                  className={`flex items-center gap-1 text-xs font-mono ${
                    isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : isUp ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(diff) < 1 ? Math.abs(diff).toFixed(2) : formatNumber(Math.abs(diff))}
                </div>
                <div className="w-20 h-8">
                  <AreaChart
                    data={m.history.length > 1 ? m.history : [m.value, m.value]}
                    color={isCritical ? '#ef4444' : isWarning ? '#f59e0b' : color}
                    height={32}
                    max={m.max}
                    min={m.min}
                    gradientId={`spark-${m.key}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Throughput area chart */}
        <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Ingest Throughput</h3>
              <p className="text-xs text-slate-500 mt-0.5">Messages per second · last 90s</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs text-slate-400 font-mono">LIVE</span>
            </div>
          </div>
          <AreaChart
            data={metrics.find((m) => m.key === 'ingestRate')?.history || []}
            color="#22d3ee"
            height={200}
            max={580000}
            min={0}
            gradientId="overview-ingest"
          />
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500 font-mono">
            <span>90s ago</span>
            <span>now</span>
          </div>
        </div>

        {/* Gauges */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Resource Utilization</h3>
          <div className="grid grid-cols-2 gap-4">
            <Gauge
              value={cpuMetric?.value || 0}
              max={100}
              label="CPU"
              unit="%"
              color={(cpuMetric?.value || 0) > 75 ? '#ef4444' : (cpuMetric?.value || 0) > 50 ? '#f59e0b' : '#22d3ee'}
            />
            <Gauge
              value={memMetric?.value || 0}
              max={100}
              label="Memory"
              unit="%"
              color={(memMetric?.value || 0) > 80 ? '#ef4444' : (memMetric?.value || 0) > 60 ? '#f59e0b' : '#8b5cf6'}
            />
            <Gauge
              value={storageMetric?.value || 0}
              max={10}
              label="Storage"
              unit="TB"
              color="#10b981"
            />
            <Gauge
              value={latencyMetric?.value || 0}
              max={200}
              label="P99 Latency"
              unit="ms"
              color={(latencyMetric?.value || 0) > 80 ? '#ef4444' : '#f59e0b'}
            />
          </div>
        </div>
      </div>

      {/* Topics bar chart + Node health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Topic Throughput</h3>
              <p className="text-xs text-slate-500 mt-0.5">Messages per second by topic</p>
            </div>
          </div>
          <BarChart data={topicBarData} height={180} />
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Cluster Health</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-white">Healthy</p>
                  <p className="text-xs text-slate-500">{healthyNodes} nodes operational</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-emerald-400 font-mono">{healthyNodes}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-white">Degraded</p>
                  <p className="text-xs text-slate-500">{degradedNodes} nodes under stress</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-amber-400 font-mono">{degradedNodes}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-sm font-medium text-white">Offline</p>
                  <p className="text-xs text-slate-500">{downNodes} nodes down</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-red-400 font-mono">{downNodes}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Error Rate (recent)</span>
              <span className={`font-mono font-bold ${errorPct > 3 ? 'text-red-400' : errorPct > 1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {errorPct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  errorPct > 3 ? 'bg-red-500' : errorPct > 1 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(errorPct * 10, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recent events preview */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Recent Events</h3>
          <span className="text-xs text-slate-500 font-mono">{events.length} buffered</span>
        </div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {events.slice(0, 12).map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/60 transition-colors text-xs font-mono"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  e.status === 'error' ? 'bg-red-500' : e.status === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              <span className="text-slate-500 w-32 truncate">{e.topic}</span>
              <span className="text-slate-400 w-16">p{e.partition}</span>
              <span className="text-slate-300 flex-1 truncate">{e.key}</span>
              <span className="text-slate-600">{e.latencyMs}ms</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
