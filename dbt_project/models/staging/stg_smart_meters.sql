{{
    config(
        materialized='view',
        schema='staging',
        tags=['staging', 'hourly'],
        description='Cleaned and typed smart meter half-hourly readings from RAW layer'
    )
}}

-- ===========================================================================
-- stg_smart_meters.sql
-- ===========================================================================
-- Staging model: RAW.RAW_SMART_METER_READINGS -> STAGING.STG_SMART_METERS
--
-- Cleans, types, and deduplicates raw smart meter readings:
--   - Casts timestamps to TIMESTAMP_TZ
--   - Filters out null/zero consumption rows
--   - Deduplicates on (mpan, settlement_date, settlement_period)
--   - Adds derived columns: day_of_week, hour_of_day, is_peak_period
--   - Applies PII masking on customer_id via macro
--
-- Source: RAW.RAW_SMART_METER_READINGS (loaded by python_pipeline/load_to_snowflake.py)
-- Author: Sejal Gohil
-- ===========================================================================

WITH raw_readings AS (
    SELECT
        mpan,
        customer_id,
        region_name,
        country,
        gsp_group,
        settlement_date,
        settlement_period,
        period_start_utc,
        period_end_utc,
        kwh_consumed,
        meter_type,
        profile_type,
        ingested_at
    FROM {{ source('raw', 'raw_smart_meter_readings') }}
),

deduplicated AS (
    SELECT *
    FROM raw_readings
    QUALIFY ROW_NUMBER() OVER (
        PARTITION BY mpan, settlement_date, settlement_period
        ORDER BY ingested_at DESC
    ) = 1
),

typed AS (
    SELECT
        mpan,
        -- Apply PII masking on customer_id
        {{ mask_partial('customer_id', visible_prefix=5, visible_suffix=4, alias='customer_id') }},
        region_name,
        country,
        gsp_group,
        CAST(settlement_date AS DATE) AS settlement_date,
        settlement_period,
        CAST(period_start_utc AS TIMESTAMP_TZ) AS period_start_utc,
        CAST(period_end_utc AS TIMESTAMP_TZ) AS period_end_utc,
        CAST(kwh_consumed AS FLOAT) AS kwh_consumed,
        meter_type,
        profile_type,
        ingested_at
    FROM deduplicated
),

enriched AS (
    SELECT
        *,
        -- Derived: day of week (1=Monday .. 7=Sunday)
        DAYOFWEEK(settlement_date) + 1 AS day_of_week,
        -- Derived: hour of day (0-23)
        EXTRACT(HOUR FROM period_start_utc) AS hour_of_day,
        -- Derived: is peak period (07:00-09:00 or 17:00-20:00)
        CASE
            WHEN hour_of_day BETWEEN 7 AND 9  THEN TRUE
            WHEN hour_of_day BETWEEN 17 AND 20 THEN TRUE
            ELSE FALSE
        END AS is_peak_period,
        -- Derived: day type
        CASE
            WHEN DAYOFWEEK(settlement_date) IN (0, 6) THEN 'WEEKEND'
            ELSE 'WEEKDAY'
        END AS day_type,
        -- Derived: season
        CASE
            WHEN MONTH(settlement_date) IN (12, 1, 2) THEN 'WINTER'
            WHEN MONTH(settlement_date) IN (3, 4, 5) THEN 'SPRING'
            WHEN MONTH(settlement_date) IN (6, 7, 8) THEN 'SUMMER'
            ELSE 'AUTUMN'
        END AS season
    FROM typed
    WHERE kwh_consumed > 0
)

SELECT * FROM enriched
