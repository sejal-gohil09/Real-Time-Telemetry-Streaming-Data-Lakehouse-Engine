import { Search, RefreshCw, Clock, Filter } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TopbarProps {
  title: string;
  subtitle: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search topics, tables, events..."
              className="bg-slate-800/60 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 w-64 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>
          <button className="p-2 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all">
            <Filter className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-mono text-slate-300">
              {time.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">Streaming</span>
          </div>
        </div>
      </div>
    </header>
  );
}
