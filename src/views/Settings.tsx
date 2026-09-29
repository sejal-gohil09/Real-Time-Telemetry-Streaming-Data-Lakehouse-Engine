import { useState } from 'react';
import { Settings as SettingsIcon, Bell, Server, Database, Shield, Sliders } from 'lucide-react';

export function Settings() {
  const [retention, setRetention] = useState(7);
  const [replication, setReplication] = useState(3);
  const [compaction, setCompaction] = useState(60);
  const [autoScale, setAutoScale] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackAlerts, setSlackAlerts] = useState(false);

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      {/* Stream config */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <Server className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Stream Configuration</h3>
            <p className="text-xs text-slate-500">Kafka cluster parameters</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-300">Default Retention Period</label>
              <span className="text-sm font-mono text-cyan-400">{retention} days</span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              value={retention}
              onChange={(e) => setRetention(Number(e.target.value))}
              className="w-full accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-mono">
              <span>1d</span><span>15d</span><span>30d</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-300">Replication Factor</label>
              <span className="text-sm font-mono text-cyan-400">{replication}</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map((r) => (
                <button
                  key={r}
                  onClick={() => setReplication(r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-mono transition-all ${
                    replication === r
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'bg-slate-800/40 text-slate-400 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-300">Compaction Interval</label>
              <span className="text-sm font-mono text-cyan-400">{compaction} min</span>
            </div>
            <input
              type="range"
              min={15}
              max={240}
              step={15}
              value={compaction}
              onChange={(e) => setCompaction(Number(e.target.value))}
              className="w-full accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-mono">
              <span>15m</span><span>120m</span><span>240m</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lakehouse config */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Lakehouse Engine</h3>
            <p className="text-xs text-slate-500">Table format and query engine</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {['Iceberg', 'Delta Lake', 'Apache Hudi'].map((fmt, i) => (
            <div
              key={fmt}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                i === 0
                  ? 'bg-cyan-500/10 border-cyan-500/30'
                  : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{fmt}</span>
                {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500 text-white font-mono">ACTIVE</span>}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {i === 0 ? 'Primary table format' : 'Available fallback'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Auto-scaling */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Sliders className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Auto-Scaling</h3>
            <p className="text-xs text-slate-500">Cluster elasticity controls</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-800">
          <div>
            <p className="text-sm text-white">Enable auto-scaling</p>
            <p className="text-xs text-slate-500 mt-0.5">Automatically add/remove consumer nodes based on lag</p>
          </div>
          <button
            onClick={() => setAutoScale(!autoScale)}
            className={`relative w-11 h-6 rounded-full transition-colors ${autoScale ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                autoScale ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <p className="text-xs text-slate-500">Alert delivery channels</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <div>
              <p className="text-sm text-white">Email notifications</p>
              <p className="text-xs text-slate-500 mt-0.5">Send critical alerts to ops@telemetryhub.io</p>
            </div>
            <button
              onClick={() => setEmailAlerts(!emailAlerts)}
              className={`relative w-11 h-6 rounded-full transition-colors ${emailAlerts ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  emailAlerts ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <div>
              <p className="text-sm text-white">Slack integration</p>
              <p className="text-xs text-slate-500 mt-0.5">Post alerts to #telemetry-alerts channel</p>
            </div>
            <button
              onClick={() => setSlackAlerts(!slackAlerts)}
              className={`relative w-11 h-6 rounded-full transition-colors ${slackAlerts ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  slackAlerts ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Security</h3>
            <p className="text-xs text-slate-500">Access control and encryption</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">TLS encryption: <span className="text-emerald-400 font-mono">ENABLED</span></span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">SASL auth: <span className="text-emerald-400 font-mono">ENABLED</span></span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">At-rest encryption: <span className="text-emerald-400 font-mono">AES-256</span></span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">Audit logging: <span className="text-emerald-400 font-mono">ENABLED</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
