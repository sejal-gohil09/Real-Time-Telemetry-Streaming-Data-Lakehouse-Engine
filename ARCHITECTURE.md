# Architecture — TelemetryHub

## System Overview

TelemetryHub is a single-page React application that simulates a complete real-time telemetry streaming and data lakehouse observability platform. The app runs entirely client-side with no backend dependencies — a simulation engine generates live metrics, events, alerts, and node health data that flow through the same UI components a real monitoring platform would use.

## Component Architecture

```
App.tsx (root)
├── Sidebar.tsx
│   └── Navigation + live ingest rate indicator + alert badge
├── Topbar.tsx
│   └── Search + live clock + streaming status indicator
└── Views (switched via state)
    ├── Overview.tsx
    │   ├── MetricCard[] (8 cards with sparklines)
    │   ├── AreaChart (ingest throughput, 90s window)
    │   ├── Gauge[] (4 circular gauges)
    │   ├── BarChart (topic throughput)
    │   ├── ClusterHealth summary
    │   └── RecentEvents preview
    ├── EventStreams.tsx
    │   ├── TopicList (8 Kafka topics)
    │   ├── EventFeed (live, filterable, pausable)
    │   └── EventDetail (payload inspector)
    ├── Lakehouse.tsx
    │   ├── TableList (6 tables, 3 formats)
    │   ├── TableDetail (schema, stats)
    │   └── QueryPerformance indicators
    ├── Topology.tsx
    │   ├── RegionMap (2 AWS regions)
    │   ├── NodeCard[] (12 nodes, 5 types)
    │   └── NodeDetail (health checks)
    ├── Alerts.tsx
    │   ├── AlertSummary (severity counts)
    │   ├── IncidentSimulator (inject anomalies: consumer lag, broker failure, latency spike, error burst)
    │   └── AlertStream (acknowledgeable)
    ├── PipelineSpec.tsx
    │   ├── SQLTuning (partition pruning, DISTKEY/SORTKEY, Iceberg pushdown)
    │   ├── PySparkStreaming (Structured Streaming code with Kafka + Iceberg)
    │   ├── IcebergDelta (table creation, Z-Order, time travel)
    │   └── EndToEnd (pipeline flow + Kafka topic config)
    └── Settings.tsx
        ├── StreamConfig (retention, replication, compaction)
        ├── LakehouseEngine (format selection)
        ├── AutoScaling toggle
        ├── Notifications (email, Slack)
        └── Security posture
```

## Data Flow

```
                    ┌──────────────────────┐
                    │  useTelemetryEngine  │  (React Hook)
                    │  ──────────────────  │
                    │  setInterval 1500ms  │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │  tickMetrics │  │ generateEvent│  │  tickNodes   │
   │  (8 series)   │  │  (1 event)   │  │  (12 nodes)  │
   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
          │                 │                 │
          ▼                 ▼                 ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │  metrics[]   │  │  events[]    │  │   nodes[]    │
   │  useState    │  │  useState    │  │  useState    │
   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   App.tsx     │  (passes props to active view)
                    └───────────────┘
```

### Tick Cycle (every 1.5 seconds)

1. **Metrics**: Each of the 8 metric series advances via bounded random-walk with metric-specific volatility. History buffer retains last 60 values (90 seconds at 1.5s interval).
2. **Events**: One new event is generated from a random topic, with realistic payload based on topic category. Event buffer retains last 80 events.
3. **Nodes**: All 12 nodes update CPU/memory/connections via random-walk. Down nodes stay at zero.
4. **Alerts**: Current metric values are checked against thresholds. New alerts are generated and deduplicated by metric key.

## Simulation Engine

### Random-Walk Algorithm

```typescript
function randomWalk(prev: number, volatility: number, min: number, max: number): number {
  const delta = (Math.random() - 0.5) * volatility;
  return clamp(prev + delta, min, max);
}
```

Each metric has tuned parameters:

| Metric | Volatility | Min | Max | Unit |
|---|---|---|---|---|
| Ingest Rate | 30,000 | 200,000 | 580,000 | msg/s |
| Throughput | 40 | 150 | 480 | MB/s |
| P99 Latency | 12 | 15 | 180 | ms |
| Error Rate | 0.3 | 0 | 5 | % |
| Cluster CPU | 8 | 20 | 95 | % |
| Memory | 5 | 30 | 95 | % |
| Storage | — | 0 | 10 | TB (monotonic increase) |
| Active Consumers | 3 | 20 | 55 | count |

### Event Generation

