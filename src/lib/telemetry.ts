export type MetricKey =
  | 'ingestRate'
  | 'throughput'
  | 'latency'
  | 'errorRate'
  | 'cpuLoad'
  | 'memoryUsage'
  | 'storageUsed'
  | 'activeConsumers';

export interface MetricSeries {
  key: MetricKey;
  label: string;
  unit: string;
  value: number;
  history: number[];
  min: number;
  max: number;
  threshold: { warning: number; critical: number };
}

export interface StreamEvent {
  id: string;
  topic: string;
  partition: number;
  offset: number;
  key: string;
  payload: Record<string, unknown>;
  timestamp: number;
  latencyMs: number;
  status: 'ok' | 'warn' | 'error';
}

export interface TopicInfo {
  name: string;
  partitions: number;
  replication: number;
  retention: string;
  throughput: number;
  lag: number;
  consumers: number;
  category: 'telemetry' | 'events' | 'logs' | 'metrics' | 'traces';
}

export interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  source: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface LakehouseTable {
  name: string;
  schema: string;
  format: 'Iceberg' | 'Delta' | 'Hudi';
  columns: { name: string; type: string; partition: boolean }[];
  partitions: number;
  rowCount: string;
  sizeBytes: string;
  lastCompaction: string;
  queryCount: number;
  avgQueryMs: number;
}

export interface NodeInfo {
  id: string;
  name: string;
  type: 'broker' | 'worker' | 'coordinator' | 'storage' | 'ingest';
  status: 'healthy' | 'degraded' | 'down';
  region: string;
  cpu: number;
  memory: number;
  connections: number;
}

const TOPICS: TopicInfo[] = [
  { name: 'telemetry.uk.smartmeters.halfhourly', partitions: 48, replication: 3, retention: '365d', throughput: 240000, lag: 180, consumers: 12, category: 'telemetry' },
  { name: 'events.uk.elexon.settlement', partitions: 24, replication: 3, retention: '2555d', throughput: 38400, lag: 42, consumers: 6, category: 'events' },
  { name: 'telemetry.iot.devices', partitions: 12, replication: 3, retention: '7d', throughput: 84200, lag: 340, consumers: 6, category: 'telemetry' },
  { name: 'events.user.activity', partitions: 8, replication: 3, retention: '30d', throughput: 45100, lag: 12, consumers: 4, category: 'events' },
  { name: 'logs.application', partitions: 16, replication: 2, retention: '3d', throughput: 128400, lag: 8900, consumers: 8, category: 'logs' },
  { name: 'metrics.system', partitions: 6, replication: 3, retention: '14d', throughput: 67300, lag: 45, consumers: 5, category: 'metrics' },
  { name: 'traces.distributed', partitions: 10, replication: 3, retention: '5d', throughput: 32800, lag: 0, consumers: 3, category: 'traces' },
  { name: 'events.billing.transactions', partitions: 4, replication: 3, retention: '90d', throughput: 9200, lag: 0, consumers: 2, category: 'events' },
  { name: 'telemetry.vehicle.fleet', partitions: 14, replication: 2, retention: '7d', throughput: 56100, lag: 1200, consumers: 7, category: 'telemetry' },
  { name: 'logs.audit.security', partitions: 6, replication: 3, retention: '365d', throughput: 3400, lag: 0, consumers: 2, category: 'logs' },
];

