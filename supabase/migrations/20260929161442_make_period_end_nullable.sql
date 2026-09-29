/*
# Make carbon_intensity.period_end nullable

The period_end column was NOT NULL but we're inserting NULL for it since
the API data only provides period_start. Making it nullable allows the import.
*/
ALTER TABLE carbon_intensity ALTER COLUMN period_end DROP NOT NULL;