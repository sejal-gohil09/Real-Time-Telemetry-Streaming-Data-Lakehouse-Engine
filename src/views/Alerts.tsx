import { useMemo } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,
  Trash2,
  Clock,
  Zap,
  Server,
  Timer,
  Bug,
} from 'lucide-react';
import { formatTimeAgo, type AlertItem, type SimulatedIncident } from '@/lib/telemetry';

interface AlertsProps {
  alerts: AlertItem[];
  onAcknowledge: (id: string) => void;
  onClear: () => void;
  onInjectIncident: (incident: SimulatedIncident) => void;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/5',
    border: 'border-red-500/20',
    badge: 'bg-red-500 text-white',
    label: 'CRITICAL',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    badge: 'bg-amber-500 text-slate-900',
    label: 'WARNING',
  },
  info: {
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    badge: 'bg-blue-500 text-white',
    label: 'INFO',
  },
};

const INCIDENT_BUTTONS: { incident: SimulatedIncident; icon: typeof Zap; color: string }[] = [
  {
    incident: { type: 'consumer_lag', label: 'Consumer Lag', description: '10K lag spike' },
    icon: Zap,
    color: 'text-red-400 border-red-500/30 hover:bg-red-500/10',
  },
  {
    incident: { type: 'broker_failure', label: 'Broker Failure', description: 'us-west-2 down' },
    icon: Server,
    color: 'text-red-400 border-red-500/30 hover:bg-red-500/10',
  },
  {
    incident: { type: 'latency_spike', label: 'Latency Spike', description: 'P99 → 178ms' },
    icon: Timer,
    color: 'text-amber-400 border-amber-500/30 hover:bg-amber-500/10',
  },
  {
    incident: { type: 'error_burst', label: 'Error Burst', description: '3.4% error rate' },
    icon: Bug,
    color: 'text-amber-400 border-amber-500/30 hover:bg-amber-500/10',
  },
];

export function Alerts({ alerts, onAcknowledge, onClear, onInjectIncident }: AlertsProps) {
  const stats = useMemo(() => {
    const active = alerts.filter((a) => !a.acknowledged);
    return {
      critical: active.filter((a) => a.severity === 'critical').length,
      warning: active.filter((a) => a.severity === 'warning').length,
      info: active.filter((a) => a.severity === 'info').length,
      total: active.length,
      acknowledged: alerts.filter((a) => a.acknowledged).length,
    };
  }, [alerts]);

  return (
    <div className="p-6 space-y-4">
      {/* Incident simulation panel */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Incident Simulator</h3>
          <span className="text-[10px] text-slate-500 font-mono ml-2">Inject anomalies to test alerting</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {INCIDENT_BUTTONS.map(({ incident, icon: Icon, color }) => (
            <button
              key={incident.type}
              onClick={() => onInjectIncident(incident)}
              className={`flex items-start gap-3 p-3 rounded-lg border bg-slate-800/30 transition-all ${color}`}
            >
              <Icon className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-medium text-slate-200">{incident.label}</p>
                <p className="text-[10px] text-slate-500 font-mono">{incident.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-cyan-400" />
            <p className="text-xs text-slate-500">Active Alerts</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{stats.total}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-red-500/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-xs text-slate-500">Critical</p>
          </div>
          <p className="text-2xl font-bold text-red-400 font-mono">{stats.critical}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-amber-500/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-slate-500">Warning</p>
          </div>
          <p className="text-2xl font-bold text-amber-400 font-mono">{stats.warning}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-slate-500">Acknowledged</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-mono">{stats.acknowledged}</p>
        </div>
      </div>

      {/* Alert list */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">Alert Stream</h3>
          {alerts.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400/30 mb-3" />
            <p className="text-sm text-slate-400">No active alerts</p>
            <p className="text-xs text-slate-600 mt-1">All systems operating within normal parameters</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50 max-h-[600px] overflow-y-auto">
            {alerts.map((alert) => {
              const config = SEVERITY_CONFIG[alert.severity];
              const Icon = config.icon;
              return (
                <div
                  key={alert.id}
                  className={`px-5 py-4 ${config.bg} ${alert.acknowledged ? 'opacity-50' : ''} transition-all hover:bg-slate-800/30`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 mt-0.5 ${config.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold font-mono ${config.badge}`}>
                          {config.label}
                        </span>
                        <span className="text-sm font-medium text-white">{alert.title}</span>
                        {alert.acknowledged && (
                          <span className="text-[10px] text-emerald-400 font-mono">ACKNOWLEDGED</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{alert.message}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-600 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(alert.timestamp)}
                        </span>
                        <span>source: {alert.source}</span>
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <button
                        onClick={() => onAcknowledge(alert.id)}
                        className="shrink-0 p-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                        title="Acknowledge"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    {alert.acknowledged && (
                      <XCircle className="shrink-0 w-4 h-4 text-slate-700 mt-1" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
