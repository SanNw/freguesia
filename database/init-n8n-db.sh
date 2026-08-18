#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=n8n_user="$N8N_DB_USER" --set=n8n_password="$N8N_DB_PASSWORD" <<-'EOSQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'n8n_user', :'n8n_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'n8n_user') \gexec
SELECT format('ALTER ROLE %I WITH PASSWORD %L', :'n8n_user', :'n8n_password') \gexec
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=n8n_db="$N8N_DB_NAME" --set=n8n_user="$N8N_DB_USER" <<-'EOSQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'n8n_db', :'n8n_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'n8n_db') \gexec
EOSQL
