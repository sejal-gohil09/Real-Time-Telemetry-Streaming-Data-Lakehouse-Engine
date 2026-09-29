import { useMemo, useState } from 'react';
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  Wifi,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Layers,
  GitBranch,
} from 'lucide-react';
import { getNodes, type NodeInfo } from '@/lib/telemetry';

interface TopologyProps {
  nodes: NodeInfo[];
}

const TYPE_ICONS: Record<string, typeof Server> = {
  broker: Server,
  worker: Cpu,
  coordinator: GitBranch,
  storage: HardDrive,
  ingest: Wifi,
};

const TYPE_COLORS: Record<string, string> = {
  broker: '#22d3ee',
  worker: '#8b5cf6',
  coordinator: '#3b82f6',
  storage: '#10b981',
  ingest: '#f59e0b',
};

const STATUS_COLORS: Record<string, string> = {
  healthy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  degraded: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  down: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  healthy: CheckCircle2,
  degraded: AlertTriangle,
  down: XCircle,
};

export function Topology({ nodes }: TopologyProps) {
  const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(nodes[0] || null);
  const allNodes = useMemo(() => getNodes(), []);

  // Merge live data with static fallback
  const displayNodes = nodes.length > 0 ? nodes : allNodes;

  const byRegion = useMemo(() => {
    const regions: Record<string, NodeInfo[]> = {};
    displayNodes.forEach((n) => {
      if (!regions[n.region]) regions[n.region] = [];
      regions[n.region].push(n);
    });
    return regions;
  }, [displayNodes]);

  const byType = useMemo(() => {
    const types: Record<string, NodeInfo[]> = {};
    displayNodes.forEach((n) => {
      if (!types[n.type]) types[n.type] = [];
      types[n.type].push(n);
    });
    return types;
  }, [displayNodes]);

  const avgCpu = displayNodes.filter((n) => n.status !== 'down').reduce((s, n) => s + n.cpu, 0) / (displayNodes.filter((n) => n.status !== 'down').length || 1);
  const avgMem = displayNodes.filter((n) => n.status !== 'down').reduce((s, n) => s + n.memory, 0) / (displayNodes.filter((n) => n.status !== 'down').length || 1);
  const totalConnections = displayNodes.reduce((s, n) => s + n.connections, 0);

  return (
    <div className="p-6 space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-cyan-400" />
            <p className="text-xs text-slate-500">Total Nodes</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{displayNodes.length}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-4 h-4 text-violet-400" />
            <p className="text-xs text-slate-500">Avg CPU</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{avgCpu.toFixed(0)}<span className="text-xs text-slate-500 ml-1">%</span></p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-slate-500">Avg Memory</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{avgMem.toFixed(0)}<span className="text-xs text-slate-500 ml-1">%</span></p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-slate-500">Connections</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">{(totalConnections / 1000).toFixed(1)}K</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Topology map */}
        <div className="lg:col-span-8 bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Infrastructure Topology</h3>
          <div className="space-y-5">
            {Object.entries(byRegion).map(([region, regionNodes]) => (
              <div key={region}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-cyan-500 rounded-full" />
                  <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider">{region}</h4>
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-xs text-slate-600 font-mono">{regionNodes.length} nodes</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {regionNodes.map((n) => {
                    const Icon = TYPE_ICONS[n.type] || Server;
                    const color = TYPE_COLORS[n.type] || '#3b82f6';
                    const StatusIcon = STATUS_ICONS[n.status] || CheckCircle2;
                    return (
                      <button
                        key={n.id}
                        onClick={() => setSelectedNode(n)}
                        className={`p-3 rounded-lg border transition-all text-left group ${
                          selectedNode?.id === n.id
                            ? 'bg-slate-800/60 border-cyan-500/40'
                            : 'bg-slate-800/20 border-slate-800 hover:border-slate-700'
                        } ${n.status === 'down' ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${color}15` }}
                          >
                            <Icon className="w-4 h-4" style={{ color }} />
                          </div>
                          <StatusIcon
                            className={`w-4 h-4 ${
                              n.status === 'healthy' ? 'text-emerald-400' : n.status === 'degraded' ? 'text-amber-400' : 'text-red-400'
                            }`}
                          />
                        </div>
                        <p className="text-xs font-mono text-slate-200 truncate">{n.name}</p>
                        <p className="text-[10px] text-slate-500 capitalize mt-0.5">{n.type}</p>
                        {n.status !== 'down' && (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-slate-600 w-6">CPU</span>
                              <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${n.cpu > 80 ? 'bg-red-500' : n.cpu > 60 ? 'bg-amber-500' : 'bg-cyan-500'}`}
                                  style={{ width: `${n.cpu}%` }}
                                />
                              </div>
                              <span className="text-[9px] text-slate-500 font-mono w-7 text-right">{n.cpu}%</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-slate-600 w-6">MEM</span>
                              <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${n.memory > 80 ? 'bg-red-500' : n.memory > 60 ? 'bg-amber-500' : 'bg-violet-500'}`}
                                  style={{ width: `${n.memory}%` }}
                                />
                              </div>
                              <span className="text-[9px] text-slate-500 font-mono w-7 text-right">{n.memory}%</span>
                            </div>
                          </div>
                        )}
                        {n.status === 'down' && (
                          <p className="text-[10px] text-red-400 mt-2 font-mono">UNREACHABLE</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Type legend */}
          <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-4">
            {Object.entries(TYPE_COLORS).map(([type, color]) => {
              const Icon = TYPE_ICONS[type] || Server;
              return (
                <div key={type} className="flex items-center gap-2">
                  <Icon className="w-3 h-3" style={{ color }} />
                  <span className="text-[10px] text-slate-500 capitalize font-mono">{type}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Node detail */}
        <div className="lg:col-span-4 bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Node Details</h3>
          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${TYPE_COLORS[selectedNode.type]}15` }}
                  >
                    {(() => {
                      const Icon = TYPE_ICONS[selectedNode.type] || Server;
                      return <Icon className="w-5 h-5" style={{ color: TYPE_COLORS[selectedNode.type] }} />;
                    })()}
                  </div>
                  <div>
                    <p className="text-sm font-mono font-bold text-white">{selectedNode.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{selectedNode.type} · {selectedNode.region}</p>
                  </div>
                </div>
                <span className={`inline-block text-xs px-2 py-1 rounded border font-mono ${STATUS_COLORS[selectedNode.status]}`}>
                  {selectedNode.status.toUpperCase()}
                </span>
              </div>

              {selectedNode.status !== 'down' ? (
                <>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">CPU Usage</span>
                        <span className="text-xs font-mono text-white">{selectedNode.cpu}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${selectedNode.cpu > 80 ? 'bg-red-500' : selectedNode.cpu > 60 ? 'bg-amber-500' : 'bg-cyan-500'}`}
                          style={{ width: `${selectedNode.cpu}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">Memory Usage</span>
                        <span className="text-xs font-mono text-white">{selectedNode.memory}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${selectedNode.memory > 80 ? 'bg-red-500' : selectedNode.memory > 60 ? 'bg-amber-500' : 'bg-violet-500'}`}
                          style={{ width: `${selectedNode.memory}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-800">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Connections</p>
                      <p className="text-lg font-bold text-white font-mono mt-0.5">{selectedNode.connections.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-800">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Type</p>
                      <p className="text-lg font-bold text-cyan-400 font-mono mt-0.5 capitalize">{selectedNode.type}</p>
                    </div>
                  </div>

                  <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs text-slate-400">Health Check</span>
                    </div>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Heartbeat</span>
                        <span className="text-emerald-400">OK</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Disk Space</span>
                        <span className={selectedNode.memory > 80 ? 'text-amber-400' : 'text-emerald-400'}>
                          {selectedNode.memory > 80 ? 'WARN' : 'OK'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Network I/O</span>
                        <span className="text-emerald-400">OK</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Replication</span>
                        <span className="text-emerald-400">IN-SYNC</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-400" />
                    <p className="text-sm font-medium text-red-400">Node Unreachable</p>
                  </div>
                  <p className="text-xs text-slate-400">
                    This node is not responding to health checks. Last known status: connection timeout after 30s.
                  </p>
                  <div className="mt-3 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Heartbeat</span>
                      <span className="text-red-400">FAILED</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Auto-restart</span>
                      <span className="text-amber-400">SCHEDULED</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Failover</span>
                      <span className="text-emerald-400">COMPLETED</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-600 text-xs">
              Select a node to inspect
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
