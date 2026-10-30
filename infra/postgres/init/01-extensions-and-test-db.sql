-- Extensions used by MEDVERSE (trigram search) and a separate database for automated tests.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE DATABASE medverse_test OWNER medverse;
\connect medverse_test
CREATE EXTENSION IF NOT EXISTS pg_trgm;