const LAKEHOUSE_TABLES: LakehouseTable[] = [
  {
    name: 'fact_elexon_settlement_metering',
    schema: 'uk_energy',
    format: 'Iceberg',
    columns: [
      { name: 'settlement_key', type: 'uuid', partition: false },
      { name: 'mpan', type: 'string', partition: true },
      { name: 'customer_id', type: 'string', partition: false },
      { name: 'settlement_date', type: 'date', partition: true },
      { name: 'settlement_period', type: 'int', partition: false },
      { name: 'kwh_consumed', type: 'double', partition: false },
      { name: 'carbon_intensity_gco2_kwh', type: 'double', partition: false },
      { name: 'carbon_emissions_kg', type: 'double', partition: false },
      { name: 'estimated_cost_gbp', type: 'double', partition: false },
      { name: 'tariff_band', type: 'string', partition: false },
      { name: 'nation', type: 'string', partition: true },
      { name: 'region_id', type: 'string', partition: false },
    ],
    partitions: 6720,
    rowCount: '8.4B',
    sizeBytes: '3.2 TB',
    lastCompaction: '2h ago',
    queryCount: 28100,
    avgQueryMs: 185,
  },
  {
    name: 'dim_uk_gsp_regions',
    schema: 'uk_energy',
    format: 'Iceberg',
    columns: [
      { name: 'region_id', type: 'string', partition: true },
      { name: 'shortname', type: 'string', partition: false },
      { name: 'nation', type: 'string', partition: false },
      { name: 'gsp_group', type: 'string', partition: false },
      { name: 'population_2024', type: 'int', partition: false },
      { name: 'population_rank', type: 'int', partition: false },
    ],
    partitions: 14,
    rowCount: '14',
    sizeBytes: '8 KB',
    lastCompaction: '1d ago',
    queryCount: 92100,
    avgQueryMs: 12,
  },
  {
    name: 'fact_telemetry_events',
    schema: 'telemetry',
    format: 'Iceberg',
    columns: [
      { name: 'event_id', type: 'uuid', partition: false },
      { name: 'device_id', type: 'string', partition: true },
      { name: 'event_type', type: 'string', partition: false },
      { name: 'timestamp', type: 'timestamp(6)', partition: true },
      { name: 'value', type: 'double', partition: false },
      { name: 'unit', type: 'string', partition: false },
      { name: 'quality', type: 'int', partition: false },
      { name: 'metadata', type: 'map<string,string>', partition: false },
    ],
    partitions: 1440,
    rowCount: '8.4B',
    sizeBytes: '2.1 TB',
    lastCompaction: '4h ago',
    queryCount: 18420,
    avgQueryMs: 340,
  },
  {
    name: 'fact_user_sessions',
    schema: 'analytics',
    format: 'Iceberg',
    columns: [
      { name: 'session_id', type: 'uuid', partition: false },
      { name: 'user_id', type: 'bigint', partition: true },
      { name: 'session_start', type: 'timestamp(6)', partition: true },
      { name: 'session_end', type: 'timestamp(6)', partition: false },
      { name: 'page_views', type: 'int', partition: false },
      { name: 'duration_s', type: 'int', partition: false },
      { name: 'device_type', type: 'string', partition: false },
      { name: 'country', type: 'string', partition: false },
    ],
    partitions: 720,
    rowCount: '1.2B',
    sizeBytes: '480 GB',
    lastCompaction: '1h ago',
    queryCount: 9830,
    avgQueryMs: 210,
  },
  {
    name: 'agg_throughput_hourly',
    schema: 'telemetry',
    format: 'Delta',
    columns: [
      { name: 'topic', type: 'string', partition: true },
      { name: 'hour_bucket', type: 'timestamp(3)', partition: true },
      { name: 'msg_count', type: 'bigint', partition: false },
      { name: 'bytes_in', type: 'bigint', partition: false },
      { name: 'bytes_out', type: 'bigint', partition: false },
      { name: 'p99_latency_ms', type: 'double', partition: false },
      { name: 'error_count', type: 'bigint', partition: false },
    ],
    partitions: 168,
    rowCount: '320M',
    sizeBytes: '64 GB',
    lastCompaction: '30m ago',
    queryCount: 42100,
    avgQueryMs: 95,
  },
  {
    name: 'dim_devices',
    schema: 'telemetry',
    format: 'Iceberg',
    columns: [
      { name: 'device_id', type: 'string', partition: true },
      { name: 'device_type', type: 'string', partition: false },
      { name: 'firmware_version', type: 'string', partition: false },
      { name: 'region', type: 'string', partition: false },
      { name: 'registered_at', type: 'timestamp(6)', partition: false },
      { name: 'status', type: 'string', partition: false },
    ],
    partitions: 1,
    rowCount: '2.4M',
    sizeBytes: '1.2 GB',
    lastCompaction: '12h ago',
    queryCount: 87400,
    avgQueryMs: 28,
  },
  {
    name: 'fact_audit_log',
    schema: 'security',
    format: 'Hudi',
    columns: [
      { name: 'audit_id', type: 'uuid', partition: false },
      { name: 'actor', type: 'string', partition: false },
      { name: 'action', type: 'string', partition: false },
      { name: 'resource', type: 'string', partition: false },
      { name: 'timestamp', type: 'timestamp(6)', partition: true },
      { name: 'ip_address', type: 'string', partition: false },
      { name: 'result', type: 'string', partition: false },
    ],
    partitions: 365,
    rowCount: '640M',
    sizeBytes: '180 GB',
    lastCompaction: '6h ago',
    queryCount: 3200,
    avgQueryMs: 180,
  },
  {
    name: 'agg_error_summary_daily',
    schema: 'telemetry',
    format: 'Delta',
    columns: [
      { name: 'day_bucket', type: 'date', partition: true },
      { name: 'topic', type: 'string', partition: true },
      { name: 'error_type', type: 'string', partition: false },
      { name: 'error_count', type: 'bigint', partition: false },
      { name: 'affected_partitions', type: 'int', partition: false },
      { name: 'first_seen', type: 'timestamp(6)', partition: false },
      { name: 'last_seen', type: 'timestamp(6)', partition: false },
    ],
    partitions: 90,
    rowCount: '12M',
    sizeBytes: '8.4 GB',
    lastCompaction: '2h ago',
    queryCount: 15600,
    avgQueryMs: 52,
  },
];