Events are generated from 8 topics across 5 categories. Each event includes:
- Random partition within the topic's partition count
- Sequential offset
- Random key from a pool of device/user/service identifiers
- Category-specific payload (telemetry readings, user sessions, log messages)
- Latency value (random-walk from 42ms baseline)
- Status (ok/warn/error) with ~3% error rate, ~9% warn rate

### Alert Generation

Alerts are generated when metrics cross thresholds:

| Metric | Warning | Critical |
|---|---|---|
| Ingest Rate | 500,000 msg/s | 580,000 msg/s |
| Throughput | 420 MB/s | 480 MB/s |
| P99 Latency | 80 ms | 150 ms |
| Error Rate | 1% | 3% |
| Cluster CPU | 75% | 90% |
| Memory | 80% | 92% |
| Storage | 7 TB | 9 TB |
| Active Consumers | 50 | 55 |

Alerts are deduplicated by metric key to prevent duplicate alerts for the same metric.

## Chart Engine

All charts are custom SVG components with zero external dependencies:

- **AreaChart**: Polyline + gradient fill, normalized to min/max range, 60-point rolling window
- **BarChart**: Flex-laid out bars with hover tooltips, lag-based color coding
- **Gauge**: Circular arc (270° sweep) with gradient stroke, value display in center
- **Sparkline**: Compact polyline for metric card thumbnails

All charts use `preserveAspectRatio="none"` for responsive scaling and `vectorEffect="non-scaling-stroke"` for consistent line widths.

## Data Models

### Kafka Topics (10)

| Topic | Partitions | Replication | Retention | Category |
|---|---|---|---|---|
| telemetry.uk.smartmeters.halfhourly | 48 | 3 | 365d | telemetry |
| events.uk.elexon.settlement | 24 | 3 | 2555d | events |
| telemetry.iot.devices | 12 | 3 | 7d | telemetry |
| events.user.activity | 8 | 3 | 30d | events |
| logs.application | 16 | 2 | 3d | logs |
| metrics.system | 6 | 3 | 14d | metrics |
| traces.distributed | 10 | 3 | 5d | traces |
| events.billing.transactions | 4 | 3 | 90d | events |
| telemetry.vehicle.fleet | 14 | 2 | 7d | telemetry |
| logs.audit.security | 6 | 3 | 365d | logs |

### Lakehouse Tables (8)

| Table | Format | Schema | Rows | Size | Partitions |
|---|---|---|---|---|---|
| fact_elexon_settlement_metering | Iceberg | uk_energy | 8.4B | 3.2 TB | 6,720 |
| dim_uk_gsp_regions | Iceberg | uk_energy | 14 | 8 KB | 14 |
| fact_telemetry_events | Iceberg | telemetry | 8.4B | 2.1 TB | 1,440 |
| fact_user_sessions | Iceberg | analytics | 1.2B | 480 GB | 720 |
| agg_throughput_hourly | Delta | telemetry | 320M | 64 GB | 168 |
| dim_devices | Iceberg | telemetry | 2.4M | 1.2 GB | 1 |
| fact_audit_log | Hudi | security | 640M | 180 GB | 365 |
| agg_error_summary_daily | Delta | telemetry | 12M | 8.4 GB | 90 |

### Infrastructure Nodes (12)

| Node | Type | Region | Status |
|---|---|---|---|
| kafka-broker-01 | broker | us-east-1 | healthy |
| kafka-broker-02 | broker | us-east-1 | healthy |
| kafka-broker-03 | broker | us-west-2 | degraded |
| spark-worker-01/02 | worker | us-east-1 | healthy |
| spark-worker-03 | worker | us-west-2 | healthy |
| coordinator-01 | coordinator | us-east-1 | healthy |
| coordinator-02 | coordinator | us-west-2 | healthy |
| s3-storage-gateway | storage | us-east-1 | healthy |
| s3-storage-gateway-w | storage | us-west-2 | healthy |
| ingest-gateway-01 | ingest | us-east-1 | healthy |
| ingest-gateway-02 | ingest | us-west-2 | down |

## Performance Considerations

- **Tick interval**: 1.5s balances liveliness with render performance
- **History buffer**: 60 points per metric (capped) prevents unbounded memory growth
- **Event buffer**: 80 events (capped) keeps DOM lightweight
- **SVG charts**: Hand-built with `preserveAspectRatio="none"` for responsive scaling without re-rendering
- **No chart library**: Eliminates ~100KB+ of dependency weight
- **Bundle size**: 228 KB (62 KB gzipped) including all views
