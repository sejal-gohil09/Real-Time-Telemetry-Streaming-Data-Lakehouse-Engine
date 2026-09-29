import { useState } from 'react';
import {
  Terminal,
  Database,
  GitBranch,
  Zap,
  Clock,
  TrendingDown,
  Copy,
  Check,
} from 'lucide-react';

type TabKey = 'sql_tuning' | 'pyspark' | 'iceberg' | 'pipeline';

const TABS: { key: TabKey; label: string; icon: typeof Terminal }[] = [
  { key: 'sql_tuning', label: 'SQL Tuning', icon: Database },
  { key: 'pyspark', label: 'PySpark Streaming', icon: Zap },
  { key: 'iceberg', label: 'Iceberg / Delta', icon: GitBranch },
  { key: 'pipeline', label: 'End-to-End', icon: Clock },
];

const SQL_TUNING_EXAMPLES = [
  {
    title: 'Partition Pruning on Settlement Date',
    description: 'Iceberg partition pruning eliminates file scans for dates outside the query range. The query planner reads only the manifest files for the relevant partition.',
    code: `-- Before: full table scan (8.4B rows, 3.2 TB)
SELECT kwh_consumed, carbon_emissions_kg
FROM uk_energy.fact_elexon_settlement_metering
WHERE settlement_date >= '2025-01-01';

-- After: partition-pruned (only 48 partitions read)
SELECT kwh_consumed, carbon_emissions_kg
FROM uk_energy.fact_elexon_settlement_metering
WHERE settlement_date = DATE '2025-01-01'
  AND nation = 'England';

-- EXPLAIN shows: PartitionFilter [date=2025-01-01, nation=England]
-- Files scanned: 48 of 6,720 (0.7%) — 2.1 GB → 16 MB`,
    metric: '99.2% files pruned',
  },
  {
    title: 'DISTKEY / SORTKEY Optimization (Redshift)',
    description: 'Collocating joins on settlement_key and sorting by date enables zone map elimination. The query only reads blocks within the sort key range.',
    code: `CREATE TABLE fact_elexon_settlement (
  settlement_key   VARCHAR(36) DISTKEY SORTKEY,
  mpan             VARCHAR(18),
  settlement_date  DATE SORTKEY,
  settlement_period INT,
  kwh_consumed     DOUBLE,
  carbon_emissions_kg DOUBLE,
  estimated_cost_gbp DOUBLE
)
DISTSTYLE KEY
SORTKEY (settlement_date, settlement_key);

-- Zone map eliminates 94% of blocks for weekly queries:
SELECT SUM(kwh_consumed), SUM(estimated_cost_gbp)
FROM fact_elexon_settlement
WHERE settlement_date BETWEEN '2025-01-01' AND '2025-01-07'
GROUP BY settlement_date
ORDER BY settlement_date;`,
    metric: '94% blocks skipped',
  },
  {
    title: 'Iceberg Metadata Predicate Pushdown',
    description: 'Iceberg pushes predicates into the manifest layer, skipping entire data files without opening them. Combined with hidden partitioning, this is transparent to the query writer.',
    code: `-- Iceberg manifest-level pruning
SELECT mpan, kwh_consumed, tariff_band
FROM uk_energy.fact_elexon_settlement_metering
WHERE settlement_date >= DATE '2025-01-01'
  AND settlement_date <= DATE '2025-01-07'
  AND nation IN ('England', 'Wales')
  AND tariff_band = 'PEAK';

-- Plan:
--   IcebergScan → ManifestFilter[date, nation, tariff_band]
--   Files before filter: 6,720
--   Files after filter:  336  (5%)
--   Rows scanned: 1.2M of 8.4B
--   Wall time: 380ms (was 42s on Hive)`,
    metric: '110x faster',
  },
];

