{{
    config(
        materialized='table',
        schema='marts',
        tags=['marts', 'daily'],
        description='Half-hourly settlement fact table joining meter consumption with carbon intensity',
        cluster_by=['settlement_date', 'country']
    )
}}

-- ===========================================================================
-- fct_half_hourly_settlement.sql
-- ===========================================================================
-- Mart model: Half-hourly settlement fact table
--
-- The core business fact table for the UK Energy Settlement Lakehouse.
-- Joins smart meter consumption with grid carbon intensity to calculate:
--   - Carbon emissions per reading (kWh * gCO2/kWh / 1000 = kgCO2)
--   - Estimated cost per reading (kWh * tariff)
--   - Peak vs off-peak classification
--   - Regional and national aggregations
--
-- Grain: one row per (mpan, settlement_date, settlement_period)
-- Sources: STAGING.STG_SMART_METERS, STAGING.STG_GRID_CARBON
-- Author: Sejal Gohil
-- ===========================================================================

WITH meter_readings AS (
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
        is_peak_period,
        day_type,
        season,
        hour_of_day,
        day_of_week
    FROM {{ ref('stg_smart_meters') }}
),

carbon_intensity AS (
    SELECT
        settlement_date,
        settlement_period,
        resolved_intensity,
        carbon_category,
        intensity_index
    FROM {{ ref('stg_grid_carbon') }}
),

-- Tariff structure (simplified UK domestic + business tariffs)
-- Peak: 07:00-09:00, 17:00-20:00
-- Off-peak: 00:00-07:00
-- Standard: all other times
tariff_rates AS (
    SELECT
        meter_readings.*,
        CASE
            WHEN is_peak_period = TRUE THEN 0.3594  -- GBP/kWh peak rate
            WHEN hour_of_day BETWEEN 0 AND 6 THEN 0.1392  -- off-peak
            ELSE 0.2735  -- standard
        END AS tariff_rate_gbp,
        CASE
            WHEN is_peak_period = TRUE THEN 'PEAK'
            WHEN hour_of_day BETWEEN 0 AND 6 THEN 'OFF_PEAK'
            ELSE 'STANDARD'
        END AS tariff_band
    FROM meter_readings
),

settlement AS (
    SELECT
        t.mpan,
        t.customer_id,
        t.region_name,
        t.country,
        t.gsp_group,
        t.settlement_date,
        t.settlement_period,
        t.period_start_utc,
        t.period_end_utc,
        t.kwh_consumed,
        t.meter_type,
        t.profile_type,
        t.is_peak_period,
        t.day_type,
        t.season,
        t.hour_of_day,
        t.day_of_week,
        t.tariff_band,
        t.tariff_rate_gbp,
        -- Carbon intensity at the settlement period
        c.resolved_intensity AS carbon_intensity_gco2_kwh,
        c.carbon_category,
        c.intensity_index,
        -- Carbon emissions: kWh * gCO2/kWh / 1000 = kgCO2
        ROUND(t.kwh_consumed * COALESCE(c.resolved_intensity, 0) / 1000.0, 6) AS carbon_emissions_kg,
        -- Estimated cost: kWh * tariff
        ROUND(t.kwh_consumed * t.tariff_rate_gbp, 4) AS estimated_cost_gbp,
        -- Surrogate key
        {{ dbt_utils.generate_surrogate_key(['t.mpan', 't.settlement_date', 't.settlement_period']) }} AS settlement_key
    FROM tariff_rates t
    LEFT JOIN carbon_intensity c
        ON t.settlement_date = c.settlement_date
        AND t.settlement_period = c.settlement_period
)

SELECT * FROM settlement
