-- ═══════════════════════════════════════════════════════════════════════════════
-- TelemetryHub — Self-Contained Database Initialization Script
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- This script creates the complete TelemetryHub energy settlement database with
-- real UK carbon intensity data (from the National Grid ESO API, Jan 1-7, 2025)
-- and simulated smart meter readings for 200 UK households.
--
-- COMPATIBILITY:
--   - PostgreSQL 12+ (including Supabase, Neon, Railway, local Postgres)
--   - Does NOT require any extensions beyond standard PL/pgSQL
--
-- USAGE:
--   psql -U postgres -d telemetryhub -f database/init.sql
--   -- or pipe it: cat database/init.sql | psql -U postgres -d telemetryhub
--
-- WHAT IT CREATES:
--   - 5 tables: regions, customers, carbon_intensity, smart_meter_readings, settlements
--   - 14 UK GSP regions (England, Scotland, Wales)
--   - 200 simulated smart meter customers
--   - 337 real half-hourly carbon intensity records (Jan 1-7, 2025)
--   - 67,200 half-hourly smart meter readings (200 customers × 48 periods × 7 days)
--   - 67,200 settlement records with calculated cost and carbon emissions
--
-- DATA SOURCES:
--   - Carbon intensity: Real data from api.carbonintensity.org.uk (National Grid ESO)
--   - Smart meter readings: Simulated using real UK household consumption patterns
--   - Tariff rates: UK standard tariffs (Peak 35.94p, Off-Peak 13.92p, Standard 27.35p)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Clean slate (safe to re-run) ──────────────────────────────────────────────
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS smart_meter_readings CASCADE;
DROP TABLE IF EXISTS carbon_intensity CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS regions CASCADE;

-- ═══ 1. REGIONS ═══════════════════════════════════════════════════════════════
CREATE TABLE regions (
    id          serial PRIMARY KEY,
    region_id   int    UNIQUE NOT NULL,
    shortname   text   NOT NULL,
    nation      text   NOT NULL CHECK (nation IN ('England', 'Scotland', 'Wales')),
    created_at  timestamptz DEFAULT now()
);

INSERT INTO regions (region_id, shortname, nation) VALUES
    (1,  'North Scotland',         'Scotland'),
    (2,  'South Scotland',         'Scotland'),
    (3,  'North West England',      'England'),
    (4,  'North East England',      'England'),
    (5,  'Yorkshire',              'England'),
    (6,  'North Wales & Merseyside','Wales'),
    (7,  'South Wales',            'Wales'),
    (8,  'West Midlands',           'England'),
    (9,  'East Midlands',           'England'),
    (10, 'East England',            'England'),
    (11, 'South West England',      'England'),
    (12, 'South England',           'England'),
    (13, 'London',                  'England'),
    (14, 'South East England',      'England');

-- ═══ 2. CUSTOMERS ═════════════════════════════════════════════════════════════
CREATE TABLE customers (
    id           serial PRIMARY KEY,
    customer_id  text    UNIQUE NOT NULL,
    customer_name text   NOT NULL,
    mpan         text    NOT NULL,
    region_id    int     REFERENCES regions(region_id),
    nation       text    NOT NULL CHECK (nation IN ('England', 'Scotland', 'Wales')),
    tariff_type  text    NOT NULL DEFAULT 'STANDARD',
    created_at   timestamptz DEFAULT now()
);