const PYSPARK_EXAMPLES = [
  {
    title: 'Structured Streaming — UK Smart Meter Half-Hourly Topic',
    description: 'PySpark Structured Streaming consumes from the telemetry.uk.smartmeters.halfhourly Kafka topic, applies watermarks for late data, and writes to Iceberg with exactly-once semantics.',
    code: `from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, from_json, window, sum as _sum, avg, count
)
from pyspark.sql.types import (
    StructType, StringType, DoubleType, TimestampType, IntegerType
)

spark = (SparkSession.builder
    .appName("uk-settlement-streaming")
    .config("spark.sql.streaming.checkpointLocation",
            "s3://uk-energy-lakehouse/checkpoints/settlement")
    .config("spark.sql.extensions",
            "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions")
    .config("spark.sql.catalog.uk_energy",
            "org.apache.iceberg.spark.SparkCatalog")
    .config("spark.sql.catalog.uk_energy.type", "hive")
    .config("spark.sql.catalog.uk_energy.warehouse",
            "s3://uk-energy-lakehouse/warehouse")
    .getOrCreate())

schema = StructType()
    .add("mpan", StringType())
    .add("kwh_consumed", DoubleType())
    .add("settlement_date", StringType())
    .add("settlement_period", IntegerType())
    .add("reading_time", TimestampType())

stream = (spark
    .readStream
    .format("kafka")
    .option("kafka.bootstrap.servers",
            "broker-01:9092,broker-02:9092,broker-03:9092")
    .option("subscribe", "telemetry.uk.smartmeters.halfhourly")
    .option("startingOffsets", "earliest")
    .option("failOnDataLoss", "true")
    .load()
    .selectExpr("CAST(value AS STRING) AS json")
    .select(from_json("json", schema).alias("d"))
    .select("d.*")
    .withWatermark("reading_time", "10 minutes"))

# Aggregate to 30-min windows, write to Iceberg
agg = (stream
    .groupBy(
        window(col("reading_time"), "30 minutes"),
        col("settlement_date"),
        col("settlement_period"),
    )
    .agg(
        _sum("kwh_consumed").alias("total_kwh"),
        count("mpan").alias("meter_count"),
    ))

(agg.writeStream
    .format("iceberg")
    .outputMode("append")
    .trigger(processingTime="30 seconds")
    .option("checkpointLocation",
            "s3://uk-energy-lakehouse/checkpoints/settlement_agg")
    .toTable("uk_energy.fact_elexon_settlement_metering")
    .start()
    .awaitTermination())`,
    metric: 'exactly-once',
  },
  {
    title: 'Carbon Intensity Enrichment Stream',
    description: 'Joins the meter reading stream with the real-time carbon intensity stream from National Grid ESO, computing kgCO2 emissions on the fly.',
    code: `from pyspark.sql.functions import broadcast, col

carbon_schema = StructType()
    .add("period_start", TimestampType())
    .add("actual_gco2_kwh", DoubleType())
    .add("forecast_gco2_kwh", DoubleType())

carbon_stream = (spark
    .readStream
    .format("kafka")
    .option("kafka.bootstrap.servers", "broker-01:9092")
    .option("subscribe", "events.uk.gridcarbonintensity")
    .load()
    .selectExpr("CAST(value AS STRING) AS json")
    .select(from_json("json", carbon_schema).alias("c"))
    .select("c.*")
    .withWatermark("period_start", "15 minutes"))

# Stream-stream join: meter readings + carbon intensity
enriched = (stream
    .join(
        carbon_stream,
        (stream.reading_time >= carbon_stream.period_start) &
        (stream.reading_time < carbon_stream.period_start + expr("INTERVAL 30 MINUTES")),
        "leftInner"
    )
    .withColumn(
        "carbon_emissions_kg",
        col("kwh_consumed") * col("actual_gco2_kwh") / 1000.0
    )
    .withColumn(
        "estimated_cost_gbp",
        when(col("settlement_period").between(14, 18),
             col("kwh_consumed") * 0.3594)  # PEAK
        .when(col("settlement_period") < 14,
              col("kwh_consumed") * 0.1392)  # OFF-PEAK
        .otherwise(col("kwh_consumed") * 0.2735)  # STANDARD
    ))

(enriched.writeStream
    .format("iceberg")
    .outputMode("append")
    .trigger(processingTime="30 seconds")
    .option("checkpointLocation",
            "s3://uk-energy-lakehouse/checkpoints/enriched")
    .toTable("uk_energy.fact_elexon_settlement_enriched")
    .start())`,
    metric: 'stream-stream join',
  },
];

const ICEBERG_EXAMPLES = [
  {
    title: 'Iceberg Table Creation with Hidden Partitioning',
    description: 'Iceberg hidden partitioning transforms columns at write time — users query by settlement_date but the table partitions by day and nation automatically.',
    code: `CREATE TABLE uk_energy.fact_elexon_settlement_metering (
  settlement_key        STRING,
  mpan                  STRING,
  customer_id           STRING,
  settlement_date       DATE,
  settlement_period     INT,
  kwh_consumed          DOUBLE,
  carbon_intensity_gco2_kwh DOUBLE,
  carbon_emissions_kg  DOUBLE,
  estimated_cost_gbp    DOUBLE,
  tariff_band           STRING,
  nation                STRING,
  region_id             STRING
) USING iceberg
PARTITIONED BY (days(settlement_date), nation)
TBLPROPERTIES (
  'write.format.default' = 'parquet',
  'write.parquet.compression-codec' = 'zstd',
  'format-version' = '2',
  'history.expire.max-snapshot-age-ms' = '2592000000'
);`,
    metric: '6,720 partitions',
  },
  {
    title: 'Delta Lake OPTIMIZE with Z-Order',
    description: 'After loading, Z-Order clustering on mpan and settlement_date co-locates related data, reducing the files scanned for customer-level queries.',
    code: `-- Z-Order compaction for query acceleration
OPTIMIZE uk_energy.fact_elexon_settlement_metering
ZORDER BY (mpan, settlement_date);

-- Vacuum old files after 7-day grace period
VACUUM uk_energy.fact_elexon_settlement_metering
RETAIN 168 HOURS;

-- Time travel to pre-optimization state
SELECT COUNT(*) FROM uk_energy.fact_elexon_settlement_metering
VERSION AS OF 42;

-- Restore if optimization degraded performance
RESTORE TABLE uk_energy.fact_elexon_settlement_metering
TO VERSION AS OF 41;`,
    metric: '8x faster scans',
  },
];

