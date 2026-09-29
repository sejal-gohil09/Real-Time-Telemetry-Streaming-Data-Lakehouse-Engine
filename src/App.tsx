import { useState } from 'react';
import { Sidebar, type ViewKey } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { EnergyOverview } from '@/views/EnergyOverview';
import { Overview } from '@/views/Overview';
import { EventStreams } from '@/views/EventStreams';
import { Lakehouse } from '@/views/Lakehouse';
import { Topology } from '@/views/Topology';
import { Alerts } from '@/views/Alerts';
import { Settings } from '@/views/Settings';
import { DisasterRecovery } from '@/views/DisasterRecovery';
import { PipelineSpec } from '@/views/PipelineSpec';
import { useTelemetryEngine } from '@/hooks/useTelemetryEngine';

const VIEW_META: Record<ViewKey, { title: string; subtitle: string }> = {
  overview: { title: 'Energy Dashboard', subtitle: 'Real UK smart meter data, carbon intensity, and settlement analytics' },
  streams: { title: 'Event Streams', subtitle: 'Live Kafka topic consumer and event inspection' },
  lakehouse: { title: 'Data Lakehouse', subtitle: 'Apache Iceberg / Delta Lake table catalog and schema explorer' },
  topology: { title: 'Infrastructure Topology', subtitle: 'Cluster node health across regions and availability zones' },
  alerts: { title: 'Alerts & Notifications', subtitle: 'Active alerts, threshold breaches, and acknowledgment history' },
  recovery: { title: 'Disaster Recovery', subtitle: 'Delta Lake snapshot management, time travel, and table restoration' },
  pipeline: { title: 'Pipeline Spec', subtitle: 'Backend architecture, SQL tuning, and PySpark streaming code' },
  settings: { title: 'Settings', subtitle: 'Cluster configuration, retention, scaling, and notification preferences' },
};

function App() {
  const [view, setView] = useState<ViewKey>('overview');
  const { metrics, events, alerts, nodes, acknowledgeAlert, clearAlerts, injectIncident } = useTelemetryEngine(1500);

  const activeAlerts = alerts.filter((a) => !a.acknowledged).length;
  const ingestRate = metrics.find((m) => m.key === 'ingestRate')?.value ?? 0;
  const meta = VIEW_META[view];

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar active={view} onNavigate={setView} alertCount={activeAlerts} ingestRate={ingestRate} />
      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar title={meta.title} subtitle={meta.subtitle} />
        <div className="flex-1 overflow-y-auto">
          {view === 'overview' && <EnergyOverview />}
          {view === 'streams' && <EventStreams events={events} />}
          {view === 'lakehouse' && <Lakehouse />}
          {view === 'topology' && <Topology nodes={nodes} />}
          {view === 'alerts' && <Alerts alerts={alerts} onAcknowledge={acknowledgeAlert} onClear={clearAlerts} onInjectIncident={injectIncident} />}
          {view === 'recovery' && <DisasterRecovery />}
          {view === 'pipeline' && <PipelineSpec />}
          {view === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}

export default App;