-- 200 customers: 140 England, 30 Scotland, 30 Wales
DO $$
DECLARE
    i int;
    v_name text;
    v_mpan text;
    v_region_id int;
    v_nation text;
    v_tariff text;
    v_first text[] := ARRAY[
        'James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda',
        'William','Elizabeth','David','Barbara','Richard','Susan','Joseph','Jessica',
        'Thomas','Sarah','Charles','Karen','Christopher','Nancy','Daniel','Lisa',
        'Matthew','Betty','Anthony','Helen','Mark','Sandra','Donald','Donna',
        'Steven','Carol','Paul','Ruth','Andrew','Sharon','Joshua','Michelle',
        'Kenneth','Laura','Kevin','Sarah','Brian','Deborah','George','Dorothy',
        'Edward','Amy','Ronald','Angela','Timothy','Ashley','Jason','Brenda',
        'Jeffrey','Emma','Ryan','Julie','Jacob','Victoria','Gary','Olivia',
        'Nicholas','Christine','Eric','Catherine','Jonathan','Frances','Stephen','Samantha',
        'Larry','Debra','Justin','Rachel','Scott','Carolyn','Brandon','Martha',
        'Benjamin','Heather','Samuel','Anna','Gregory','Virginia','Frank','Amanda',
        'Alexander','Rebecca','Raymond','Shirley','Patrick','Cynthia','Jack','Joyce',
        'Dennis','Maria','Jerry','Janet'
    ];
    v_last text[] := ARRAY[
        'Smith','Jones','Williams','Taylor','Brown','Davies','Evans','Wilson',
        'Thomas','Roberts','Johnson','Lewis','Walker','Robinson','Wood','Thompson',
        'White','Watson','Jackson','Wright','Green','Harris','Cooper','Lee',
        'Martin','Clarke','James','Hughes','Morgan','Ward','Hall','Turner',
        'Hill','Scott','Adams','Baker','Hunt','Young','Collins','Carter',
        'Phillips','Morris','Stewart','Rogers','Reed','Cook','Bell','Bailey',
        'Rivera','Cooper','Richardson','Cox','Howard','Ward','Torres','Peterson',
        'Gray','Ramirez','James','Watson','Brooks','Kelly','Sanders','Price',
        'Bennett','Wood','Barnes','Ross','Henderson','Coleman','Jenkins','Perry',
        'Powell','Long','Patterson','Hughes','Flores','Washington','Butler','Simmons',
        'Foster','Gonzales','Bryant','Alexander','Russell','Griffin','Diaz','Hayes',
        'Myers','Ford','Hamilton','Graham','Sullivan','Wallace','Woods','Cole',
        'West','Jordan','Owens','Reynolds','Fisher','Ellis','Harrison','Gibson'
    ];
    v_eng_regions int[] := ARRAY[3,4,5,8,9,10,11,12,13,14];
    v_sct_regions int[] := ARRAY[1,2];
    v_wal_regions int[] := ARRAY[6,7];
BEGIN
    FOR i IN 1..200 LOOP
        v_name := v_first[1 + (i % array_length(v_first,1))] || ' ' || v_last[1 + ((i * 7) % array_length(v_last,1))];
        v_mpan := lpad((i * 837411 % 10000000000000)::text, 13, '0');

        IF i <= 140 THEN
            v_region_id := v_eng_regions[1 + ((i * 3) % array_length(v_eng_regions,1))];
            v_nation := 'England';
        ELSIF i <= 170 THEN
            v_region_id := v_sct_regions[1 + ((i * 5) % array_length(v_sct_regions,1))];
            v_nation := 'Scotland';
        ELSE
            v_region_id := v_wal_regions[1 + ((i * 11) % array_length(v_wal_regions,1))];
            v_nation := 'Wales';
        END IF;

        v_tariff := CASE WHEN (i * 13) % 10 < 3 THEN 'DYNAMIC' ELSE 'STANDARD' END;

        INSERT INTO customers (customer_id, customer_name, mpan, region_id, nation, tariff_type)
        VALUES ('CUST-' || lpad(i::text, 4, '0'), v_name, v_mpan, v_region_id, v_nation, v_tariff);
    END LOOP;
END $$;

-- ═══ 3. CARBON INTENSITY (Real National Grid ESO Data) ════════════════════════
CREATE TABLE carbon_intensity (
    id            serial PRIMARY KEY,
    period_start  timestamptz NOT NULL,
    period_end    timestamptz,
    forecast      int,
    actual        int,
    index         text,
    created_at    timestamptz DEFAULT now()
);

