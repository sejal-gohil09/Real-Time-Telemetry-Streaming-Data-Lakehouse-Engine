/*
# Generate smart meter readings and settlements

This migration uses a PL/pgSQL function to generate 67,200 half-hourly smart meter readings
for 200 customers over 7 days (Jan 1-7, 2025), then creates settlement records by joining
with the real carbon intensity data.

The consumption pattern is based on real UK household smart meter data:
- Low usage overnight (00:00-06:00): ~0.10-0.18 kWh per half-hour
- Morning peak (07:00-09:00): ~0.52-0.75 kWh per half-hour
- Daytime (09:00-16:00): ~0.22-0.42 kWh per half-hour
- Evening peak (17:00-20:00): ~0.60-0.85 kWh per half-hour
- Night decline (20:00-24:00): ~0.15-0.38 kWh per half-hour

Each customer has a random base factor (0.6-1.8) to simulate household size variation.
Weekend usage is adjusted by a random factor (0.9-1.3).

Settlements are calculated with UK tariff bands:
- PEAK (07:00-09:00, 17:00-20:00): 35.94p/kWh
- OFF_PEAK (00:00-07:00): 13.92p/kWh
- STANDARD (all other times): 27.35p/kWh

Carbon emissions: kWh x gCO2/kWh / 1000 = kgCO2
*/

DO $$
DECLARE
    cust RECORD;
    v_base_factor float;
    v_weekend_factor float;
    v_day int;
    v_period int;
    v_hour int;
    v_minute int;
    v_reading_time timestamptz;
    v_dow int;
    v_is_weekend boolean;
    v_kwh numeric(10,4);
    v_is_peak boolean;
    v_ci_actual int;
    v_kg_co2 numeric(10,6);
    v_tariff_band text;
    v_cost_gbp numeric(10,4);
    v_pattern float[] := ARRAY[
        0.18, 0.15, 0.13, 0.12, 0.11, 0.10, 0.10, 0.12,
        0.15, 0.22, 0.35, 0.52, 0.68, 0.75, 0.72, 0.55,
        0.42, 0.35, 0.30, 0.28, 0.26, 0.25, 0.24, 0.23,
        0.22, 0.21, 0.22, 0.24, 0.27, 0.32, 0.42, 0.58,
        0.75, 0.82, 0.85, 0.80, 0.72, 0.60, 0.48, 0.38,
        0.30, 0.25, 0.22, 0.20, 0.18, 0.17, 0.16, 0.15
    ];
    v_peak_periods int[] := ARRAY[14,15,16,17,34,35,36,37,38,39];
    v_ci_time timestamptz;
BEGIN
    FOR cust IN SELECT customer_id FROM customers ORDER BY id LOOP
        v_base_factor := 0.6 + random() * 1.2;
        v_weekend_factor := 0.9 + random() * 0.4;

        FOR v_day IN 0..6 LOOP
            v_dow := extract(dow FROM ('2025-01-01 00:00:00+00'::timestamptz + (v_day || ' days')::interval))::int;
            v_is_weekend := v_dow >= 5;

            FOR v_period IN 0..47 LOOP
                v_hour := v_period / 2;
                v_minute := (v_period % 2) * 30;
                v_reading_time := '2025-01-01 00:00:00+00'::timestamptz
                    + (v_day || ' days')::interval
                    + (v_hour || ' hours')::interval
                    + (v_minute || ' minutes')::interval;

                v_kwh := v_pattern[v_period + 1] * v_base_factor;
                IF v_is_weekend THEN
                    v_kwh := v_kwh * v_weekend_factor;
                END IF;
                v_kwh := v_kwh * (0.85 + random() * 0.3);
                v_kwh := round(v_kwh::numeric, 4);

                v_is_peak := (v_period = ANY(v_peak_periods));

                v_ci_time := date_trunc('hour', v_reading_time);
                IF extract(minute FROM v_reading_time) >= 30 THEN
                    v_ci_time := v_ci_time + '30 minutes'::interval;
                END IF;

                SELECT COALESCE(actual, forecast) INTO v_ci_actual
                FROM carbon_intensity
                WHERE period_start = v_ci_time
                LIMIT 1;

                IF v_ci_actual IS NULL THEN
                    v_ci_actual := 50;
                END IF;

                v_kg_co2 := round((v_kwh * v_ci_actual / 1000)::numeric, 6);

                IF v_is_peak THEN
                    v_tariff_band := 'PEAK';
                    v_cost_gbp := round((v_kwh * 0.3594)::numeric, 4);
                ELSIF v_hour < 7 THEN
                    v_tariff_band := 'OFF_PEAK';
                    v_cost_gbp := round((v_kwh * 0.1392)::numeric, 4);
                ELSE
                    v_tariff_band := 'STANDARD';
                    v_cost_gbp := round((v_kwh * 0.2735)::numeric, 4);
                END IF;

                INSERT INTO smart_meter_readings (customer_id, reading_time, kwh, is_peak_period, day_of_week, hour_of_day, season)
                VALUES (cust.customer_id, v_reading_time, v_kwh, v_is_peak, v_dow, v_hour, 'winter');

                INSERT INTO settlements (customer_id, reading_time, kwh, carbon_intensity_gco2, kg_co2, tariff_band, cost_gbp)
                VALUES (cust.customer_id, v_reading_time, v_kwh, v_ci_actual, v_kg_co2, v_tariff_band, v_cost_gbp);
            END LOOP;
        END LOOP;
    END LOOP;
END $$;