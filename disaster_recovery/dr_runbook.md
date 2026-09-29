# Disaster Recovery Runbook

## Incident Response Guide — Delta Lake Table Recovery

This runbook covers the three most common disaster scenarios for the TelemetryHub data lakehouse and the exact steps to recover from each.

---

## Scenario 1: Bad Data Ingested

**Trigger:** A pipeline run loaded incorrect values (e.g., wrong tariff band, stale carbon intensity data, or duplicate meter readings).

**RPO:** 0 (no data loss — restore to the version before the bad load)
**RTO:** < 5 minutes

### Steps

1. **Identify the bad version**
   ```sql
   DESCRIBE HISTORY agg_throughput_hourly;
   ```
   Look for the most recent `WRITE` or `UPDATE` operation. Note the version number before it.

2. **Verify the previous version is clean**
   ```sql
   SELECT * FROM agg_throughput_hourly
   VERSION AS OF 41
   WHERE hour_bucket = '2025-01-06';
   ```
   Confirm the data looks correct.

3. **Restore to the known-good version**
   ```sql
   RESTORE TABLE agg_throughput_hourly TO VERSION AS OF 41;
   ```

4. **Run dbt tests to verify data quality**
   ```bash
   cd dbt_project
   dbt test --select fct_half_hourly_settlement
   ```

5. **Log the recovery event in the audit table**
   ```sql
   INSERT INTO GOVERNANCE.INGESTION_AUDIT_LOG (pipeline_name, run_date, status, rows_affected, error_message)
   VALUES ('DR_RESTORE_agg_throughput_hourly', CURRENT_DATE(), 'RECOVERED', 0, 'Restored to version 41 after bad tariff band load');
   ```

6. **Vacuum and optimize (optional, run after 24h)**
   ```sql
   VACUUM agg_throughput_hourly RETAIN 168 HOURS;
   OPTIMIZE agg_throughput_hourly ZORDER BY (topic, hour_bucket);
   ```

---

## Scenario 2: Pipeline Failure (Partial Load)

**Trigger:** The Python ingestion script crashed mid-load. Some partitions were written, others were not.

**RPO:** 0 (Delta Lake's ACID guarantees mean partial writes are never committed)
**RTO:** < 15 minutes (time to re-run the pipeline)

### Steps

1. **Verify the table is in a consistent state**
   ```sql
   SELECT COUNT(DISTINCT hour_bucket) AS loaded_periods
   FROM agg_throughput_hourly
   WHERE hour_bucket >= '2025-01-06';
   ```
   If the count is less than expected, the failed transaction was not committed — the table still reflects the pre-failure state.

2. **Re-run the failed pipeline**
   ```bash
   python python_pipeline/load_to_snowflake.py \
       --input-dir ./data/settlement_date=2025-01-06 \
       --table RAW_SMART_METER_READINGS
   ```
   The `MERGE` operation is idempotent — existing partitions are skipped, missing partitions are loaded, no duplicates created.

3. **Run dbt to rebuild downstream marts**
   ```bash
   cd dbt_project
   dbt run --select fct_half_hourly_settlement
   dbt test
   ```

4. **Log the recovery**
   ```sql
   INSERT INTO GOVERNANCE.INGESTION_AUDIT_LOG (pipeline_name, run_date, status, rows_affected, error_message)
   VALUES ('meter_loader', CURRENT_DATE(), 'RECOVERED', 2400000, 'Pipeline re-run after crash — idempotent merge, no duplicates');
   ```

---

## Scenario 3: File Corruption (S3 Object Loss)

**Trigger:** Storage-level corruption — S3 objects were deleted or corrupted by an external process.

**RPO:** < 1 hour (restore to last valid checkpoint)
**RTO:** < 30 minutes

### Steps

1. **Delta Lake will detect missing files on the next query**
   The query will fail with a `FILE_NOT_FOUND` error.

2. **Restore from the last valid checkpoint**
   ```sql
   RESTORE TABLE fact_telemetry_events
   TO TIMESTAMP AS OF '2025-01-06 14:00:00';
   ```

3. **Vacuum orphaned references**
   ```sql
   VACUUM fact_telemetry_events RETAIN 168 HOURS;
   ```

4. **Optimize to rebuild the compacted snapshot**
   ```sql
   OPTIMIZE fact_telemetry_events ZORDER BY (device_id);
   ```

5. **Run full dbt test suite**
   ```bash
   cd dbt_project
   dbt test
   ```

6. **Log the recovery**
   ```sql
   INSERT INTO GOVERNANCE.INGESTION_AUDIT_LOG (pipeline_name, run_date, status, rows_affected, error_message)
   VALUES ('DR_RESTORE_fact_telemetry_events', CURRENT_DATE(), 'RECOVERED', 0, 'Restored from S3 corruption — vacuum + optimize completed');
   ```

---

## Post-Recovery Checklist

- [ ] dbt tests pass (30+ checks, zero failures)
- [ ] Row counts match the expected pre-incident state
- [ ] Audit log entry created for the recovery event
- [ ] Power BI dashboard refreshes successfully
- [ ] Vacuum + optimize scheduled for off-peak window (if not yet run)
- [ ] Incident report filed with root cause analysis

---

## Delta Lake vs. Iceberg vs. Hudi — DR Comparison

| Feature | Delta Lake | Iceberg | Hudi |
|---------|-----------|---------|------|
| Time travel | `VERSION AS OF N` / `TIMESTAMP AS OF` | Snapshot branches + tags | Instant rollback (COW) |
| Restore command | `RESTORE TABLE ... TO VERSION AS OF N` | Branch-based rollback | `SAVEPOINT` + `ROLLBACK` |
| Vacuum | `VACUUM ... RETAIN N HOURS` | `EXPIRE_SNAPSHOTS` | `CLEAN` |
| Optimize | `OPTIMIZE ... ZORDER BY` | `OPTIMIZE` / compaction | `COMPACT` / `CLUSTERING` |
| Idempotent writes | `MERGE INTO` | `MERGE ROWS` | `INSERT OVERWRITE` / `UPSERT` |

This platform uses Delta Lake for the two aggregation tables (`agg_throughput_hourly`, `agg_error_summary_daily`) where fast point-in-time recovery is most critical, Iceberg for the large fact table where snapshot branching is preferred, and Hudi for the audit log where incremental upserts matter most.
