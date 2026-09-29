# Disaster Recovery — Delta Lake

This directory contains the disaster recovery runbook and SQL scripts for recovering Delta Lake tables in the TelemetryHub platform.

## Files

| File | Purpose |
|------|---------|
| `dr_runbook.md` | Step-by-step incident response guide for operators |
| `delta_time_travel.sql` | Time travel and RESTORE examples for point-in-time recovery |
| `delta_vacuum_optimize.sql` | Post-recovery maintenance: vacuum orphaned files, optimize compacted snapshots |

## When to Use These Scripts

- **Bad data ingested** — wrong tariff band, incorrect carbon intensity values, duplicate meter readings
- **Pipeline failure** — partial load that left the table in an inconsistent state
- **File corruption** — S3 object loss or storage-level corruption
- **Accidental deletion** — a partition or table was dropped by mistake

## Key Principle

Delta Lake's ACID transaction log guarantees that every committed version is a consistent, queryable snapshot. A failed pipeline run leaves no partial data — the table reflects either the pre-failure state or the post-failure state, never a mix. This eliminates the most common DR scenario: "the load wrote half the partitions and then crashed."

## Quick Reference

```sql
-- See table history
DESCRIBE HISTORY agg_throughput_hourly;

-- Query a past version
SELECT * FROM agg_throughput_hourly VERSION AS OF 41;

-- Restore to a known-good version
RESTORE TABLE agg_throughput_hourly TO VERSION AS OF 41;

-- Clean up after restore
VACUUM agg_throughput_hourly RETAIN 168 HOURS;
OPTIMIZE agg_throughput_hourly ZORDER BY (topic);
```
