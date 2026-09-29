-- ============================================================
-- Delta Lake Time Travel & RESTORE — Disaster Recovery Scripts
-- ============================================================
-- These scripts demonstrate point-in-time recovery using Delta
-- Lake's transaction log. Run them in order during a DR event.
-- ============================================================

-- Step 1: View the transaction history of the table
-- This shows every commit: version, timestamp, operation, and
-- whether it was an append, overwrite, or delete.
DESCRIBE HISTORY agg_throughput_hourly;

-- Step 2: Inspect a specific past version to verify it contains
-- the correct data before restoring.
SELECT
    hour_bucket,
    topic,
    msg_count,
    error_count,
    p99_latency_ms
FROM agg_throughput_hourly
VERSION AS OF 41
WHERE hour_bucket >= '2025-01-05 00:00:00'
  AND hour_bucket <  '2025-01-06 00:00:00'
ORDER BY hour_bucket;

-- Step 3: Restore the table to the known-good version.
-- This creates a new commit that reverts the table state.
-- No data is deleted — old files are retained until VACUUM.
RESTORE TABLE agg_throughput_hourly TO VERSION AS OF 41;

-- Step 4: Verify the restore was successful
SELECT COUNT(*) AS row_count_after_restore
FROM agg_throughput_hourly
WHERE hour_bucket >= '2025-01-05 00:00:00'
  AND hour_bucket <  '2025-01-06 00:00:00';

-- ============================================================
-- Timestamp-based recovery (alternative to version number)
-- ============================================================
-- If you know the approximate time of the failure, restore to
-- just before it occurred.

-- View history with timestamps
SELECT
    version,
    timestamp,
    operation,
    operationParameters
FROM (DESCRIBE HISTORY agg_throughput_hourly)
ORDER BY version DESC
LIMIT 10;

-- Restore to a specific timestamp
RESTORE TABLE agg_throughput_hourly
TO TIMESTAMP AS OF '2025-01-06 14:00:00';

-- ============================================================
-- Scenario: Recover the error summary table after a bad load
-- ============================================================
-- The agg_error_summary_daily table was loaded with wrong error
-- types. Restore to the version before the bad load.

DESCRIBE HISTORY agg_error_summary_daily;

-- Verify the pre-failure data
SELECT
    day_bucket,
    topic,
    error_type,
    error_count
FROM agg_error_summary_daily
VERSION AS OF 88
WHERE day_bucket = '2025-01-06'
ORDER BY topic, error_type;

-- Restore
RESTORE TABLE agg_error_summary_daily TO VERSION AS OF 88;

-- ============================================================
-- Scenario: Recover from accidental partition deletion
-- ============================================================
-- Someone ran DELETE on the wrong partition. Use RESTORE to
-- bring the deleted rows back.

RESTORE TABLE agg_throughput_hourly
TO TIMESTAMP AS OF '2025-01-06 12:00:00';

-- Verify the deleted partition is back
SELECT COUNT(*) AS recovered_rows
FROM agg_throughput_hourly
WHERE hour_bucket >= '2025-01-06 00:00:00'
  AND hour_bucket <  '2025-01-07 00:00:00';
