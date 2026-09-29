{{
    config(
        materialized='view',
        schema='staging',
        tags=['staging', 'hourly'],
        description='Cleaned and typed carbon intensity data from National Grid ESO API'
    )
}}

-- ===========================================================================
-- stg_grid_carbon.sql
-- ===========================================================================
-- Staging model: RAW.RAW_GRID_CARBON_INTENSITY -> STAGING.STG_GRID_CARBON
--
-- Cleans and types raw carbon intensity API responses:
--   - Casts timestamps to TIMESTAMP_TZ
--   - Normalizes intensity index values
--   - Handles missing actual values (forecast only periods)
--   - Adds derived column: carbon_category for reporting
--
-- Source: RAW.RAW_GRID_CARBON_INTENSITY (loaded by python_pipeline/extract_carbon_api.py)
-- Author: Sejal Gohil
-- ===========================================================================

WITH raw_carbon AS (
    SELECT
        period_from,
        period_to,
        forecast_intensity,
        actual_intensity,
        intensity_index,
        ingested_at
    FROM {{ source('raw', 'raw_grid_carbon_intensity') }}
),

deduplicated AS (
    SELECT *
    FROM raw_carbon
    QUALIFY ROW_NUMBER() OVER (
        PARTITION BY period_from
        ORDER BY ingested_at DESC
    ) = 1
),

typed AS (
    SELECT
        CAST(period_from AS TIMESTAMP_TZ) AS period_from,
        CAST(period_to AS TIMESTAMP_TZ) AS period_to,
        CAST(forecast_intensity AS FLOAT) AS forecast_intensity,
        CAST(actual_intensity AS FLOAT) AS actual_intensity,
        UPPER(TRIM(intensity_index)) AS intensity_index,
        ingested_at
    FROM deduplicated
),

enriched AS (
    SELECT
        period_from,
        period_to,
        forecast_intensity,
        -- Use actual where available, fall back to forecast
        COALESCE(actual_intensity, forecast_intensity) AS resolved_intensity,
        actual_intensity,
        intensity_index,
        -- Carbon category for reporting tiers
        CASE
            WHEN COALESCE(actual_intensity, forecast_intensity) < 100 THEN 'VERY_LOW'
            WHEN COALESCE(actual_intensity, forecast_intensity) < 200 THEN 'LOW'
            WHEN COALESCE(actual_intensity, forecast_intensity) < 300 THEN 'MODERATE'
            WHEN COALESCE(actual_intensity, forecast_intensity) < 400 THEN 'HIGH'
            ELSE 'VERY_HIGH'
        END AS carbon_category,
        -- Settlement date for joining with meter data
        CAST(period_from AS DATE) AS settlement_date,
        -- Settlement period (1-48)
        DATEDIFF('minute', DATE_TRUNC('day', period_from), period_from) / 30 + 1 AS settlement_period,
        ingested_at
    FROM typed
)

SELECT * FROM enriched