const NODES: NodeInfo[] = [
  { id: 'n1', name: 'kafka-broker-01', type: 'broker', status: 'healthy', region: 'us-east-1', cpu: 42, memory: 61, connections: 1840 },
  { id: 'n2', name: 'kafka-broker-02', type: 'broker', status: 'healthy', region: 'us-east-1', cpu: 38, memory: 55, connections: 1620 },
  { id: 'n3', name: 'kafka-broker-03', type: 'broker', status: 'degraded', region: 'us-west-2', cpu: 87, memory: 78, connections: 2100 },
  { id: 'n4', name: 'spark-worker-01', type: 'worker', status: 'healthy', region: 'us-east-1', cpu: 55, memory: 70, connections: 12 },
  { id: 'n5', name: 'spark-worker-02', type: 'worker', status: 'healthy', region: 'us-east-1', cpu: 48, memory: 65, connections: 8 },
  { id: 'n6', name: 'spark-worker-03', type: 'worker', status: 'healthy', region: 'us-west-2', cpu: 62, memory: 73, connections: 15 },
  { id: 'n7', name: 'coordinator-01', type: 'coordinator', status: 'healthy', region: 'us-east-1', cpu: 31, memory: 44, connections: 320 },
  { id: 'n8', name: 'coordinator-02', type: 'coordinator', status: 'healthy', region: 'us-west-2', cpu: 28, memory: 41, connections: 280 },
  { id: 'n9', name: 's3-storage-gateway', type: 'storage', status: 'healthy', region: 'us-east-1', cpu: 22, memory: 38, connections: 940 },
  { id: 'n10', name: 's3-storage-gateway-w', type: 'storage', status: 'healthy', region: 'us-west-2', cpu: 19, memory: 35, connections: 820 },
  { id: 'n11', name: 'ingest-gateway-01', type: 'ingest', status: 'healthy', region: 'us-east-1', cpu: 64, memory: 52, connections: 4200 },
  { id: 'n12', name: 'ingest-gateway-02', type: 'ingest', status: 'down', region: 'us-west-2', cpu: 0, memory: 0, connections: 0 },
];

const EVENT_KEYS = [
  'device:sensor-3829', 'device:sensor-4412', 'device:vehicle-0091',
  'user:u-88241', 'user:u-99201', 'device:sensor-7781',
  'device:vehicle-0142', 'user:u-71003', 'device:sensor-2204',
  'service:billing', 'service:auth', 'service:telemetry-api',
];

