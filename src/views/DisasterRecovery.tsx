import { useState, useMemo } from 'react';
import {
  History,
  RotateCcw,
  DatabaseBackup,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Layers,
  HardDrive,
  Activity,
} from 'lucide-react';

interface SnapshotRecord {
  id: string;
  version: number;
  timestamp: string;
  type: 'scheduled' | 'manual' | 'pre-migration' | 'ci-triggered';
  table: string;
  size: string;
  partitions: number;
  status: 'healthy' | 'restored' | 'failed';
  notes: string;
}

const SNAPSHOTS: SnapshotRecord[] = [
  { id: 'snap-029', version: 29, timestamp: '2026-09-29 14:00', type: 'scheduled', table: 'agg_throughput_hourly', size: '64 GB', partitions: 168, status: 'healthy', notes: 'Hourly automated checkpoint' },
  { id: 'snap-028', version: 28, timestamp: '2026-09-29 13:00', type: 'scheduled', table: 'agg_throughput_hourly', size: '63.8 GB', partitions: 167, status: 'healthy', notes: 'Hourly automated checkpoint' },
  { id: 'snap-027', version: 27, timestamp: '2026-09-29 12:30', type: 'pre-migration', table: 'fact_telemetry_events', size: '2.1 TB', partitions: 1440, status: 'healthy', notes: 'Pre-dbt migration checkpoint' },
  { id: 'snap-026', version: 26, timestamp: '2026-09-29 12:00', type: 'scheduled', table: 'agg_throughput_hourly', size: '63.5 GB', partitions: 166, status: 'healthy', notes: 'Hourly automated checkpoint' },
  { id: 'snap-025', version: 25, timestamp: '2026-09-29 10:15', type: 'manual', table: 'fact_audit_log', size: '180 GB', partitions: 365, status: 'healthy', notes: 'Manual snapshot before schema change' },
  { id: 'snap-024', version: 24, timestamp: '2026-09-29 09:00', type: 'scheduled', table: 'agg_throughput_hourly', size: '63.1 GB', partitions: 165, status: 'restored', notes: 'Restored after data corruption detected' },
  { id: 'snap-023', version: 23, timestamp: '2026-09-29 08:00', type: 'scheduled', table: 'agg_throughput_hourly', size: '62.9 GB', partitions: 164, status: 'failed', notes: 'Checkpoint failed — S3 transient error' },
  { id: 'snap-022', version: 22, timestamp: '2026-09-28 22:00', type: 'ci-triggered', table: 'fact_telemetry_events', size: '2.08 TB', partitions: 1438, status: 'healthy', notes: 'CI build checkpoint (PR #142 merge)' },
  { id: 'snap-021', version: 21, timestamp: '2026-09-28 18:00', type: 'manual', table: 'dim_devices', size: '1.2 GB', partitions: 1, status: 'healthy', notes: 'Manual snapshot before device registry update' },
  { id: 'snap-020', version: 20, timestamp: '2026-09-28 12:00', type: 'scheduled', table: 'agg_error_summary_daily', size: '8.4 GB', partitions: 90, status: 'healthy', notes: 'Daily error summary checkpoint' },
];

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'SCHEDULED', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  manual: { label: 'MANUAL', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  'pre-migration': { label: 'PRE-MIGRATION', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  'ci-triggered': { label: 'CI-TRIGGERED', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  healthy: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Healthy' },
  restored: { icon: RotateCcw, color: 'text-blue-400', label: 'Restored' },
  failed: { icon: AlertTriangle, color: 'text-red-400', label: 'Failed' },
};

export function DisasterRecovery() {
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotRecord | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'restoring' | 'complete'>('idle');

  const stats = useMemo(() => {
    const healthy = SNAPSHOTS.filter((s) => s.status === 'healthy').length;
    const restored = SNAPSHOTS.filter((s) => s.status === 'restored').length;
    const failed = SNAPSHOTS.filter((s) => s.status === 'failed').length;
    const totalSize = SNAPSHOTS.reduce((sum, s) => {
      const num = parseFloat(s.size);
      return sum + (s.size.includes('TB') ? num * 1024 : num);
    }, 0);
    return { healthy, restored, failed, totalSize };
  }, []);

  const handleRestore = (snap: SnapshotRecord) => {
    setSelectedSnapshot(snap);
    setRestoreStatus('restoring');
    setTimeout(() => setRestoreStatus('complete'), 2000);
  };

  const resetRestore = () => {
    setRestoreStatus('idle');
    setSelectedSnapshot(null);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Camera className="w-4 h-4 text-cyan-400" />
            <p className="text-xs text-slate-500">Total Snapshots</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{SNAPSHOTS.length}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-emerald-500/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-slate-500">Healthy</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-mono">{stats.healthy}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-blue-500/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <RotateCcw className="w-4 h-4 text-blue-400" />
            <p className="text-xs text-slate-500">Restored</p>
          </div>
          <p className="text-2xl font-bold text-blue-400 font-mono">{stats.restored}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <HardDrive className="w-4 h-4 text-violet-400" />
            <p className="text-xs text-slate-500">Snapshot Storage</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{stats.totalSize.toFixed(0)}<span className="text-xs text-slate-500 ml-1">GB</span></p>
        </div>
      </div>

      {/* Delta Lake explanation banner */}
      <div className="bg-gradient-to-r from-blue-500/5 to-cyan-500/5 rounded-xl border border-blue-500/20 p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <DatabaseBackup className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Delta Lake Time Travel & Disaster Recovery</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Delta Lake stores transaction logs (delta logs) alongside data files, enabling ACID-compliant time travel.
              Every checkpoint creates a versioned snapshot of the table state. You can query any past version, roll back
              to a previous snapshot, or recover from corruption — all without shutting down the pipeline.
              The <span className="text-blue-400 font-mono">VERSION AS OF</span> and <span className="text-blue-400 font-mono">TIMESTAMP AS OF</span> clauses
              let you read table data as it existed at any point in time.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Snapshot timeline */}
        <div className="lg:col-span-7 bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              Snapshot Timeline
            </h3>
            <span className="text-xs text-slate-500 font-mono">Delta Lake _delta_log</span>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto">
            {SNAPSHOTS.map((snap) => {
              const typeCfg = TYPE_CONFIG[snap.type];
              const statusCfg = STATUS_CONFIG[snap.status];
              const StatusIcon = statusCfg.icon;
              return (
                <div
                  key={snap.id}
                  className={`px-4 py-3 rounded-lg border transition-all ${
                    selectedSnapshot?.id === snap.id
                      ? 'bg-cyan-500/10 border-cyan-500/30'
                      : 'bg-slate-800/30 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-300">v{snap.version}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${typeCfg.bg} ${typeCfg.color}`}>
                        {typeCfg.label}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] font-mono ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-600 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {snap.timestamp}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                    <span className="text-slate-300">{snap.table}</span>
                    <span>{snap.size}</span>
                    <span>{snap.partitions} parts</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-slate-600">{snap.notes}</p>
                    {snap.status !== 'failed' && (
                      <button
                        onClick={() => handleRestore(snap)}
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-400 transition-colors font-mono"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Restore panel + RPO/RTO */}
        <div className="lg:col-span-5 space-y-4">
          {/* Restore simulation */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <RotateCcw className="w-4 h-4 text-blue-400" />
              Restore Operation
            </h3>

            {restoreStatus === 'idle' && (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <DatabaseBackup className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-xs text-slate-500">Select a snapshot and click Restore to simulate a time-travel rollback</p>
              </div>
            )}

            {restoreStatus === 'restoring' && (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <div className="relative">
                  <RotateCcw className="w-10 h-10 text-cyan-400 animate-spin" />
                </div>
                <p className="text-xs text-cyan-400 font-mono mt-4">Restoring to v{selectedSnapshot?.version}...</p>
                <p className="text-[10px] text-slate-600 mt-1 font-mono">Rolling back delta log transaction</p>
              </div>
            )}

            {restoreStatus === 'complete' && selectedSnapshot && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-semibold">Restore Complete</span>
                </div>
                <div className="bg-slate-800/40 rounded-lg border border-slate-800 p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Table</span>
                    <span className="text-slate-200 font-mono">{selectedSnapshot.table}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Restored to</span>
                    <span className="text-cyan-400 font-mono">v{selectedSnapshot.version}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Timestamp</span>
                    <span className="text-slate-300 font-mono">{selectedSnapshot.timestamp}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Size</span>
                    <span className="text-slate-300 font-mono">{selectedSnapshot.size}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Partitions</span>
                    <span className="text-slate-300 font-mono">{selectedSnapshot.partitions.toLocaleString()}</span>
                  </div>
                </div>
                <div className="bg-emerald-500/5 rounded-lg border border-emerald-500/20 p-3">
                  <p className="text-[10px] text-emerald-400 font-mono leading-relaxed">
                    Delta Lake RESTORE: rolled back {selectedSnapshot.table} to version {selectedSnapshot.version}.<br />
                    Old data files retained for 7-day vacuum window.<br />
                   下游 consumers will see consistent state on next read.
                  </p>
                </div>
                <button
                  onClick={resetRestore}
                  className="w-full py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all"
                >
                  Done
                </button>
              </div>
            )}
          </div>

          {/* RPO / RTO metrics */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Recovery Objectives
            </h3>
            <div className="space-y-3">
              <div className="bg-slate-800/40 rounded-lg border border-slate-800 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">RPO (Recovery Point Objective)</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">15 min</span>
                </div>
                <p className="text-[10px] text-slate-600">Maximum data loss from scheduled checkpoint interval</p>
                <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '15%' }} />
                </div>
              </div>
              <div className="bg-slate-800/40 rounded-lg border border-slate-800 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">RTO (Recovery Time Objective)</span>
                  <span className="text-sm font-bold text-cyan-400 font-mono">4 min</span>
                </div>
                <p className="text-[10px] text-slate-600">Time to restore from snapshot to live</p>
                <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full" style={{ width: '8%' }} />
                </div>
              </div>
              <div className="bg-slate-800/40 rounded-lg border border-slate-800 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">Snapshot Retention</span>
                  <span className="text-sm font-bold text-violet-400 font-mono">30 days</span>
                </div>
                <p className="text-[10px] text-slate-600">Delta log vacuum grace period before old files are deleted</p>
                <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* DR strategy flow */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-amber-400" />
              DR Strategy Flow
            </h3>
            <div className="space-y-2">
              {[
                { step: '1', label: 'Detect corruption', desc: 'Schema validation or data quality test fails', icon: AlertTriangle, color: 'text-red-400' },
                { step: '2', label: 'Identify last healthy snapshot', desc: 'Query delta log for latest healthy version', icon: History, color: 'text-amber-400' },
                { step: '3', label: 'Restore table to version', desc: 'RESTORE TABLE TO VERSION <n>', icon: RotateCcw, color: 'text-cyan-400' },
                { step: '4', label: 'Verify data integrity', desc: 'Run dbt tests against restored snapshot', icon: ShieldCheck, color: 'text-emerald-400' },
                { step: '5', label: 'Resume downstream consumers', desc: 'Kafka consumers resume from restored state', icon: CheckCircle2, color: 'text-emerald-400' },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center ${s.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      {i < 4 && <div className="w-px h-4 bg-slate-800 mt-1" />}
                    </div>
                    <div className="pb-1">
                      <p className="text-xs font-medium text-slate-200">{s.label}</p>
                      <p className="text-[10px] text-slate-600 font-mono">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Delta Lake features grid */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-blue-400" />
          Delta Lake DR Capabilities
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { title: 'Time Travel', desc: 'Query any past version with VERSION AS OF or TIMESTAMP AS OF', icon: Clock, color: 'text-cyan-400' },
            { title: 'ACID Rollback', desc: 'Failed writes are automatically rolled back via delta log', icon: RotateCcw, color: 'text-blue-400' },
            { title: 'Vacuum Safety', desc: 'Old files retained for configurable grace period before cleanup', icon: HardDrive, color: 'text-violet-400' },
            { title: 'Schema Enforcement', desc: 'Rejects writes that violate the registered schema', icon: ShieldCheck, color: 'text-emerald-400' },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-slate-800/30 rounded-lg border border-slate-800 p-4 hover:border-slate-700 transition-all">
                <Icon className={`w-5 h-5 ${f.color} mb-2`} />
                <p className="text-sm font-medium text-white mb-1">{f.title}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
