{{
    config(
        materialized='table',
        schema='marts',
        tags=['marts', 'daily'],
        description='Customer dimension with PII masking and regional attributes'
    )
}}

-- ===========================================================================
-- dim_customers.sql
-- ===========================================================================
-- Mart model: Customer dimension table
--
-- One row per customer with:
--   - PII-masked customer name (SHA2 hash for non-privileged roles)
--   - Region and country attributes (for RLS joining)
--   - Customer profile classification
--   - First-seen and last-seen timestamps
--
-- Grain: one row per customer_id
-- Source: STAGING.STG_SMART_METERS
-- Author: Sejal Gohil
-- ===========================================================================

WITH smart_meter_data AS (
    SELECT
        customer_id,
        {{ mask_customer_pii('customer_id', 'customer_id_masked') }},
        region_name,
        country,
        gsp_group,
        meter_type,
        profile_type,
        settlement_date,
        mpan
    FROM {{ ref('stg_smart_meters') }}
),

customer_aggregated AS (
    SELECT
        customer_id,
        ANY_VALUE(customer_id_masked) AS customer_name_masked,
        ANY_VALUE(region_name) AS region_name,
        ANY_VALUE(country) AS country,
        ANY_VALUE(gsp_group) AS gsp_group,
        ANY_VALUE(meter_type) AS meter_type,
        ANY_VALUE(profile_type) AS profile_type,
        COUNT(DISTINCT mpan) AS num_meters,
        MIN(settlement_date) AS first_seen_date,
        MAX(settlement_date) AS last_seen_date,
        COUNT(*) AS total_readings
    FROM smart_meter_data
    GROUP BY customer_id
),

final AS (
    SELECT
        -- Surrogate key
        {{ dbt_utils.generate_surrogate_key(['customer_id']) }} AS customer_key,
        customer_id,
        customer_name_masked,
        region_name,
        country,
        gsp_group,
        meter_type,
        profile_type,
        num_meters,
        first_seen_date,
        last_seen_date,
        total_readings,
        -- Customer segment for reporting
        CASE
            WHEN profile_type = 'industrial' THEN 'Industrial'
            WHEN profile_type = 'small_business' THEN 'Small Business'
            ELSE 'Domestic'
        END AS customer_segment,
        CURRENT_TIMESTAMP() AS dbt_updated_at
    FROM customer_aggregated
)

SELECT * FROM final
