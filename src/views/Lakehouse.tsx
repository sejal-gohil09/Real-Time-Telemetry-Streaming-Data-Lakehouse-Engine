import { useState, useMemo } from 'react';
import {
  Database,
  Table2,
  Columns3,
  HardDrive,
  Clock,
  Search,
  Layers,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { getLakehouseTables, type LakehouseTable } from '@/lib/telemetry';

const FORMAT_COLORS: Record<string, string> = {
  Iceberg: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  Delta: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Hudi: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
};

const TYPE_COLORS: Record<string, string> = {
  uuid: 'text-pink-400',
  string: 'text-emerald-400',
  bigint: 'text-amber-400',
  int: 'text-amber-400',
  double: 'text-cyan-400',
  'timestamp(6)': 'text-violet-400',
  'timestamp(3)': 'text-violet-400',
  date: 'text-violet-400',
  'map<string,string>': 'text-blue-400',
  boolean: 'text-red-400',
};

export function Lakehouse() {
  const tables = useMemo(() => getLakehouseTables(), []);
  const [selected, setSelected] = useState<LakehouseTable>(tables[0]);
  const [search, setSearch] = useState('');

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.schema.toLowerCase().includes(search.toLowerCase())
  );

  const totalSize = tables.reduce((sum, t) => {
    const num = parseFloat(t.sizeBytes);
    return sum + num;
  }, 0);
  const totalPartitions = tables.reduce((sum, t) => sum + t.partitions, 0);
  const totalQueries = tables.reduce((sum, t) => sum + t.queryCount, 0);

  return (
    <div className="p-6 space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Table2 className="w-4 h-4 text-cyan-400" />
            <p className="text-xs text-slate-500">Tables</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{tables.length}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-slate-500">Total Size</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{totalSize.toFixed(1)}<span className="text-xs text-slate-500 ml-1">TB+</span></p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-violet-400" />
            <p className="text-xs text-slate-500">Partitions</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{totalPartitions.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-slate-500">Queries Today</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{(totalQueries / 1000).toFixed(1)}K</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Table list */}
        <div className="lg:col-span-4 bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              Tables
            </h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="bg-slate-800/60 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 w-28 focus:outline-none focus:border-cyan-500/50 transition-all"
              />
            </div>
          </div>
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            {filteredTables.map((t) => (
              <button
                key={t.name}
                onClick={() => setSelected(t)}
                className={`w-full text-left px-3 py-3 rounded-lg transition-all ${
                  selected.name === t.name
                    ? 'bg-cyan-500/10 border border-cyan-500/30'
                    : 'border border-transparent hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-slate-200 truncate">{t.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${FORMAT_COLORS[t.format]}`}>
                    {t.format}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-600 font-mono">
                  <span>{t.rowCount} rows</span>
                  <span>{t.sizeBytes}</span>
                  <span>{t.partitions} parts</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Table detail */}
        <div className="lg:col-span-8 bg-slate-900 rounded-xl border border-slate-800 p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white font-mono">{selected.name}</h3>
                <span className={`text-xs px-2 py-1 rounded border ${FORMAT_COLORS[selected.format]}`}>
                  {selected.format}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Schema: <span className="text-slate-400 font-mono">{selected.schema}</span></p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Last Compaction</p>
                <p className="text-xs text-slate-300 font-mono flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {selected.lastCompaction}
                </p>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Rows</p>
              <p className="text-lg font-bold text-white font-mono mt-0.5">{selected.rowCount}</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Size</p>
              <p className="text-lg font-bold text-white font-mono mt-0.5">{selected.sizeBytes}</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Partitions</p>
              <p className="text-lg font-bold text-white font-mono mt-0.5">{selected.partitions.toLocaleString()}</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Avg Query</p>
              <p className="text-lg font-bold text-cyan-400 font-mono mt-0.5">{selected.avgQueryMs}<span className="text-xs text-slate-500 ml-1">ms</span></p>
            </div>
          </div>

          {/* Column list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Columns3 className="w-4 h-4 text-slate-500" />
                Schema Definition
              </h4>
              <span className="text-xs text-slate-500 font-mono">{selected.columns.length} columns</span>
            </div>
            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/40 border-b border-slate-800">
                    <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider px-4 py-2 font-medium">Column</th>
                    <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider px-4 py-2 font-medium">Type</th>
                    <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider px-4 py-2 font-medium">Partition Key</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.columns.map((col, i) => (
                    <tr
                      key={col.name}
                      className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? 'bg-slate-800/10' : ''}`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {col.partition && (
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          )}
                          <span className="text-xs font-mono text-slate-200">{col.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-mono ${TYPE_COLORS[col.type] || 'text-slate-400'}`}>
                          {col.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {col.partition ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                            PARTITION
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Query stats */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <p className="text-xs text-slate-400">Query Volume</p>
              </div>
              <p className="text-xl font-bold text-white font-mono">{selected.queryCount.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">queries in last 24h</p>
              <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                  style={{ width: `${Math.min((selected.queryCount / 90000) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <p className="text-xs text-slate-400">Query Performance</p>
              </div>
              <p className="text-xl font-bold text-white font-mono">{selected.avgQueryMs}<span className="text-sm text-slate-500 ml-1">ms avg</span></p>
              <p className="text-[10px] text-slate-500 mt-0.5">p95 response time</p>
              <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${selected.avgQueryMs > 200 ? 'bg-red-500' : selected.avgQueryMs > 100 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min((selected.avgQueryMs / 400) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
