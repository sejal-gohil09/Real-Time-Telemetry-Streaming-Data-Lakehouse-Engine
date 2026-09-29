{{
    config(
        materialized='table',
        schema='marts',
        tags=['marts', 'daily'],
        description='Region dimension with GSP groups, countries, and population data'
    )
}}

-- ===========================================================================
-- dim_regions.sql
-- ===========================================================================
-- Mart model: Region dimension table
--
-- One row per UK region with:
--   - Country (England, Scotland, Wales)
--   - GSP (Grid Supply Point) group identifier
--   - Population estimates
--   - Region ranking by population
--
-- Grain: one row per region_name
-- Sources: STAGING.STG_SMART_METERS, SHARED.REGION_LOOKUP
-- Author: Sejal Gohil
-- ===========================================================================

WITH distinct_regions AS (
    SELECT DISTINCT
        region_name,
        country,
        gsp_group
    FROM {{ ref('stg_smart_meters') }}
),

region_lookup AS (
    SELECT
        region_name,
        country AS lookup_country,
        gsp_group AS lookup_gsp,
        dno_region_code,
        population_2024
    FROM {{ source('shared', 'region_lookup') }}
),

final AS (
    SELECT
        -- Surrogate key
        {{ dbt_utils.generate_surrogate_key(['r.region_name']) }} AS region_key,
        r.region_name AS region_name,
        COALESCE(r.country, l.lookup_country) AS country,
        COALESCE(r.gsp_group, l.lookup_gsp) AS gsp_group,
        l.dno_region_code,
        l.population_2024,
        -- Population ranking
        RANK() OVER (ORDER BY l.population_2024 DESC NULLS LAST) AS population_rank,
        -- Derived: country + region for display
        COALESCE(r.country, l.lookup_country) || ' / ' || r.region_name AS country_region_label,
        CURRENT_TIMESTAMP() AS dbt_updated_at
    FROM distinct_regions r
    LEFT JOIN region_lookup l
        ON r.region_name = l.region_name
)

SELECT * FROM final
