-- ===========================================================================
-- 01_setup_roles_and_wh.sql
-- ===========================================================================
-- Role-Based Access Control (RBAC), Schemas, and Warehouses for the
-- UK Energy Settlement Lakehouse on Snowflake.
--
-- This script creates:
--   1. Functional roles (ETL_ROLE, ANALYST_ROLE, GOVERNANCE_ROLE)
--   2. A dedicated ETL warehouse (sized for bulk loading)
--   3. A cost-optimized reporting warehouse (for Power BI)
--   4. Database and schemas (RAW, STAGING, MARTS, GOVERNANCE)
--   5. Grants wiring roles to schemas and warehouses
--
-- Run as: ACCOUNTADMIN or SECURITYADMIN + SYSADMIN
-- Author: Sejal Gohil
-- ===========================================================================

USE ROLE ACCOUNTADMIN;

-- ---------------------------------------------------------------------------
-- 1. Functional Roles
-- ---------------------------------------------------------------------------

CREATE ROLE IF NOT EXISTS ETL_ROLE
    COMMENT = 'Executes data ingestion pipelines (Python extractors + loaders)';

CREATE ROLE IF NOT EXISTS ANALYST_ROLE
    COMMENT = 'Read-only access to marts for BI dashboards and ad-hoc analysis';

CREATE ROLE IF NOT EXISTS GOVERNANCE_ROLE
    COMMENT = 'Data governance: PII masking policies, row access policies, audits';

CREATE ROLE IF NOT EXISTS DBT_ROLE
    COMMENT = 'Runs dbt transformations (staging + marts)';

-- Role hierarchy: ETL_ROLE, ANALYST_ROLE, DBT_ROLE report to GOVERNANCE_ROLE
GRANT ROLE ETL_ROLE       TO ROLE GOVERNANCE_ROLE;
GRANT ROLE DBT_ROLE       TO ROLE GOVERNANCE_ROLE;
GRANT ROLE ANALYST_ROLE   TO ROLE GOVERNANCE_ROLE;
GRANT ROLE GOVERNANCE_ROLE TO ROLE SYSADMIN;

-- Grant roles to the pipeline service users
CREATE USER IF NOT EXISTS carbon_loader
    PASSWORD = ''
    DEFAULT_ROLE = ETL_ROLE
    DEFAULT_WAREHOUSE = ETL_WH
    COMMENT = 'Service user for carbon intensity API extractor';

CREATE USER IF NOT EXISTS meter_loader
    PASSWORD = ''
    DEFAULT_ROLE = ETL_ROLE
    DEFAULT_WAREHOUSE = ETL_WH
    COMMENT = 'Service user for smart meter data loader';

CREATE USER IF NOT EXISTS dbt_runner
    PASSWORD = ''
    DEFAULT_ROLE = DBT_ROLE
    DEFAULT_WAREHOUSE = ETL_WH
    COMMENT = 'Service user for dbt Cloud / CI runs';

CREATE USER IF NOT EXISTS power_bi_user
    PASSWORD = ''
    DEFAULT_ROLE = ANALYST_ROLE
    DEFAULT_WAREHOUSE = REPORTING_WH
    COMMENT = 'Service user for Power BI dashboards';

GRANT ROLE ETL_ROLE     TO USER carbon_loader;
GRANT ROLE ETL_ROLE     TO USER meter_loader;
GRANT ROLE DBT_ROLE    TO USER dbt_runner;
GRANT ROLE ANALYST_ROLE TO USER power_bi_user;

-- ---------------------------------------------------------------------------
-- 2. Warehouses
-- ---------------------------------------------------------------------------

CREATE WAREHOUSE IF NOT EXISTS ETL_WH
    WAREHOUSE_SIZE = 'X-LARGE'
    WAREHOUSE_TYPE = 'STANDARD'
    AUTO_SUSPEND = 60
    AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'Bulk loading and dbt transformations';

CREATE WAREHOUSE IF NOT EXISTS REPORTING_WH
    WAREHOUSE_SIZE = 'MEDIUM'
    WAREHOUSE_TYPE = 'STANDARD'
    AUTO_SUSPEND = 120
    AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'Power BI and ad-hoc analyst queries';

GRANT USAGE ON WAREHOUSE ETL_WH       TO ROLE ETL_ROLE;
GRANT USAGE ON WAREHOUSE ETL_WH       TO ROLE DBT_ROLE;
GRANT USAGE ON WAREHOUSE REPORTING_WH TO ROLE ANALYST_ROLE;

-- ---------------------------------------------------------------------------
-- 3. Database and Schemas
-- ---------------------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS UK_ENERGY_LAKEHOUSE
    COMMENT = 'UK Energy Settlement Data Lakehouse — smart meters, carbon intensity, settlements';

USE DATABASE UK_ENERGY_LAKEHOUSE;

CREATE SCHEMA IF NOT EXISTS RAW
    COMMENT = 'Landing zone for raw ingested data (no transformations)';
CREATE SCHEMA IF NOT EXISTS STAGING
    COMMENT = 'Cleaned, typed, and deduplicated source data (dbt staging models)';
CREATE SCHEMA IF NOT EXISTS MARTS
    COMMENT = 'Business-level dimensional models for analytics and settlement';
