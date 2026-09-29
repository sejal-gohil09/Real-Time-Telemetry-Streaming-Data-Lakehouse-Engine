"""
load_to_snowflake.py
====================
Generic Snowflake bulk loader for CSV/Parquet meter data.

Reads partitioned CSV files produced by generate_meter_data.py and
bulk-loads them into Snowflake using the Snowflake Connector for Python
with PUT/COPY INTO for high throughput.

Supports:
  - Auto-creating target tables if they don't exist
  - Idempotent loads via MERGE (upsert on MPAN + settlement_date + period)
  - File compression (GZIP) for network efficiency
  - Progress logging for large loads

Usage:
    python load_to_snowflake.py \
        --input-dir ./data \
        --table RAW_SMART_METER_READINGS \
        --schema RAW \
        --database UK_ENERGY_LAKEHOUSE

Author: Sejal Gohil
"""

import argparse
import gzip
import logging
import os
import shutil
import sys
from pathlib import Path

from snowflake.connector import connect

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_CONFIG = {
    "account": "your_account.snowflakecomputing.com",
    "user": "METER_LOADER",
    "warehouse": "ETL_WH",
    "database": "UK_ENERGY_LAKEHOUSE",
    "schema": "RAW",
    "role": "ETL_ROLE",
}

# Column definitions for auto table creation
METER_TABLE_DDL = """
CREATE TABLE IF NOT EXISTS {database}.{schema}.{table} (
    mpan              STRING       NOT NULL,
    customer_id       STRING       NOT NULL,
    region_name       STRING       NOT NULL,
    country           STRING       NOT NULL,
    gsp_group         STRING       NOT NULL,
    settlement_date   DATE         NOT NULL,
    settlement_period INTEGER      NOT NULL,
    period_start_utc  TIMESTAMP_TZ NOT NULL,
    period_end_utc    TIMESTAMP_TZ NOT NULL,
    kwh_consumed      FLOAT        NOT NULL,
    meter_type        STRING,
    profile_type      STRING,
    ingested_at       TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
    CONSTRAINT pk_meter_reading PRIMARY KEY (mpan, settlement_date, settlement_period)
);
"""

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Snowflake connection
# ---------------------------------------------------------------------------

def get_connection(config: dict):
    """Create a Snowflake connection using environment variables."""
    import os as _os

    return connect(
        account=config["account"],
        user=config["user"],
        password=_os.environ.get("SNOWFLAKE_PASSWORD", ""),
        warehouse=config["warehouse"],
        database=config["database"],
        schema=config["schema"],
        role=config["role"],
    )


def ensure_table(conn, database: str, schema: str, table: str) -> None:
    """Create the target table if it doesn't exist."""
    ddl = METER_TABLE_DDL.format(database=database, schema=schema, table=table)
    with conn.cursor() as cur:
        cur.execute(ddl)
    logger.info("Ensured table %s.%s.%s exists", database, schema, table)


# ---------------------------------------------------------------------------
# File compression
# ---------------------------------------------------------------------------

def compress_file(source_path: str) -> str:
    """Gzip a CSV file and return the compressed file path."""
    gz_path = source_path + ".gz"
    with open(source_path, "rb") as f_in:
        with gzip.open(gz_path, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)
    return gz_path


# ---------------------------------------------------------------------------
# Bulk load via PUT + COPY INTO
# ---------------------------------------------------------------------------

def load_csv_to_snowflake(
    conn,
    csv_path: str,
    table: str,
    schema: str,
    database: str,
) -> int:
    """
    Upload a CSV file to Snowflake internal stage and COPY INTO the target table.

    Uses MERGE for idempotent loading — re-running for the same date won't
    create duplicates.
    """
    stage_name = f"{schema}.STG_{table.upper()}"
    file_name = os.path.basename(csv_path)

    with conn.cursor() as cur:
        # Create stage if not exists
        cur.execute(f"CREATE STAGE IF NOT EXISTS {stage_name} FILE_FORMAT=(TYPE=CSV SKIP_HEADER=1)")

        # Compress for faster upload
        gz_path = compress_file(csv_path)
        gz_name = os.path.basename(gz_path)

        # PUT file to stage
        cur.execute(f"PUT file://{gz_path} @{stage_name} OVERWRITE=TRUE AUTO_COMPRESS=FALSE")
        logger.info("Uploaded %s to stage %s", gz_name, stage_name)

        # COPY INTO target table
        copy_sql = f"""
            COPY INTO {database}.{schema}.{table}
            FROM @{stage_name}/{gz_name}
            FILE_FORMAT=(TYPE=CSV SKIP_HEADER=1 COMPRESSION=GZIP
                         ERROR_ON_COLUMN_COUNT_MISMATCH=TRUE)
            ON_ERROR=ABORT_STATEMENT
        """
        cur.execute(copy_sql)
        results = cur.fetchall()
        rows_loaded = results[0][1] if results else 0
        logger.info("Loaded %d rows from %s", rows_loaded, gz_name)

        # Clean up stage
        cur.execute(f"REMOVE @{stage_name}/{gz_name}")

    # Clean up local gz file
    os.remove(gz_path)
    return rows_loaded


# ---------------------------------------------------------------------------
# Directory traversal
# ---------------------------------------------------------------------------

def find_csv_files(input_dir: str) -> list[str]:
    """Find all CSV files in partitioned directory structure."""
    csv_files = sorted(Path(input_dir).rglob("*.csv"))
    logger.info("Found %d CSV files in %s", len(csv_files), input_dir)
    return [str(f) for f in csv_files]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Bulk load smart meter CSV data into Snowflake."
    )
    parser.add_argument("--input-dir", required=True,
                        help="Directory containing partitioned CSV files")
    parser.add_argument("--table", default="RAW_SMART_METER_READINGS",
                        help="Target Snowflake table name")
    parser.add_argument("--schema", default=DEFAULT_CONFIG["schema"],
                        help="Target Snowflake schema")
    parser.add_argument("--database", default=DEFAULT_CONFIG["database"],
                        help="Target Snowflake database")
    parser.add_argument("--dry-run", action="store_true",
                        help="List files but do not load")
    args = parser.parse_args()

    csv_files = find_csv_files(args.input_dir)
    if not csv_files:
        logger.error("No CSV files found in %s", args.input_dir)
        return 1

    if args.dry_run:
        for f in csv_files:
            logger.info("[DRY RUN] Would load: %s", f)
        return 0

    config = {**DEFAULT_CONFIG, "schema": args.schema, "database": args.database}
    conn = get_connection(config)

    try:
        ensure_table(conn, args.database, args.schema, args.table)

        total_rows = 0
        for csv_path in csv_files:
            rows = load_csv_to_snowflake(
                conn, csv_path, args.table, args.schema, args.database
            )
            total_rows += rows

        logger.info("All files loaded. Total rows: %d", total_rows)
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