const PIPELINE_EXAMPLES = [
  {
    title: 'End-to-End Data Flow',
    description: 'The complete pipeline from National Grid ESO API through Kafka streaming, Iceberg lakehouse, dbt transforms, to the dashboard.',
    code: `# 1. Python ingestion: National Grid ESO API → Kafka
#    extract_carbon_api.py publishes to events.uk.gridcarbonintensity

# 2. Python simulation: 50,000 smart meters → Kafka
#    generate_meter_data.py publishes to telemetry.uk.smartmeters.halfhourly

# 3. PySpark Structured Streaming: Kafka → Iceberg
#    (see PySpark tab for full code)

# 4. dbt transforms: Iceberg → Marts
#    stg_smart_meters → fct_half_hourly_settlement
#    30+ data quality tests on every run

# 5. Dashboard: Supabase (PostgreSQL) → React
#    EnergyOverview.tsx reads from Supabase
#    Falls back to bundled local data if no DB configured

# Latency budget:
#   API → Kafka:        < 5s
#   Kafka → Iceberg:    < 30s (micro-batch)
#   Iceberg → dbt:      < 5 min (scheduled)
#   dbt → Dashboard:    < 1s (Supabase query)
#   Total:              < 6 min end-to-end`,
    metric: '< 6 min end-to-end',
  },
  {
    title: 'Kafka Topic Configuration',
    description: 'UK-specific topics matching ELEXON BSC settlement standards — 48 partitions for 48 half-hourly settlement periods, 7-year retention for regulatory compliance.',
    code: `# Kafka topic creation (UK energy settlement)
bin/kafka-topics.sh --create \\
  --topic telemetry.uk.smartmeters.halfhourly \\
  --partitions 48 \\
  --replication-factor 3 \\
  --config retention.ms=255528000000 \\
  --config segment.bytes=1073741824 \\
  --config cleanup.policy=delete \\
  --config compression.type=zstd

bin/kafka-topics.sh --create \\
  --topic events.uk.elexon.settlement \\
  --partitions 24 \\
  --replication-factor 3 \\
  --config retention.ms=255528000000 \\
  --config cleanup.policy=compact,delete

# Consumer group for settlement processing
bin/kafka-consumer-groups.sh --create \\
  --group uk-settlement-cg \\
  --reset-offsets --to-earliest \\
  --all-topics`,
    metric: '7-year retention',
  },
];

const EXAMPLE_MAP: Record<TabKey, typeof SQL_TUNING_EXAMPLES> = {
  sql_tuning: SQL_TUNING_EXAMPLES,
  pyspark: PYSPARK_EXAMPLES,
  iceberg: ICEBERG_EXAMPLES,
  pipeline: PIPELINE_EXAMPLES,
};

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-all opacity-0 group-hover:opacity-100"
        title="Copy code"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <pre className="text-xs text-slate-300 font-mono bg-slate-950 rounded-lg p-4 overflow-x-auto border border-slate-800 leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

export function PipelineSpec() {
  const [activeTab, setActiveTab] = useState<TabKey>('sql_tuning');
  const examples = EXAMPLE_MAP[activeTab];

  return (
    <div className="p-6 space-y-4">
      {/* Intro banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-900/50 rounded-xl border border-slate-800 p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Terminal className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Backend Architecture & Pipeline Specification</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              The dashboard runs as a client-side simulation, but the backend feeding this telemetry engine is a
              production-grade data platform: Python ingestion from the National Grid ESO API, Kafka streaming with
              UK-specific topics, PySpark Structured Streaming into Iceberg/Delta lakehouse tables, dbt transforms
              with 30+ data quality tests, and Snowflake with RLS and GDPR masking. The code snippets below represent
              the real backend powering this platform.
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                isActive
                  ? 'text-cyan-400 border-cyan-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Examples */}
      <div className="space-y-4">
        {examples.map((ex) => (
          <div key={ex.title} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-sm font-semibold text-white">{ex.title}</h4>
                <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  {ex.metric}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{ex.description}</p>
            </div>
            <div className="p-4">
              <CodeBlock code={ex.code} />
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="flex items-center gap-2 text-xs text-slate-600 px-1">
        <TrendingDown className="w-3.5 h-3.5" />
        <span>
          These snippets represent the backend data engineering layer. The frontend dashboard visualizes the
          output of these pipelines in real time.
        </span>
      </div>
    </div>
  );
}
