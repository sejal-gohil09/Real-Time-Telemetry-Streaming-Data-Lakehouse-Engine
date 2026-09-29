{% macro mask_customer_pii(column_name, alias=none) -%}
    {%- set _alias = alias if alias else column_name -%}
    {%- if var('enable_pii_masking', true) -%}
        CASE
            WHEN CURRENT_ROLE() IN ('GOVERNANCE_ROLE', 'ACCOUNTADMIN', 'ETL_ROLE', 'DBT_ROLE')
                THEN {{ column_name }}
            ELSE SHA2({{ column_name }})
        END AS {{ _alias }}
    {%- else -%}
        {{ column_name }} AS {{ _alias }}
    {%- endif %}
{%- endmacro %}

{% macro mask_partial(column_name, visible_prefix=5, visible_suffix=4, alias=none) -%}
    {%- set _alias = alias if alias else column_name -%}
    {%- if var('enable_pii_masking', true) -%}
        CASE
            WHEN CURRENT_ROLE() IN ('GOVERNANCE_ROLE', 'ACCOUNTADMIN', 'ETL_ROLE', 'DBT_ROLE')
                THEN {{ column_name }}
            ELSE
                LEFT({{ column_name }}, {{ visible_prefix }})
                || RPAD('*', GREATEST(LENGTH({{ column_name }}) - {{ visible_prefix + visible_suffix }}, 1), '*')
                || RIGHT({{ column_name }}, {{ visible_suffix }})
        END AS {{ _alias }}
    {%- else -%}
        {{ column_name }} AS {{ _alias }}
    {%- endif %}
{%- endmacro %}

{% macro log_ingestion(source_table, target_table, rows_loaded, status, error_message=none) -%}
    INSERT INTO {{ ref('governance') }}.ingestion_audit
        (pipeline_name, source_system, target_table, rows_loaded, status, error_message, run_started_at, run_completed_at, run_by_user)
    VALUES (
        '{{ var("pipeline_name", "dbt_transform") }}',
        '{{ source_table }}',
        '{{ target_table }}',
        {{ rows_loaded }},
        '{{ status }}',
        {{ "'" ~ error_message ~ "'" if error_message else 'NULL' }},
        CURRENT_TIMESTAMP() - INTERVAL '1 HOUR',
        CURRENT_TIMESTAMP(),
        CURRENT_USER()
    )
{%- endmacro %}
