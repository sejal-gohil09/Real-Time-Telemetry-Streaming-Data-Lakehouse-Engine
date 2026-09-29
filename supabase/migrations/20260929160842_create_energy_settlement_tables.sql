/*
# Create UK Energy Settlement Data Tables

This migration creates 5 tables to store real and simulated UK energy data:

1. **regions** — 14 UK GSP regions with nation grouping (England/Scotland/Wales)
2. **customers** — 200 simulated smart meter customers across 3 nations
3. **carbon_intensity** — 337 real half-hourly records from National Grid ESO API (Jan 1-8, 2025)
4. **smart_meter_readings** — ~67,200 half-hourly kWh readings (200 customers × 48 periods × 7 days)
5. **settlements** — Calculated settlement records joining readings with carbon intensity and tariffs

All tables use single-tenant (no auth) RLS policies allowing anon+authenticated access,
since this is a public demo dashboard with no sign-in.

## Tables

### regions
- id (serial PK)
- region_id (int, unique) — GSP region ID from National Grid
- shortname (text) — e.g. "North Scotland"
- nation (text) — England, Scotland, or Wales
- created_at (timestamptz)

### customers
- id (serial PK)
- customer_id (text, unique) — e.g. "CUST-0001"
- customer_name (text) — simulated name (PII-masked in app)
- mpan (text) — Meter Point Administration Number
- region_id (int, FK to regions)
- nation (text)
- tariff_type (text) — STANDARD, PEAK, or DYNAMIC
- created_at (timestamptz)

### carbon_intensity
- id (serial PK)
- period_start (timestamptz) — half-hour period start
- period_end (timestamptz)
- forecast (int) — forecast gCO2/kWh
- actual (int) — actual gCO2/kWh
- index (text) — very low / low / moderate / high / very high
- created_at (timestamptz)

### smart_meter_readings
- id (serial PK)
- customer_id (text)
- reading_time (timestamptz) — half-hour timestamp
- kwh (numeric) — consumption in kWh for this half-hour
- is_peak_period (boolean) — whether this falls in peak tariff hours
- day_of_week (int) — 0=Sunday to 6=Saturday
- hour_of_day (int) — 0-23
- season (text) — winter
- created_at (timestamptz)

### settlements
- id (serial PK)
- customer_id (text)
- reading_time (timestamptz)
- kwh (numeric)
- carbon_intensity_gco2 (int) — actual gCO2/kWh at that period
- kg_co2 (numeric) — calculated emissions
- tariff_band (text) — PEAK / OFF_PEAK / STANDARD
- cost_gbp (numeric) — calculated cost in GBP
- created_at (timestamptz)

## Security
- RLS enabled on all tables
- All tables allow anon+authenticated CRUD (public demo data, no sign-in)
*/

-- Regions table
CREATE TABLE IF NOT EXISTS regions (
  id serial PRIMARY KEY,
  region_id int UNIQUE NOT NULL,
  shortname text NOT NULL,
  nation text NOT NULL CHECK (nation IN ('England', 'Scotland', 'Wales')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_regions" ON regions;
CREATE POLICY "anon_select_regions" ON regions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_regions" ON regions;
CREATE POLICY "anon_insert_regions" ON regions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_regions" ON regions;
CREATE POLICY "anon_update_regions" ON regions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_regions" ON regions;
CREATE POLICY "anon_delete_regions" ON regions FOR DELETE
  TO anon, authenticated USING (true);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id serial PRIMARY KEY,
  customer_id text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  mpan text NOT NULL,
  region_id int REFERENCES regions(region_id),
  nation text NOT NULL CHECK (nation IN ('England', 'Scotland', 'Wales')),
  tariff_type text NOT NULL DEFAULT 'STANDARD',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE
  TO anon, authenticated USING (true);

-- Carbon intensity table
CREATE TABLE IF NOT EXISTS carbon_intensity (
  id serial PRIMARY KEY,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  forecast int,
  actual int,
  index text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE carbon_intensity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_carbon" ON carbon_intensity;
CREATE POLICY "anon_select_carbon" ON carbon_intensity FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_carbon" ON carbon_intensity;
CREATE POLICY "anon_insert_carbon" ON carbon_intensity FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_carbon" ON carbon_intensity;
CREATE POLICY "anon_update_carbon" ON carbon_intensity FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_carbon" ON carbon_intensity;
CREATE POLICY "anon_delete_carbon" ON carbon_intensity FOR DELETE
  TO anon, authenticated USING (true);

-- Smart meter readings table
CREATE TABLE IF NOT EXISTS smart_meter_readings (
  id serial PRIMARY KEY,
  customer_id text NOT NULL,
  reading_time timestamptz NOT NULL,
  kwh numeric(10,4) NOT NULL,
  is_peak_period boolean DEFAULT false,
  day_of_week int,
  hour_of_day int,
  season text DEFAULT 'winter',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE smart_meter_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_readings" ON smart_meter_readings;
CREATE POLICY "anon_select_readings" ON smart_meter_readings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_readings" ON smart_meter_readings;
CREATE POLICY "anon_insert_readings" ON smart_meter_readings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_readings" ON smart_meter_readings;
CREATE POLICY "anon_update_readings" ON smart_meter_readings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_readings" ON smart_meter_readings;
CREATE POLICY "anon_delete_readings" ON smart_meter_readings FOR DELETE
  TO anon, authenticated USING (true);

-- Settlements table
CREATE TABLE IF NOT EXISTS settlements (
  id serial PRIMARY KEY,
  customer_id text NOT NULL,
  reading_time timestamptz NOT NULL,
  kwh numeric(10,4) NOT NULL,
  carbon_intensity_gco2 int,
  kg_co2 numeric(10,6),
  tariff_band text,
  cost_gbp numeric(10,4),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settlements" ON settlements;
CREATE POLICY "anon_select_settlements" ON settlements FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_settlements" ON settlements;
CREATE POLICY "anon_insert_settlements" ON settlements FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_settlements" ON settlements;
CREATE POLICY "anon_update_settlements" ON settlements FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_settlements" ON settlements;
CREATE POLICY "anon_delete_settlements" ON settlements FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_readings_customer_time ON smart_meter_readings(customer_id, reading_time);
CREATE INDEX IF NOT EXISTS idx_readings_time ON smart_meter_readings(reading_time);
CREATE INDEX IF NOT EXISTS idx_carbon_period ON carbon_intensity(period_start);
CREATE INDEX IF NOT EXISTS idx_settlements_customer ON settlements(customer_id);
CREATE INDEX IF NOT EXISTS idx_settlements_time ON settlements(reading_time);
CREATE INDEX IF NOT EXISTS idx_customers_nation ON customers(nation);