const EVENT_TYPES: Record<string, string[]> = {
  telemetry: ['temperature_reading', 'pressure_reading', 'gps_update', 'battery_level', 'rpm_reading'],
  events: ['user_login', 'page_view', 'button_click', 'form_submit', 'session_start'],
  logs: ['INFO', 'WARN', 'ERROR', 'DEBUG', 'TRACE'],
  metrics: ['cpu_usage', 'memory_usage', 'disk_io', 'network_throughput'],
  traces: ['span_start', 'span_end', 'trace_complete'],
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function randomWalk(prev: number, volatility: number, min: number, max: number): number {
  const delta = (Math.random() - 0.5) * volatility;
  return clamp(prev + delta, min, max);
}

export function createInitialMetrics(): MetricSeries[] {
  return [
    { key: 'ingestRate', label: 'Ingest Rate', unit: 'msg/s', value: 428400, history: [], min: 0, max: 600000, threshold: { warning: 500000, critical: 580000 } },
    { key: 'throughput', label: 'Throughput', unit: 'MB/s', value: 312, history: [], min: 0, max: 500, threshold: { warning: 420, critical: 480 } },
    { key: 'latency', label: 'P99 Latency', unit: 'ms', value: 42, history: [], min: 0, max: 200, threshold: { warning: 80, critical: 150 } },
    { key: 'errorRate', label: 'Error Rate', unit: '%', value: 0.12, history: [], min: 0, max: 5, threshold: { warning: 1, critical: 3 } },
    { key: 'cpuLoad', label: 'Cluster CPU', unit: '%', value: 54, history: [], min: 0, max: 100, threshold: { warning: 75, critical: 90 } },
    { key: 'memoryUsage', label: 'Memory', unit: '%', value: 63, history: [], min: 0, max: 100, threshold: { warning: 80, critical: 92 } },
    { key: 'storageUsed', label: 'Storage', unit: 'TB', value: 2.84, history: [], min: 0, max: 10, threshold: { warning: 7, critical: 9 } },
    { key: 'activeConsumers', label: 'Consumers', unit: '', value: 37, history: [], min: 0, max: 60, threshold: { warning: 50, critical: 55 } },
  ];
}

export function tickMetrics(metrics: MetricSeries[]): MetricSeries[] {
  return metrics.map((m) => {
    let next: number;
    switch (m.key) {
      case 'ingestRate':
        next = randomWalk(m.value, 30000, 200000, 580000);
        break;
      case 'throughput':
        next = randomWalk(m.value, 40, 150, 480);
        break;
      case 'latency':
        next = randomWalk(m.value, 12, 15, 180);
        break;
      case 'errorRate':
        next = clamp(m.value * 0.85 + 0.12 * 0.15 + (Math.random() - 0.5) * 0.08, 0, 5);
        break;
      case 'cpuLoad':
        next = randomWalk(m.value, 8, 20, 95);
        break;
      case 'memoryUsage':
        next = randomWalk(m.value, 5, 30, 95);
        break;
      case 'storageUsed':
        next = clamp(m.value + Math.random() * 0.002, 0, 10);
        break;
      case 'activeConsumers':
        next = Math.round(randomWalk(m.value, 3, 20, 55));
        break;
      default:
        next = m.value;
    }
    const history = [...m.history, next].slice(-60);
    return { ...m, value: next, history };
  });
}

let eventOffset = 0;

export function generateEvent(): StreamEvent {
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const types = EVENT_TYPES[topic.category] || ['generic'];
  const eventType = types[Math.floor(Math.random() * types.length)];
  const key = EVENT_KEYS[Math.floor(Math.random() * EVENT_KEYS.length)];
  const partition = Math.floor(Math.random() * topic.partitions);
  const latency = Math.round(randomWalk(42, 30, 1, 200));
  const errorChance = Math.random();
  const status: StreamEvent['status'] = errorChance > 0.97 ? 'error' : errorChance > 0.88 ? 'warn' : 'ok';
  eventOffset += 1;

  const payload: Record<string, unknown> = {
    event_type: eventType,
    source: key,
    value: status === 'error' ? null : Number((Math.random() * 100).toFixed(2)),
    timestamp: new Date().toISOString(),
  };
  if (topic.category === 'telemetry') payload.unit = ['celsius', 'hPa', 'rpm', '%'][Math.floor(Math.random() * 4)];
  if (topic.category === 'events') payload.session_id = `sess-${Math.random().toString(36).slice(2, 10)}`;
  if (topic.category === 'logs') payload.message = `${eventType}: operation completed on ${key}`;

  return {
    id: `evt-${Date.now()}-${eventOffset}`,
    topic: topic.name,
    partition,
    offset: eventOffset,
    key,
    payload,
    timestamp: Date.now(),
    latencyMs: latency,
    status,
  };
}

export function getTopics(): TopicInfo[] {
  return TOPICS;
}

export function getLakehouseTables(): LakehouseTable[] {
  return LAKEHOUSE_TABLES;
}

export function getNodes(): NodeInfo[] {
  return NODES;
}

export function tickNodes(nodes: NodeInfo[]): NodeInfo[] {
  return nodes.map((n) => {
    if (n.status === 'down') return n;
    return {
      ...n,
      cpu: Math.round(randomWalk(n.cpu, 10, 5, 99)),
      memory: Math.round(randomWalk(n.memory, 6, 20, 98)),
      connections: Math.round(randomWalk(n.connections, 50, 0, 5000)),
    };
  });
}

export function generateAlerts(metrics: MetricSeries[]): AlertItem[] {
  const alerts: AlertItem[] = [];
  const now = Date.now();
  for (const m of metrics) {
    if (m.value >= m.threshold.critical) {
      alerts.push({
        id: `alert-${m.key}-crit`,
        severity: 'critical',
        title: `${m.label} critical`,
        source: 'telemetry-engine',
        message: `${m.label} reached ${m.value.toFixed(2)}${m.unit} (threshold: ${m.threshold.critical}${m.unit})`,
        timestamp: now,
        acknowledged: false,
      });
    } else if (m.value >= m.threshold.warning) {
      alerts.push({
        id: `alert-${m.key}-warn`,
        severity: 'warning',
        title: `${m.label} elevated`,
        source: 'telemetry-engine',
        message: `${m.label} at ${m.value.toFixed(2)}${m.unit} (warning threshold: ${m.threshold.warning}${m.unit})`,
        timestamp: now,
        acknowledged: false,
      });
    }
  }
  return alerts;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export interface SimulatedIncident {
  type: 'consumer_lag' | 'broker_failure' | 'latency_spike' | 'error_burst';
  label: string;
  description: string;
}

export function createIncidentAlert(incident: SimulatedIncident): AlertItem {
  const now = Date.now();
  const configs: Record<SimulatedIncident['type'], { severity: AlertItem['severity']; title: string; source: string; message: string }> = {
    consumer_lag: {
      severity: 'critical',
      title: 'Consumer lag spike detected',
      source: 'kafka-consumer-monitor',
      message: '10,000+ events lagging on telemetry.uk.smartmeters.halfhourly — consumer group uk-settlement-cg is falling behind settlement window.',
    },
    broker_failure: {
      severity: 'critical',
      title: 'Broker failure in us-west-2',
      source: 'cluster-health-monitor',
      message: 'kafka-broker-03 in us-west-2 has become unresponsive. Partition leadership is being transferred to replica brokers. RTO: 4 min.',
    },
    latency_spike: {
      severity: 'warning',
      title: 'P99 latency spike',
      source: 'latency-monitor',
      message: 'P99 latency jumped to 178ms on events.uk.elexon.settlement — exceeding 150ms critical threshold. Investigating consumer thread contention.',
    },
    error_burst: {
      severity: 'warning',
      title: 'Error rate burst',
      source: 'error-rate-monitor',
      message: 'Error rate spiked to 3.4% across telemetry topics — 11x above baseline. Potential schema mismatch in latest meter reading batch.',
    },
  };
  const config = configs[incident.type];
  return {
    id: `incident-${incident.type}-${now}`,
    severity: config.severity,
    title: config.title,
    source: config.source,
    message: config.message,
    timestamp: now,
    acknowledged: false,
  };
}
