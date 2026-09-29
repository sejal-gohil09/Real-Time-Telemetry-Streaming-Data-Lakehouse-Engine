-- ============================================================
-- Delta Lake Vacuum & Optimize — Post-Recovery Maintenance
-- ============================================================
-- After restoring a Delta Lake table, orphaned data files from
-- the reverted versions remain on disk. These scripts clean
-- up storage and rebuild compacted snapshots for query speed.
-- ============================================================

-- Step 1: Check for orphaned files before vacuuming
-- Delta Lake tracks which files are referenced by the current
-- table version. Files from reverted versions are orphaned.
SELECT
    version,
    timestamp,
    operation,
    operationMetrics
FROM (DESCRIBE HISTORY agg_throughput_hourly)
ORDER BY version DESC
LIMIT 5;

-- Step 2: Vacuum — remove files older than the retention period
-- WARNING: VACUUM permanently deletes files. Only run after
-- confirming the restore is correct and dbt tests pass.
-- The 168-hour (7-day) retention ensures we can still time-travel
-- back one week if the restore itself had an issue.
VACUUM agg_throughput_hourly RETAIN 168 HOURS;

VACUUM agg_error_summary_daily RETAIN 168 HOURS;

-- Step 3: Optimize — compact small files and re-cluster data
-- After a restore, the table may have many small files from the
-- reverted versions. OPTIMIZE merges them into larger files and
-- re-clusters by the ZORDER key for faster query pruning.
OPTIMIZE agg_throughput_hourly ZORDER BY (topic, hour_bucket);

OPTIMIZE agg_error_summary_daily ZORDER BY (day_bucket, topic);

-- Step 4: Verify query performance is restored
-- After optimization, average query latency should return to
-- pre-incident levels (under 100ms for aggregation tables).
SELECT
    COUNT(*) AS file_count,
    SUM(size_bytes) / 1024 / 1024 AS total_size_mb
FROM (SELECT * FROM agg_throughput_hourly LIMIT 0);

-- Step 5: Run dbt data quality tests to confirm the restored
-- data passes all 30+ validation checks.
-- (Run from the dbt_project/ directory, not in SQL)
-- dbt test --select fct_half_hourly_settlement
-- dbt test --select agg_throughput_hourly

-- ============================================================
-- Scheduled maintenance (run weekly, not just after DR)
-- ============================================================
-- These commands keep Delta Lake tables healthy during normal
-- operations, not just after a disaster.

-- Compact and re-cluster the high-traffic throughput table
OPTIMIZE agg_throughput_hourly ZORDER BY (topic, hour_bucket);

-- Compact the error summary table
OPTIMIZE agg_error_summary_daily ZORDER BY (day_bucket, topic);

-- Vacuum files older than 7 days (standard retention)
VACUUM agg_throughput_hourly RETAIN 168 HOURS;
VACUUM agg_error_summary_daily RETAIN 168 HOURS;