-- Real data from api.carbonintensity.org.uk for Jan 1-7, 2025
-- 337 half-hourly records with actual and forecast gCO2/kWh values
INSERT INTO carbon_intensity (period_start, forecast, actual, index) VALUES
('2024-12-31T23:30+00:00',53,51,'low'),('2025-01-01T00:00+00:00',49,55,'low'),('2025-01-01T00:30+00:00',52,54,'low'),('2025-01-01T01:00+00:00',56,53,'low'),('2025-01-01T01:30+00:00',53,53,'low'),('2025-01-01T02:00+00:00',53,47,'low'),('2025-01-01T02:30+00:00',52,45,'low'),('2025-01-01T03:00+00:00',48,44,'low'),('2025-01-01T03:30+00:00',44,44,'low'),('2025-01-01T04:00+00:00',44,45,'low'),('2025-01-01T04:30+00:00',42,45,'low'),('2025-01-01T05:00+00:00',43,43,'low'),('2025-01-01T05:30+00:00',47,41,'low'),('2025-01-01T06:00+00:00',43,41,'low'),('2025-01-01T06:30+00:00',43,42,'low'),('2025-01-01T07:00+00:00',44,44,'low'),('2025-01-01T07:30+00:00',42,44,'low'),('2025-01-01T08:00+00:00',42,43,'low'),('2025-01-01T08:30+00:00',41,38,'low'),('2025-01-01T09:00+00:00',38,36,'low'),('2025-01-01T09:30+00:00',35,36,'low'),('2025-01-01T10:00+00:00',23,39,'low'),('2025-01-01T10:30+00:00',32,35,'low'),('2025-01-01T11:00+00:00',38,35,'low'),('2025-01-01T11:30+00:00',35,39,'low'),('2025-01-01T12:00+00:00',32,41,'low'),('2025-01-01T12:30+00:00',36,41,'low'),('2025-01-01T13:00+00:00',41,45,'low'),('2025-01-01T13:30+00:00',42,44,'low'),('2025-01-01T14:00+00:00',46,53,'low'),('2025-01-01T14:30+00:00',47,70,'low'),('2025-01-01T15:00+00:00',54,78,'low'),('2025-01-01T15:30+00:00',70,81,'low'),('2025-01-01T16:00+00:00',81,89,'low'),('2025-01-01T16:30+00:00',90,93,'low'),('2025-01-01T17:00+00:00',94,93,'low'),('2025-01-01T17:30+00:00',98,95,'low'),('2025-01-01T18:00+00:00',95,94,'low'),('2025-01-01T18:30+00:00',90,93,'low'),('2025-01-01T19:00+00:00',93,92,'low'),('2025-01-01T19:30+00:00',92,93,'low'),('2025-01-01T20:00+00:00',92,92,'low'),('2025-01-01T20:30+00:00',83,87,'low'),('2025-01-01T21:00+00:00',94,83,'low'),('2025-01-01T21:30+00:00',81,77,'low'),('2025-01-01T22:00+00:00',82,76,'low'),('2025-01-01T22:30+00:00',94,65,'low'),('2025-01-01T23:00+00:00',83,63,'low'),('2025-01-01T23:30+00:00',77,67,'low'),
('2025-01-02T00:00+00:00',71,71,'low'),('2025-01-02T00:30+00:00',62,68,'low'),('2025-01-02T01:00+00:00',71,61,'low'),('2025-01-02T01:30+00:00',69,56,'low'),('2025-01-02T02:00+00:00',63,60,'low'),('2025-01-02T02:30+00:00',57,59,'low'),('2025-01-02T03:00+00:00',60,57,'low'),('2025-01-02T03:30+00:00',61,63,'low'),('2025-01-02T04:00+00:00',57,63,'low'),('2025-01-02T04:30+00:00',65,67,'low'),('2025-01-02T05:00+00:00',66,68,'low'),('2025-01-02T05:30+00:00',73,88,'low'),('2025-01-02T06:00+00:00',60,109,'moderate'),('2025-01-02T06:30+00:00',100,134,'moderate'),('2025-01-02T07:00+00:00',123,140,'moderate'),('2025-01-02T07:30+00:00',135,139,'moderate'),('2025-01-02T08:00+00:00',145,148,'moderate'),('2025-01-02T08:30+00:00',147,147,'moderate'),('2025-01-02T09:00+00:00',136,140,'moderate'),('2025-01-02T09:30+00:00',155,139,'moderate'),('2025-01-02T10:00+00:00',142,135,'moderate'),('2025-01-02T10:30+00:00',140,132,'moderate'),('2025-01-02T11:00+00:00',137,128,'moderate'),('2025-01-02T11:30+00:00',133,120,'moderate'),('2025-01-02T12:00+00:00',133,123,'moderate'),('2025-01-02T12:30+00:00',127,130,'moderate'),('2025-01-02T13:00+00:00',129,131,'moderate'),('2025-01-02T13:30+00:00',140,139,'moderate'),('2025-01-02T14:00+00:00',136,141,'moderate'),('2025-01-02T14:30+00:00',143,147,'moderate'),('2025-01-02T15:00+00:00',152,152,'moderate'),('2025-01-02T15:30+00:00',159,155,'moderate'),('2025-01-02T16:00+00:00',167,160,'moderate'),('2025-01-02T16:30+00:00',166,160,'moderate'),('2025-01-02T17:00+00:00',166,154,'moderate'),('2025-01-02T17:30+00:00',164,152,'moderate'),('2025-01-02T18:00+00:00',160,151,'moderate'),('2025-01-02T18:30+00:00',158,150,'moderate'),('2025-01-02T19:00+00:00',159,145,'moderate'),('2025-01-02T19:30+00:00',155,136,'moderate'),('2025-01-02T20:00+00:00',146,129,'moderate'),('2025-01-02T20:30+00:00',137,114,'moderate'),('2025-01-02T21:00+00:00',131,105,'moderate'),('2025-01-02T21:30+00:00',105,92,'low'),('2025-01-02T22:00+00:00',98,82,'low'),('2025-01-02T22:30+00:00',87,70,'low'),('2025-01-02T23:00+00:00',80,61,'low'),('2025-01-02T23:30+00:00',67,59,'low'),
('2025-01-03T00:00+00:00',63,63,'low'),('2025-01-03T00:30+00:00',59,55,'low'),('2025-01-03T01:00+00:00',62,50,'low'),('2025-01-03T01:30+00:00',56,47,'low'),('2025-01-03T02:00+00:00',48,45,'low'),('2025-01-03T02:30+00:00',45,42,'low'),('2025-01-03T03:00+00:00',44,42,'low'),('2025-01-03T03:30+00:00',41,45,'low'),('2025-01-03T04:00+00:00',40,47,'low'),('2025-01-03T04:30+00:00',44,54,'low'),('2025-01-03T05:00+00:00',47,62,'low'),('2025-01-03T05:30+00:00',54,84,'low'),('2025-01-03T06:00+00:00',66,104,'moderate'),('2025-01-03T06:30+00:00',96,119,'moderate'),('2025-01-03T07:00+00:00',125,128,'moderate'),('2025-01-03T07:30+00:00',130,136,'moderate'),('2025-01-03T08:00+00:00',136,140,'moderate'),('2025-01-03T08:30+00:00',143,134,'moderate'),('2025-01-03T09:00+00:00',147,127,'moderate'),('2025-01-03T09:30+00:00',139,125,'moderate'),('2025-01-03T10:00+00:00',132,121,'moderate'),('2025-01-03T10:30+00:00',129,119,'moderate'),('2025-01-03T11:00+00:00',128,120,'moderate'),('2025-01-03T11:30+00:00',125,120,'moderate'),('2025-01-03T12:00+00:00',125,124,'moderate'),('2025-01-03T12:30+00:00',128,127,'moderate'),('2025-01-03T13:00+00:00',134,136,'moderate'),('2025-01-03T13:30+00:00',136,145,'moderate'),('2025-01-03T14:00+00:00',145,157,'moderate'),('2025-01-03T14:30+00:00',159,169,'moderate'),('2025-01-03T15:00+00:00',169,184,'high'),('2025-01-03T15:30+00:00',184,194,'high'),('2025-01-03T16:00+00:00',194,195,'high'),('2025-01-03T16:30+00:00',209,203,'high'),('2025-01-03T17:00+00:00',213,206,'high'),('2025-01-03T17:30+00:00',217,209,'high'),('2025-01-03T18:00+00:00',220,209,'high'),('2025-01-03T18:30+00:00',223,210,'high'),('2025-01-03T19:00+00:00',223,210,'high'),('2025-01-03T19:30+00:00',224,215,'high'),('2025-01-03T20:00+00:00',227,218,'high'),('2025-01-03T20:30+00:00',230,221,'high'),('2025-01-03T21:00+00:00',233,217,'high'),('2025-01-03T21:30+00:00',234,208,'high'),('2025-01-03T22:00+00:00',220,202,'high'),('2025-01-03T22:30+00:00',212,189,'high'),('2025-01-03T23:00+00:00',205,184,'high'),('2025-01-03T23:30+00:00',197,184,'high'),
('2025-01-04T00:00+00:00',188,186,'high'),('2025-01-04T00:30+00:00',191,188,'high'),('2025-01-04T01:00+00:00',192,185,'high'),('2025-01-04T01:30+00:00',194,183,'high'),('2025-01-04T02:00+00:00',190,174,'moderate'),('2025-01-04T02:30+00:00',192,172,'moderate'),('2025-01-04T03:00+00:00',181,170,'moderate'),('2025-01-04T03:30+00:00',176,172,'moderate'),('2025-01-04T04:00+00:00',173,172,'moderate'),('2025-01-04T04:30+00:00',174,182,'high'),('2025-01-04T05:00+00:00',176,184,'high'),('2025-01-04T05:30+00:00',188,188,'high'),('2025-01-04T06:00+00:00',195,190,'high'),('2025-01-04T06:30+00:00',196,199,'high'),('2025-01-04T07:00+00:00',197,206,'high'),('2025-01-04T07:30+00:00',207,213,'high'),('2025-01-04T08:00+00:00',212,221,'high'),('2025-01-04T08:30+00:00',221,217,'high'),('2025-01-04T09:00+00:00',226,217,'high'),('2025-01-04T09:30+00:00',220,215,'high'),('2025-01-04T10:00+00:00',224,218,'high'),('2025-01-04T10:30+00:00',221,219,'high'),('2025-01-04T11:00+00:00',222,217,'high'),('2025-01-04T11:30+00:00',222,209,'high'),('2025-01-04T12:00+00:00',222,210,'high'),('2025-01-04T12:30+00:00',216,213,'high'),('2025-01-04T13:00+00:00',217,215,'high'),('2025-01-04T13:30+00:00',222,213,'high'),('2025-01-04T14:00+00:00',223,214,'high'),('2025-01-04T14:30+00:00',221,218,'high'),('2025-01-04T15:00+00:00',218,219,'high'),('2025-01-04T15:30+00:00',222,219,'high'),('2025-01-04T16:00+00:00',223,221,'high'),('2025-01-04T16:30+00:00',226,219,'high'),('2025-01-04T17:00+00:00',221,218,'high'),('2025-01-04T17:30+00:00',224,215,'high'),('2025-01-04T18:00+00:00',225,212,'high'),('2025-01-04T18:30+00:00',220,208,'high'),('2025-01-04T19:00+00:00',217,205,'high'),('2025-01-04T19:30+00:00',211,196,'high'),('2025-01-04T20:00+00:00',195,188,'high'),('2025-01-04T20:30+00:00',199,176,'moderate'),('2025-01-04T21:00+00:00',189,165,'moderate'),('2025-01-04T21:30+00:00',177,144,'moderate'),('2025-01-04T22:00+00:00',165,127,'moderate'),('2025-01-04T22:30+00:00',148,114,'moderate'),('2025-01-04T23:00+00:00',124,101,'moderate'),('2025-01-04T23:30+00:00',103,92,'low'),
('2025-01-05T00:00+00:00',100,84,'low'),('2025-01-05T00:30+00:00',89,77,'low'),('2025-01-05T01:00+00:00',75,70,'low'),('2025-01-05T01:30+00:00',70,63,'low'),('2025-01-05T02:00+00:00',63,59,'low'),('2025-01-05T02:30+00:00',60,56,'low'),('2025-01-05T03:00+00:00',58,52,'low'),('2025-01-05T03:30+00:00',54,49,'low'),('2025-01-05T04:00+00:00',51,49,'low'),('2025-01-05T04:30+00:00',47,49,'low'),('2025-01-05T05:00+00:00',48,49,'low'),('2025-01-05T05:30+00:00',50,49,'low'),('2025-01-05T06:00+00:00',48,51,'low'),('2025-01-05T06:30+00:00',52,53,'low'),('2025-01-05T07:00+00:00',52,59,'low'),('2025-01-05T07:30+00:00',53,73,'low'),('2025-01-05T08:00+00:00',70,87,'low'),('2025-01-05T08:30+00:00',81,99,'low'),('2025-01-05T09:00+00:00',90,106,'moderate'),('2025-01-05T09:30+00:00',101,115,'moderate'),('2025-01-05T10:00+00:00',86,124,'moderate'),('2025-01-05T10:30+00:00',122,129,'moderate'),('2025-01-05T11:00+00:00',129,137,'moderate'),('2025-01-05T11:30+00:00',133,141,'moderate'),('2025-01-05T12:00+00:00',139,144,'moderate'),('2025-01-05T12:30+00:00',143,148,'moderate'),('2025-01-05T13:00+00:00',148,151,'moderate'),('2025-01-05T13:30+00:00',152,151,'moderate'),('2025-01-05T14:00+00:00',154,156,'moderate'),('2025-01-05T14:30+00:00',155,160,'moderate'),('2025-01-05T15:00+00:00',163,160,'moderate'),('2025-01-05T15:30+00:00',166,165,'moderate'),('2025-01-05T16:00+00:00',168,169,'moderate'),('2025-01-05T16:30+00:00',171,168,'moderate'),('2025-01-05T17:00+00:00',174,167,'moderate'),('2025-01-05T17:30+00:00',174,166,'moderate'),('2025-01-05T18:00+00:00',172,165,'moderate'),('2025-01-05T18:30+00:00',168,155,'moderate'),('2025-01-05T19:00+00:00',168,145,'moderate'),('2025-01-05T19:30+00:00',159,133,'moderate'),('2025-01-05T20:00+00:00',144,116,'moderate'),('2025-01-05T20:30+00:00',126,93,'low'),('2025-01-05T21:00+00:00',103,71,'low'),('2025-01-05T21:30+00:00',86,55,'low'),('2025-01-05T22:00+00:00',59,46,'low'),('2025-01-05T22:30+00:00',45,42,'low'),('2025-01-05T23:00+00:00',41,43,'low'),('2025-01-05T23:30+00:00',37,50,'low'),
('2025-01-06T00:00+00:00',39,53,'low'),('2025-01-06T00:30+00:00',44,55,'low'),('2025-01-06T01:00+00:00',49,47,'low'),('2025-01-06T01:30+00:00',55,48,'low'),('2025-01-06T02:00+00:00',46,42,'low'),('2025-01-06T02:30+00:00',43,43,'low'),('2025-01-06T03:00+00:00',38,43,'low'),('2025-01-06T03:30+00:00',39,47,'low'),('2025-01-06T04:00+00:00',41,49,'low'),('2025-01-06T04:30+00:00',40,46,'low'),('2025-01-06T05:00+00:00',44,50,'low'),('2025-01-06T05:30+00:00',51,48,'low'),('2025-01-06T06:00+00:00',52,64,'low'),('2025-01-06T06:30+00:00',55,80,'low'),('2025-01-06T07:00+00:00',69,93,'low'),('2025-01-06T07:30+00:00',89,111,'moderate'),('2025-01-06T08:00+00:00',107,120,'moderate'),('2025-01-06T08:30+00:00',113,121,'moderate'),('2025-01-06T09:00+00:00',125,119,'moderate'),('2025-01-06T09:30+00:00',119,115,'moderate'),('2025-01-06T10:00+00:00',118,114,'moderate'),('2025-01-06T10:30+00:00',113,115,'moderate'),('2025-01-06T11:00+00:00',112,115,'moderate'),('2025-01-06T11:30+00:00',115,116,'moderate'),('2025-01-06T12:00+00:00',114,115,'moderate'),('2025-01-06T12:30+00:00',115,116,'moderate'),('2025-01-06T13:00+00:00',113,113,'moderate'),('2025-01-06T13:30+00:00',114,112,'moderate'),('2025-01-06T14:00+00:00',115,116,'moderate'),('2025-01-06T14:30+00:00',115,119,'moderate'),('2025-01-06T15:00+00:00',121,127,'moderate'),('2025-01-06T15:30+00:00',128,134,'moderate'),('2025-01-06T16:00+00:00',131,135,'moderate'),('2025-01-06T16:30+00:00',141,138,'moderate'),('2025-01-06T17:00+00:00',142,140,'moderate'),('2025-01-06T17:30+00:00',138,138,'moderate'),('2025-01-06T18:00+00:00',137,138,'moderate'),('2025-01-06T18:30+00:00',136,137,'moderate'),('2025-01-06T19:00+00:00',138,131,'moderate'),('2025-01-06T19:30+00:00',131,123,'moderate'),('2025-01-06T20:00+00:00',115,113,'moderate'),('2025-01-06T20:30+00:00',109,100,'moderate'),('2025-01-06T21:00+00:00',102,89,'low'),('2025-01-06T21:30+00:00',87,78,'low'),('2025-01-06T22:00+00:00',78,72,'low'),('2025-01-06T22:30+00:00',71,67,'low'),('2025-01-06T23:00+00:00',70,63,'low'),('2025-01-06T23:30+00:00',66,64,'low'),
('2025-01-07T00:00+00:00',60,69,'low'),('2025-01-07T00:30+00:00',61,68,'low'),('2025-01-07T01:00+00:00',67,65,'low'),('2025-01-07T01:30+00:00',62,66,'low'),('2025-01-07T02:00+00:00',66,63,'low'),('2025-01-07T02:30+00:00',67,64,'low'),('2025-01-07T03:00+00:00',62,67,'low'),('2025-01-07T03:30+00:00',61,69,'low'),('2025-01-07T04:00+00:00',66,65,'low'),('2025-01-07T04:30+00:00',74,72,'low'),('2025-01-07T05:00+00:00',66,77,'low'),('2025-01-07T05:30+00:00',77,94,'low'),('2025-01-07T06:00+00:00',89,113,'moderate'),('2025-01-07T06:30+00:00',120,128,'moderate'),('2025-01-07T07:00+00:00',129,141,'moderate'),('2025-01-07T07:30+00:00',136,150,'moderate'),('2025-01-07T08:00+00:00',146,155,'moderate'),('2025-01-07T08:30+00:00',154,155,'moderate'),('2025-01-07T09:00+00:00',150,151,'moderate'),('2025-01-07T09:30+00:00',151,147,'moderate'),('2025-01-07T10:00+00:00',148,144,'moderate'),('2025-01-07T10:30+00:00',146,138,'moderate'),('2025-01-07T11:00+00:00',142,133,'moderate'),('2025-01-07T11:30+00:00',136,125,'moderate'),('2025-01-07T12:00+00:00',125,122,'moderate'),('2025-01-07T12:30+00:00',125,124,'moderate'),('2025-01-07T13:00+00:00',126,125,'moderate'),('2025-01-07T13:30+00:00',135,129,'moderate'),('2025-01-07T14:00+00:00',130,134,'moderate'),('2025-01-07T14:30+00:00',136,141,'moderate'),('2025-01-07T15:00+00:00',140,149,'moderate'),('2025-01-07T15:30+00:00',153,154,'moderate'),('2025-01-07T16:00+00:00',156,155,'moderate'),('2025-01-07T16:30+00:00',155,153,'moderate'),('2025-01-07T17:00+00:00',157,154,'moderate'),('2025-01-07T17:30+00:00',149,150,'moderate'),('2025-01-07T18:00+00:00',151,149,'moderate'),('2025-01-07T18:30+00:00',147,147,'moderate'),('2025-01-07T19:00+00:00',146,142,'moderate'),('2025-01-07T19:30+00:00',145,136,'moderate'),('2025-01-07T20:00+00:00',135,125,'moderate'),('2025-01-07T20:30+00:00',131,115,'moderate'),('2025-01-07T21:00+00:00',109,103,'moderate'),('2025-01-07T21:30+00:00',102,89,'low'),('2025-01-07T22:00+00:00',91,84,'low'),('2025-01-07T22:30+00:00',72,84,'low'),('2025-01-07T23:00+00:00',69,82,'low'),('2025-01-07T23:30+00:00',84,82,'low');