CREATE SCHEMA IF NOT EXISTS GOVERNANCE
    COMMENT = 'Data quality logs, PII masking policies, row access policies, audit trail';
CREATE SCHEMA IF NOT EXISTS SHARED
    COMMENT = 'Shared mappings (region lookup, GSP groups, calendar)';

-- ---------------------------------------------------------------------------
-- 4. Schema Grants
-- ---------------------------------------------------------------------------

-- ETL_ROLE: full access to RAW, read on SHARED
GRANT USAGE ON SCHEMA UK_ENERGY_LAKEHOUSE.RAW    TO ROLE ETL_ROLE;
GRANT ALL PRIVILEGES ON SCHEMA UK_ENERGY_LAKEHOUSE.RAW TO ROLE ETL_ROLE;
GRANT USAGE ON SCHEMA UK_ENERGY_LAKEHOUSE.SHARED TO ROLE ETL_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.SHARED TO ROLE ETL_ROLE;

-- DBT_ROLE: read RAW, write STAGING + MARTS, read SHARED
GRANT USAGE ON SCHEMA UK_ENERGY_LAKEHOUSE.RAW     TO ROLE DBT_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.RAW TO ROLE DBT_ROLE;
GRANT USAGE ON SCHEMA UK_ENERGY_LAKEHOUSE.STAGING TO ROLE DBT_ROLE;
GRANT ALL PRIVILEGES ON SCHEMA UK_ENERGY_LAKEHOUSE.STAGING TO ROLE DBT_ROLE;
GRANT USAGE ON SCHEMA UK_ENERGY_LAKEHOUSE.MARTS   TO ROLE DBT_ROLE;
GRANT ALL PRIVILEGES ON SCHEMA UK_ENERGY_LAKEHOUSE.MARTS   TO ROLE DBT_ROLE;
GRANT USAGE ON SCHEMA UK_ENERGY_LAKEHOUSE.SHARED  TO ROLE DBT_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.SHARED TO ROLE DBT_ROLE;

-- ANALYST_ROLE: read-only on MARTS and SHARED
GRANT USAGE ON SCHEMA UK_ENERGY_LAKEHOUSE.MARTS  TO ROLE ANALYST_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.MARTS TO ROLE ANALYST_ROLE;
GRANT USAGE ON SCHEMA UK_ENERGY_LAKEHOUSE.SHARED TO ROLE ANALYST_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.SHARED TO ROLE ANALYST_ROLE;

-- GOVERNANCE_ROLE: manage GOVERNANCE schema, audit access
GRANT USAGE ON SCHEMA UK_ENERGY_LAKEHOUSE.GOVERNANCE TO ROLE GOVERNANCE_ROLE;
GRANT ALL PRIVILEGES ON SCHEMA UK_ENERGY_LAKEHOUSE.GOVERNANCE TO ROLE GOVERNANCE_ROLE;

-- Future grants so new tables inherit correct permissions
GRANT SELECT ON FUTURE TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.MARTS TO ROLE ANALYST_ROLE;
GRANT ALL PRIVILEGES ON FUTURE TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.STAGING TO ROLE DBT_ROLE;
GRANT ALL PRIVILEGES ON FUTURE TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.MARTS TO ROLE DBT_ROLE;

-- ---------------------------------------------------------------------------
-- 5. Audit table for data lineage
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS GOVERNANCE.INGESTION_AUDIT (
    audit_id        AUTOINCREMENT PRIMARY KEY,
    pipeline_name   STRING NOT NULL,
    source_system   STRING NOT NULL,
    target_table    STRING NOT NULL,
    rows_loaded     INTEGER,
    status          STRING NOT NULL,  -- SUCCESS / FAILED / PARTIAL
    error_message   STRING,
    run_started_at  TIMESTAMP_TZ NOT NULL,
    run_completed_at TIMESTAMP_TZ,
    run_by_user     STRING NOT NULL
);

GRANT INSERT ON TABLE UK_ENERGY_LAKEHOUSE.GOVERNANCE.INGESTION_AUDIT TO ROLE ETL_ROLE;
GRANT SELECT ON TABLE UK_ENERGY_LAKEHOUSE.GOVERNANCE.INGESTION_AUDIT TO ROLE GOVERNANCE_ROLE;

-- ---------------------------------------------------------------------------
-- 6. Shared reference data
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS SHARED.REGION_LOOKUP (
    region_name     STRING PRIMARY KEY,
    country         STRING NOT NULL,
    gsp_group       STRING NOT NULL,
    dno_region_code STRING,
    population_2024 INTEGER
);

CREATE TABLE IF NOT EXISTS SHARED.SETTLEMENT_CALENDAR (
    settlement_date DATE PRIMARY KEY,
    settlement_year  INTEGER NOT NULL,
    settlement_month INTEGER NOT NULL,
    is_weekday       BOOLEAN NOT NULL,
    is_holiday       BOOLEAN NOT NULL,
    season           STRING NOT NULL  -- WINTER / SPRING / SUMMER / AUTUMN
);

GRANT SELECT ON ALL TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.SHARED TO ROLE ETL_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.SHARED TO ROLE DBT_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.SHARED TO ROLE ANALYST_ROLE;

-- ===========================================================================
-- End of 01_setup_roles_and_wh.sql
-- ===========================================================================
