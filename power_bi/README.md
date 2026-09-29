# Power BI Dashboard — UK Energy Settlement Lakehouse

## Dashboard Overview

The `UK_Energy_Settlement_Dashboard.pbix` file is a Power BI Desktop report
that connects to the Snowflake `MARTS` schema and provides interactive
visualizations for UK energy settlement data.

## Semantic Model Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    DIM_REGIONS                           │
│  region_key (PK) │ region_name │ country │ gsp_group    │
│  population_2024 │ population_rank                        │
└──────────┬──────────────────────────────────────────────┘
           │ region_name = region_name
           │
┌──────────┴──────────────────────────────────────────────┐
│                 DIM_CUSTOMERS                            │
│  customer_key (PK) │ customer_id │ customer_name_masked  │
│  region_name │ country │ gsp_group │ customer_segment    │
│  num_meters │ first_seen_date │ last_seen_date           │
└──────────┬──────────────────────────────────────────────┘
           │ customer_id = customer_id
           │
┌──────────┴──────────────────────────────────────────────┐
│           FCT_HALF_HOURLY_SETTLEMENT                     │
│  settlement_key (PK)                                     │
│  mpan │ customer_id │ region_name │ country             │
│  settlement_date │ settlement_period                     │
│  kwh_consumed │ carbon_intensity_gco2_kwh                │
│  carbon_emissions_kg │ estimated_cost_gbp                │
│  tariff_band │ is_peak_period │ season │ day_type        │
└─────────────────────────────────────────────────────────┘
```

## Report Pages

### Page 1: Executive Overview
- KPI cards: Total kWh, Total Carbon (kgCO2), Total Cost (GBP), Avg Carbon Intensity
- Line chart: Daily consumption trend (last 30 days)
- Bar chart: Consumption by country (England vs Scotland vs Wales)
- Gauge: Settlement completeness (%)

### Page 2: Regional Analysis
- Map visual: UK regions colored by total consumption
- Matrix: Region × Season consumption heatmap
- Slicer: Country filter (England / Scotland / Wales)
- Bar chart: Top 10 regions by carbon emissions

### Page 3: Carbon Intensity Tracker
- Line chart: Carbon intensity throughout the day (48 periods)
- Stacked bar: Generation mix by settlement period
- KPI: Current carbon category (VERY_LOW to VERY_HIGH)
- Scatter: kWh vs carbon intensity correlation

### Page 4: Customer Segments
- Donut chart: Customer segments (Domestic / Small Business / Industrial)
- Bar chart: Average consumption by segment
- Table: Top 20 customers by total cost
- Slicer: Profile type filter

### Page 5: Settlement Detail
- Matrix: Settlement period × Date with kWh values
- Drill-through: Click a cell to see individual meter readings
- Slicer: Date range, region, tariff band
- Card: Selected period summary

## Connection Configuration

| Parameter | Value |
|-----------|-------|
| Connector | Snowflake |
| Server | `<account>.snowflakecomputing.com` |
| Warehouse | REPORTING_WH |
| Database | UK_ENERGY_LAKEHOUSE |
| Schema | MARTS |
| Role | ANALYST_ROLE |

## Refresh Schedule

| Refresh | Frequency | Time (UTC) |
|---------|-----------|------------|
| Incremental | Every 30 minutes | 00:00, 00:30, 01:00, ... |
| Full | Daily | 02:00 UTC |

## Row-Level Security in Power BI

Power BI connects as `power_bi_user` with `ANALYST_ROLE`. Snowflake's RLS
policies automatically filter data by country. For per-analyst filtering in
Power BI service:

1. Define RLS roles in Power BI Desktop (Modeling > Manage Roles)
2. Create roles: `EnglandView`, `ScotlandView`, `WalesView`
3. Apply DAX filter: `country = "England"` (adjust per role)
4. Assign users to roles in Power BI Service

Note: Snowflake RLS is the primary enforcement mechanism. Power BI RLS
provides an additional UI-level filter for dashboard personalization.
