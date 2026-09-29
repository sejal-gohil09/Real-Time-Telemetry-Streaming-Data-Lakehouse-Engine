-- ===========================================================================
-- 03_masking_policies.sql
-- ===========================================================================
-- Dynamic Data Masking Policies for GDPR Compliance
--
-- Masks Personally Identifiable Information (PII) at query time based on
-- the caller's role:
--   - GOVERNANCE_ROLE / ACCOUNTADMIN: sees clear values (unmasked)
--   - ANALYST_ROLE and sub-roles: sees masked/hashed values
--   - ETL_ROLE: sees clear values (needs real data for loading)
--
-- Masking rules:
--   - customer_name  -> SHA2 hash (one-way, irreversible)
--   - customer_id   -> partial mask (CUST-******1234)
--   - mpan          -> full mask except last 4 chars
--
-- Run as: ACCOUNTADMIN or GOVERNANCE_ROLE
-- Author: Sejal Gohil
-- ===========================================================================

USE ROLE GOVERNANCE_ROLE;
USE DATABASE UK_ENERGY_LAKEHOUSE;
USE WAREHOUSE ETL_WH;

-- ---------------------------------------------------------------------------
-- 1. Masking Policy: Customer Name (SHA2 hash)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE MASKING POLICY GOVERNANCE.mask_customer_name
    AS (val STRING) RETURNS STRING ->
        CASE
            WHEN CURRENT_ROLE() IN ('GOVERNANCE_ROLE', 'ACCOUNTADMIN', 'ETL_ROLE', 'DBT_ROLE')
                THEN val  -- unmasked for privileged roles
            ELSE
                SHA2(val)  -- irreversible hash for analysts
        END;

-- ---------------------------------------------------------------------------
-- 2. Masking Policy: Customer ID (partial mask)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE MASKING POLICY GOVERNANCE.mask_customer_id
    AS (val STRING) RETURNS STRING ->
        CASE
            WHEN CURRENT_ROLE() IN ('GOVERNANCE_ROLE', 'ACCOUNTADMIN', 'ETL_ROLE', 'DBT_ROLE')
                THEN val
            ELSE
                -- Show prefix + mask middle + show last 4
                CASE
                    WHEN LENGTH(val) > 8
                        THEN LEFT(val, 5) || RPAD('*', LENGTH(val) - 9, '*') || RIGHT(val, 4)
                    ELSE
                        '****'
                END
        END;

-- ---------------------------------------------------------------------------
-- 3. Masking Policy: MPAN (full mask except last 4)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE MASKING POLICY GOVERNANCE.mask_mpan
    AS (val STRING) RETURNS STRING ->
        CASE
            WHEN CURRENT_ROLE() IN ('GOVERNANCE_ROLE', 'ACCOUNTADMIN', 'ETL_ROLE', 'DBT_ROLE')
                THEN val
            ELSE
                -- Mask all but last 4 characters
                RPAD('*', GREATEST(LENGTH(val) - 4, 1), '*') || RIGHT(val, LEAST(4, LENGTH(val)))
        END;

-- ---------------------------------------------------------------------------
-- 4. Apply masking policies to tables
-- ---------------------------------------------------------------------------

-- Staging: smart meter readings
ALTER TABLE STAGING.STG_SMART_METERS
    MODIFY COLUMN mpan
    SET MASKING POLICY GOVERNANCE.mask_mpan;

ALTER TABLE STAGING.STG_SMART_METERS
    MODIFY COLUMN customer_id
    SET MASKING POLICY GOVERNANCE.mask_customer_id;

-- Marts: customer dimension
ALTER TABLE MARTS.DIM_CUSTOMERS
    MODIFY COLUMN customer_name
    SET MASKING POLICY GOVERNANCE.mask_customer_name;

ALTER TABLE MARTS.DIM_CUSTOMERS
    MODIFY COLUMN customer_id
    SET MASKING POLICY GOVERNANCE.mask_customer_id;

-- Marts: settlement fact table
ALTER TABLE MARTS.FCT_HALF_HOURLY_SETTLEMENT
    MODIFY COLUMN mpan
    SET MASKING POLICY GOVERNANCE.mask_mpan;

ALTER TABLE MARTS.FCT_HALF_HOURLY_SETTLEMENT
    MODIFY COLUMN customer_id
    SET MASKING POLICY GOVERNANCE.mask_customer_id;

-- ---------------------------------------------------------------------------
-- 5. GDPR audit trail
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS GOVERNANCE.PII_ACCESS_LOG (
    log_id          AUTOINCREMENT PRIMARY KEY,
    query_id        STRING,
    user_name       STRING NOT NULL,
    role_name       STRING NOT NULL,
    table_name      STRING NOT NULL,
    column_name     STRING NOT NULL,
    masking_applied BOOLEAN NOT NULL,
    query_timestamp TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
    rows_returned   INTEGER
);

-- Grant ETL_ROLE insert for logging
GRANT INSERT ON TABLE GOVERNANCE.PII_ACCESS_LOG TO ROLE ETL_ROLE;
GRANT SELECT ON TABLE GOVERNANCE.PII_ACCESS_LOG TO ROLE GOVERNANCE_ROLE;
GRANT SELECT ON TABLE GOVERNANCE.PII_ACCESS_LOG TO ROLE ACCOUNTADMIN;

-- ---------------------------------------------------------------------------
-- 6. Data retention policy (7-year retention for settlement data)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS GOVERNANCE.DATA_RETENTION_RULES (
    rule_id         AUTOINCREMENT PRIMARY KEY,
    table_name      STRING NOT NULL,
    retention_days  INTEGER NOT NULL,
    retention_reason STRING NOT NULL,
    created_at      TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO GOVERNANCE.DATA_RETENTION_RULES (table_name, retention_days, retention_reason)
VALUES
    ('MARTS.FCT_HALF_HOURLY_SETTLEMENT', 2555, 'Ofgem regulatory requirement: 7-year settlement data retention'),
    ('MARTS.DIM_CUSTOMERS',              2555, 'GDPR: retain customer data for contract duration + 7 years'),
    ('RAW.RAW_SMART_METER_READINGS',      365,  'Raw data archived after 1 year — staged data is canonical'),
    ('RAW.RAW_GRID_CARBON_INTENSITY',    2555, 'Carbon intensity forecasts retained for climate reporting'),
    ('GOVERNANCE.PII_ACCESS_LOG',        365,  'GDPR Article 30: 1-year audit log retention')
;

-- ---------------------------------------------------------------------------
-- 7. Verify policies are applied
-- ---------------------------------------------------------------------------

SELECT
    table_name,
    column_name,
    policy_name,
    policy_kind
FROM SNOWFLAKE.ACCOUNT_USAGE.POLICIES
WHERE policy_catalog = 'UK_ENERGY_LAKEHOUSE'
    AND policy_schema IN ('GOVERNANCE')
ORDER BY table_name, column_name;

-- ===========================================================================
-- End of 03_masking_policies.sql
-- ===========================================================================
