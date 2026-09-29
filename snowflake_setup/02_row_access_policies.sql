-- ===========================================================================
-- 02_row_access_policies.sql
-- ===========================================================================
-- Row-Level Security (RLS) Policies for the UK Energy Settlement Lakehouse.
--
-- Enforces country-based data isolation so that:
--   - ENGLAND_ANALYST role sees only English meter data
--   - SCOTLAND_ANALYST role sees only Scottish meter data
--   - WALES_ANALYST role sees only Welsh meter data
--   - GOVERNANCE_ROLE sees all data (full bypass)
--
-- This satisfies the regional data residency requirements where each
-- devolved administration controls access to its own settlement data.
--
-- Run as: ACCOUNTADMIN or GOVERNANCE_ROLE
-- Author: Sejal Gohil
-- ===========================================================================

USE ROLE GOVERNANCE_ROLE;
USE DATABASE UK_ENERGY_LAKEHOUSE;
USE WAREHOUSE ETL_WH;

-- ---------------------------------------------------------------------------
-- 1. Regional analyst roles (sub-roles under ANALYST_ROLE)
-- ---------------------------------------------------------------------------

USE ROLE ACCOUNTADMIN;

CREATE ROLE IF NOT EXISTS ENGLAND_ANALYST
    COMMENT = 'Analysts restricted to English settlement data';
CREATE ROLE IF NOT EXISTS SCOTLAND_ANALYST
    COMMENT = 'Analysts restricted to Scottish settlement data';
CREATE ROLE IF NOT EXISTS WALES_ANALYST
    COMMENT = 'Analysts restricted to Welsh settlement data';

GRANT ROLE ENGLAND_ANALYST  TO ROLE ANALYST_ROLE;
GRANT ROLE SCOTLAND_ANALYST TO ROLE ANALYST_ROLE;
GRANT ROLE WALES_ANALYST    TO ROLE ANALYST_ROLE;

-- Grant warehouse + schema usage to regional roles
GRANT USAGE ON WAREHOUSE REPORTING_WH TO ROLE ENGLAND_ANALYST;
GRANT USAGE ON WAREHOUSE REPORTING_WH TO ROLE SCOTLAND_ANALYST;
GRANT USAGE ON WAREHOUSE REPORTING_WH TO ROLE WALES_ANALYST;

GRANT USAGE ON SCHEMA UK_ENERGY_LAKEHOUSE.MARTS TO ROLE ENGLAND_ANALYST;
GRANT USAGE ON SCHEMA UK_ENERGY_LAKEHOUSE.MARTS TO ROLE SCOTLAND_ANALYST;
GRANT USAGE ON SCHEMA UK_ENERGY_LAKEHOUSE.MARTS TO ROLE WALES_ANALYST;

GRANT SELECT ON ALL TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.MARTS TO ROLE ENGLAND_ANALYST;
GRANT SELECT ON ALL TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.MARTS TO ROLE SCOTLAND_ANALYST;
GRANT SELECT ON ALL TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.MARTS TO ROLE WALES_ANALYST;

GRANT SELECT ON FUTURE TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.MARTS TO ROLE ENGLAND_ANALYST;
GRANT SELECT ON FUTURE TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.MARTS TO ROLE SCOTLAND_ANALYST;
GRANT SELECT ON FUTURE TABLES IN SCHEMA UK_ENERGY_LAKEHOUSE.MARTS TO ROLE WALES_ANALYST;

USE ROLE GOVERNANCE_ROLE;

-- ---------------------------------------------------------------------------
-- 2. Row Access Policy: Country-based filtering
-- ---------------------------------------------------------------------------

CREATE OR REPLACE ROW ACCESS POLICY GOVERNANCE.country_rls_policy
    AS (country_col STRING) RETURNS BOOLEAN ->
        CASE
            -- GOVERNANCE_ROLE sees everything
            WHEN CURRENT_ROLE() = 'GOVERNANCE_ROLE' THEN TRUE
            -- ACCOUNTADMIN sees everything
            WHEN CURRENT_ROLE() = 'ACCOUNTADMIN' THEN TRUE
            -- Regional analysts see only their country
            WHEN CURRENT_ROLE() = 'ENGLAND_ANALYST'  AND country_col = 'England'  THEN TRUE
            WHEN CURRENT_ROLE() = 'SCOTLAND_ANALYST' AND country_col = 'Scotland' THEN TRUE
            WHEN CURRENT_ROLE() = 'WALES_ANALYST'    AND country_col = 'Wales'    THEN TRUE
            -- Default: deny
            ELSE FALSE
        END;

-- ---------------------------------------------------------------------------
-- 3. Apply RLS to staging and mart tables
-- ---------------------------------------------------------------------------

-- Staging: smart meter readings (raw + typed)
ALTER TABLE STAGING.STG_SMART_METERS
    ADD ROW ACCESS POLICY GOVERNANCE.country_rls_policy ON (country);

-- Marts: fact table
ALTER TABLE MARTS.FCT_HALF_HOURLY_SETTLEMENT
    ADD ROW ACCESS POLICY GOVERNANCE.country_rls_policy ON (country);

-- Marts: dimension table (customers are tagged by country)
ALTER TABLE MARTS.DIM_CUSTOMERS
    ADD ROW ACCESS POLICY GOVERNANCE.country_rls_policy ON (country);

-- ---------------------------------------------------------------------------
-- 4. Row Access Policy: ETL pipeline isolation
-- ---------------------------------------------------------------------------

-- ETL_ROLE can see all rows for loading purposes (no country filter)
-- This is handled by granting ETL_ROLE the GOVERNANCE_ROLE hierarchy,
-- which already has full access via the policy above.
-- No additional policy needed — the role hierarchy handles it.

-- ---------------------------------------------------------------------------
-- 5. Tag-based RLS for sensitive columns (optional extension)
-- ---------------------------------------------------------------------------

CREATE TAG IF NOT EXISTS GOVERNANCE.DATA_SENSITIVITY
    COMMENT = 'Tags columns as PUBLIC, INTERNAL, or RESTRICTED';

ALTER TABLE MARTS.DIM_CUSTOMERS
    TAG COLUMN (
        customer_name = 'RESTRICTED',
        customer_id   = 'INTERNAL',
        region_name   = 'PUBLIC',
        country       = 'PUBLIC'
    );

ALTER TABLE MARTS.FCT_HALF_HOURLY_SETTLEMENT
    TAG COLUMN (
        mpan          = 'RESTRICTED',
        customer_id   = 'INTERNAL',
        kwh_consumed  = 'INTERNAL',
        region_name   = 'PUBLIC',
        country       = 'PUBLIC'
    );

-- ---------------------------------------------------------------------------
-- 6. Audit logging for RLS policy changes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS GOVERNANCE.RLS_AUDIT_LOG (
    audit_id        AUTOINCREMENT PRIMARY KEY,
    event_type      STRING NOT NULL,   -- POLICY_CREATED / POLICY_APPLIED / POLICY_DROPPED
    table_name      STRING NOT NULL,
    policy_name     STRING,
    column_name     STRING,
    changed_by      STRING NOT NULL,
    changed_at      TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP()
);

GRANT INSERT ON TABLE GOVERNANCE.RLS_AUDIT_LOG TO ROLE GOVERNANCE_ROLE;
GRANT SELECT ON TABLE GOVERNANCE.RLS_AUDIT_LOG TO ROLE ACCOUNTADMIN;

-- ===========================================================================
-- End of 02_row_access_policies.sql
-- ===========================================================================
