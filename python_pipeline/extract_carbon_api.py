"""
extract_carbon_api.py
=====================
Live REST API extractor for UK National Grid Carbon Intensity data.

Pulls half-hourly carbon intensity forecasts and generation mix data
from the National Grid ESO Carbon Intensity API and writes raw JSON
to Snowflake's RAW schema for downstream dbt processing.

API docs: https://api.carbonintensity.org.uk/

Usage:
    python extract_carbon_api.py --start 2025-01-01 --end 2025-01-02

Author: Sejal Gohil
"""

import argparse
import logging
import sys
from datetime import datetime, timedelta, timezone

import requests
from snowflake.connector import connect
from snowflake.connector.pandas_tools import write_pandas

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

API_BASE_URL = "https://api.carbonintensity.org.uk"
API_ENDPOINT = "/intensity/{start}/pt{end}"  # half-hourly periods

SNOWFLAKE_CONFIG = {
    "account": "your_account.snowflakecomputing.com",
    "user": "CARBON_LOADER",
    "password": None,  # set via environment variable
    "warehouse": "ETL_WH",
    "database": "UK_ENERGY_LAKEHOUSE",
    "schema": "RAW",
    "role": "ETL_ROLE",
}

TABLE_NAME = "RAW_GRID_CARBON_INTENSITY"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# API extraction
# ---------------------------------------------------------------------------

def fetch_carbon_intensity(start_date: str, end_date: str) -> list[dict]:
    """
    Fetch half-hourly carbon intensity data from National Grid ESO API.

    The API accepts dates in ISO 8601 format (YYYY-MM-DDThh:mmZ).
    Each response contains a list of half-hour periods with:
      - from/to timestamps
      - forecast carbon intensity (gCO2/kWh)
      - actual carbon intensity (if available)
      - index (very low / low / moderate / high / very high)
    """
    all_records: list[dict] = []
    current = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
    end = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)

    logger.info("Fetching carbon intensity data from %s to %s", start_date, end_date)

    while current < end:
        chunk_end = min(current + timedelta(days=14), end)  # API max 14-day window
        url = (
            f"{API_BASE_URL}/intensity/"
            f"{current.strftime('%Y-%m-%dT%H:%MZ')}/"
            f"pt{chunk_end.strftime('%Y-%m-%dT%H:%MZ')}"
        )

        logger.debug("API call: %s", url)
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            data = response.json().get("data", [])

            for record in data:
                all_records.append({
                    "period_from": record.get("from"),
                    "period_to": record.get("to"),
                    "forecast_intensity": record.get("intensity", {}).get("forecast"),
                    "actual_intensity": record.get("intensity", {}).get("actual"),
                    "intensity_index": record.get("intensity", {}).get("index"),
                    "ingested_at": datetime.now(timezone.utc).isoformat(),
                })
        except requests.RequestException as exc:
            logger.error("API request failed for %s: %s", url, exc)
            raise

        current = chunk_end
        logger.info("Fetched %d records so far...", len(all_records))

    logger.info("Total records fetched: %d", len(all_records))
    return all_records


# ---------------------------------------------------------------------------
# Snowflake loading
# ---------------------------------------------------------------------------

def load_to_snowflake(records: list[dict]) -> None:
    """Write raw carbon intensity records to Snowflake RAW schema."""
    if not records:
        logger.warning("No records to load — skipping Snowflake write.")
        return

    import pandas as pd

    df = pd.DataFrame(records)
    logger.info("Loading %d rows into %s.%s", len(df), SNOWFLAKE_CONFIG["schema"], TABLE_NAME)

    conn = connect(
        account=SNOWFLAKE_CONFIG["account"],
        user=SNOWFLAKE_CONFIG["user"],
        password=SNOWFLAKE_CONFIG["password"],
        warehouse=SNOWFLAKE_CONFIG["warehouse"],
        database=SNOWFLAKE_CONFIG["database"],
        schema=SNOWFLAKE_CONFIG["schema"],
        role=SNOWFLAKE_CONFIG["role"],
    )

    try:
        success, nchunks, nrows, _ = write_pandas(
            conn,
            df,
            TABLE_NAME,
            auto_create_table=True,
            overwrite=False,
        )
        logger.info("Snowflake load complete: %d rows in %d chunks (success=%s)",
                     nrows, nchunks, success)
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract UK National Grid carbon intensity data and load to Snowflake."
    )
    parser.add_argument("--start", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", required=True, help="End date (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch data but do not load to Snowflake")
    args = parser.parse_args()

    records = fetch_carbon_intensity(args.start, args.end)

    if args.dry_run:
        logger.info("Dry run — %d records would have been loaded.", len(records))
    else:
        load_to_snowflake(records)

    return 0


if __name__ == "__main__":
    sys.exit(main())