-- ═══ 4. SMART METER READINGS + 5. SETTLEMENTS ═════════════════════════════════
CREATE TABLE smart_meter_readings (
    id              serial PRIMARY KEY,
    customer_id      text NOT NULL,
    reading_time     timestamptz NOT NULL,
    kwh              numeric(10,4) NOT NULL,
    is_peak_period   boolean DEFAULT false,
    day_of_week      int,
    hour_of_day      int,
    season           text DEFAULT 'winter',
    created_at       timestamptz DEFAULT now()
);

CREATE TABLE settlements (
    id                      serial PRIMARY KEY,
    customer_id             text NOT NULL,
    reading_time            timestamptz NOT NULL,
    kwh                     numeric(10,4) NOT NULL,
    carbon_intensity_gco2   int,
    kg_co2                  numeric(10,6),
    tariff_band             text,
    cost_gbp                numeric(10,4),
    created_at               timestamptz DEFAULT now()
);

-- Generate 67,200 readings + 67,200 settlements using the same algorithm as the app
-- Based on real UK household consumption patterns:
--   Night (00:00-06:00): 0.10-0.18 kWh per half-hour
--   Morning peak (07:00-09:00): 0.52-0.75 kWh per half-hour
--   Daytime (09:00-16:00): 0.22-0.42 kWh per half-hour
--   Evening peak (17:00-20:00): 0.60-0.85 kWh per half-hour
--   Night decline (20:00-24:00): 0.15-0.38 kWh per half-hour
-- Tariff bands: PEAK 35.94p/kWh, OFF_PEAK 13.92p/kWh, STANDARD 27.35p/kWh
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
        -- Use deterministic seed based on customer id for reproducibility
        v_base_factor := 0.6 + (abs(hashtext(cust.customer_id)) % 1200) / 1000.0;
        v_weekend_factor := 0.9 + (abs(hashtext(cust.customer_id || 'w')) % 400) / 1000.0;

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
                v_kwh := v_kwh * (0.85 + (abs(hashtext(cust.customer_id || v_day::text || v_period::text)) % 300) / 1000.0);
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

-- ═══ INDEXES ═══════════════════════════════════════════════════════════════════
CREATE INDEX idx_readings_customer_time ON smart_meter_readings(customer_id, reading_time);
CREATE INDEX idx_readings_time ON smart_meter_readings(reading_time);
CREATE INDEX idx_carbon_period ON carbon_intensity(period_start);
CREATE INDEX idx_settlements_customer ON settlements(customer_id);
CREATE INDEX idx_settlements_time ON settlements(reading_time);
CREATE INDEX idx_customers_nation ON customers(nation);

-- ═══ VERIFY ═══════════════════════════════════════════════════════════════════
SELECT 'regions' as table_name, COUNT(*) as row_count FROM regions
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'carbon_intensity', COUNT(*) FROM carbon_intensity
UNION ALL SELECT 'smart_meter_readings', COUNT(*) FROM smart_meter_readings
UNION ALL SELECT 'settlements', COUNT(*) FROM settlements
ORDER BY table_name;
