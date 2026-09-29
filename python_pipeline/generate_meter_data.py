"""
generate_meter_data.py
======================
Simulated UK half-hourly smart meter electricity readings generator.

Produces realistic synthetic data for ~50,000 smart meters across
England, Scotland, and Wales. Each meter has:
  - A unique MPAN (Meter Point Administration Number)
  - An associated customer and region
  - Half-hourly kWh consumption with seasonal/time-of-day patterns
  - A GSP (Grid Supply Point) group identifier

Output: CSV files partitioned by date, or direct Snowflake load.

Usage:
    python generate_meter_data.py --date 2025-01-01 --meters 50000
    python generate_meter_data.py --date 2025-01-01 --output-dir ./data

Author: Sejal Gohil
"""

import argparse
import csv
import hashlib
import logging
import os
import random
import sys
from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REGIONS = [
    # (region_name, country, gsp_group, num_customers_weight)
    ("East England", "England", "_A", 15),
    ("East Midlands", "England", "_B", 10),
    ("London", "England", "_C", 20),
    ("Merseyside & North Wales", "Wales", "_D", 8),
    ("Midlands", "England", "_E", 12),
    ("North Eastern England", "England", "_F", 10),
    ("North Western England", "England", "_G", 12),
    ("Northern Scotland", "Scotland", "_H", 5),
    ("Southern Scotland", "Scotland", "_J", 6),
    ("South Eastern England", "England", "_K", 15),
    ("South Western England", "England", "_L", 12),
    ("Southern England", "England", "_M", 10),
    ("Yorkshire", "England", "_N", 10),
    ("North Wales & South Wales", "Wales", "_P", 8),
]

METER_TYPES = ["SMETS1", "SMETS2"]
PROFILE_TYPES = ["domestic", "small_business", "industrial"]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

random.seed(42)


# ---------------------------------------------------------------------------
# Meter registry generation
# ---------------------------------------------------------------------------

def generate_meter_registry(num_meters: int) -> list[dict]:
    """Generate a registry of smart meters with customer and region info."""
    weighted_regions: list[tuple[str, str, str]] = []
    for name, country, gsp, weight in REGIONS:
        weighted_regions.extend([(name, country, gsp)] * weight)

    meters: list[dict] = []
    for i in range(num_meters):
        region_name, country, gsp = random.choice(weighted_regions)
        mpan = f"S{hashlib.sha256(str(i).encode()).hexdigest()[:13].upper()}"
        customer_id = f"CUST-{100000 + i:06d}"

        meters.append({
            "mpan": mpan,
            "customer_id": customer_id,
            "customer_name": f"Customer_{i + 1:06d}",
            "region_name": region_name,
            "country": country,
            "gsp_group": gsp,
            "meter_type": random.choice(METER_TYPES),
            "profile_type": random.choices(
                PROFILE_TYPES, weights=[70, 20, 10]
            )[0],
            "installed_date": (
                datetime(2023, 1, 1, tzinfo=timezone.utc)
                + timedelta(days=random.randint(0, 730))
            ).strftime("%Y-%m-%d"),
        })

    logger.info("Generated registry of %d smart meters", len(meters))
    return meters


# ---------------------------------------------------------------------------
# Half-hourly consumption generation
# ---------------------------------------------------------------------------

# Time-of-day consumption multipliers (48 half-hour slots)
# Peak: 07:00-09:00 and 17:00-20:00
def _consumption_curve() -> list[float]:
    """Return 48 half-hourly multipliers mimicking UK domestic usage."""
    base = [0.3] * 48
    # Morning peak (07:00-09:00 = slots 14-17)
    for s in range(14, 18):
        base[s] = 1.8
    # Evening peak (17:00-20:00 = slots 34-39)
    for s in range(34, 40):
        base[s] = 2.0
    # Daytime baseline (09:00-17:00 = slots 18-33)
    for s in range(18, 34):
        base[s] = 0.8
    # Nighttime (00:00-07:00 = slots 0-13)
    for s in range(0, 14):
        base[s] = 0.35
    return base


CONSUMPTION_CURVE = _consumption_curve()

# Seasonal multipliers by month (Jan=0 .. Dec=11)
SEASONAL_FACTORS = [1.25, 1.20, 1.05, 0.85, 0.75, 0.70,
                     0.68, 0.72, 0.80, 0.90, 1.10, 1.22]


def generate_half_hourly_readings(
    meter: dict, target_date: str
) -> list[dict]:
    """Generate 48 half-hourly readings for a single meter on a given date."""
    date_obj = datetime.strptime(target_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    month_idx = date_obj.month - 1
    seasonal = SEASONAL_FACTORS[month_idx]

    profile_multiplier = {
        "domestic": 0.5,
        "small_business": 2.5,
        "industrial": 10.0,
    }[meter["profile_type"]]

    readings: list[dict] = []
    for slot in range(48):
        period_start = date_obj + timedelta(minutes=30 * slot)
        period_end = period_start + timedelta(minutes=30)

        base_kwh = CONSUMPTION_CURVE[slot] * seasonal * profile_multiplier
        noise = random.gauss(1.0, 0.1)
        kwh = round(max(0, base_kwh * noise), 4)

        readings.append({
            "mpan": meter["mpan"],
            "customer_id": meter["customer_id"],
            "region_name": meter["region_name"],
            "country": meter["country"],
            "gsp_group": meter["gsp_group"],
            "settlement_date": target_date,
            "settlement_period": slot + 1,
            "period_start_utc": period_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "period_end_utc": period_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "kwh_consumed": kwh,
            "meter_type": meter["meter_type"],
            "profile_type": meter["profile_type"],
        })

    return readings


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def write_csv(readings: list[dict], output_dir: str, date_str: str) -> str:
    """Write readings to a partitioned CSV file."""
    partition_dir = os.path.join(output_dir, f"settlement_date={date_str}")
    os.makedirs(partition_dir, exist_ok=True)
    filepath = os.path.join(partition_dir, "meter_readings.csv")

    fieldnames = list(readings[0].keys())
    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(readings)

    return filepath


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate simulated UK half-hourly smart meter readings."
    )
    parser.add_argument("--date", required=True, help="Settlement date (YYYY-MM-DD)")
    parser.add_argument("--meters", type=int, default=50000,
                        help="Number of smart meters to simulate")
    parser.add_argument("--output-dir", default="./data",
                        help="Directory for CSV output")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for reproducibility")
    args = parser.parse_args()

    random.seed(args.seed)
    os.makedirs(args.output_dir, exist_ok=True)

    logger.info("Generating meter registry for %d meters...", args.meters)
    registry = generate_meter_registry(args.meters)

    all_readings: list[dict] = []
    for meter in registry:
        readings = generate_half_hourly_readings(meter, args.date)
        all_readings.extend(readings)

    logger.info("Generated %d half-hourly readings for %s",
                len(all_readings), args.date)

    filepath = write_csv(all_readings, args.output_dir, args.date)
    logger.info("Written to %s", filepath)

    return 0


if __name__ == "__main__":
    sys.exit(main())
