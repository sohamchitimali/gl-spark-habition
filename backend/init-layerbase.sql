-- ==============================================================================
-- Layerbase Serverless PostgreSQL Setup Script
-- ==============================================================================
-- If your Layerbase cluster provides a single database, run these commands
-- in the Layerbase SQL query editor to provision isolated schemas for each microservice:

CREATE SCHEMA IF NOT EXISTS habition_users;
CREATE SCHEMA IF NOT EXISTS habition_groups;
CREATE SCHEMA IF NOT EXISTS habition_habits;
CREATE SCHEMA IF NOT EXISTS habition_notifications;

-- (Optional) If Layerbase allows creating multiple distinct databases on your cluster,
-- you can alternatively create separate databases:
-- CREATE DATABASE habition_users;
-- CREATE DATABASE habition_groups;
-- CREATE DATABASE habition_habits;
-- CREATE DATABASE habition_notifications;
