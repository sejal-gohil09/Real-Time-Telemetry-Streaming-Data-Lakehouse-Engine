import {
  LayoutDashboard,
  Radio,
  Database,
  Network,
  Bell,
  Activity,
  Settings,
  Cpu,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

export type ViewKey = 'overview' | 'streams' | 'lakehouse' | 'topology' | 'alerts' | 'recovery' | 'pipeline' | 'settings';

interface SidebarProps {
  active: ViewKey;
  onNavigate: (view: ViewKey) => void;
  alertCount: number;
  ingestRate: number;
}

const NAV_ITEMS: { key: ViewKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'streams', label: 'Event Streams', icon: Radio },
  { key: 'lakehouse', label: 'Lakehouse', icon: Database },
  { key: 'topology', label: 'Topology', icon: Network },
  { key: 'alerts', label: 'Alerts', icon: Bell },
  { key: 'recovery', label: 'Disaster Recovery', icon: ShieldCheck },
  { key: 'pipeline', label: 'Pipeline Spec', icon: Terminal },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ active, onNavigate, alertCount, ingestRate }: SidebarProps) {
  return (
    <aside className="w-60 bg-slate-950 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">TelemetryHub</h1>
            <p className="text-[10px] text-slate-500 font-mono">Data Lakehouse Engine</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {item.key === 'alerts' && alertCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800 space-y-3">
        <div className="px-3 py-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Live Ingest</span>
          </div>
          <div className="text-lg font-bold text-white font-mono">
            {ingestRate >= 1000 ? `${(ingestRate / 1000).toFixed(1)}K` : ingestRate.toFixed(0)}
            <span className="text-xs text-slate-500 ml-1">msg/s</span>
          </div>
          <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min((ingestRate / 580000) * 100, 100)}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 text-[10px] text-slate-600 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>us-east-1 · us-west-2</span>
        </div>
      </div>
    </aside>
  );
}
