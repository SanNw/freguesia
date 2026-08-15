-- =============================================================================
-- Freguesia — Schema inicial
-- Aplicado automaticamente pelo Docker entrypoint ou via `npm run db:migrate`
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- sources: fontes de oferta cadastradas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  store TEXT NOT NULL,
  type TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  priority INTEGER NOT NULL DEFAULT 100,
  config JSONB NOT NULL DEFAULT '{}',
  terms_reviewed_at TIMESTAMPTZ,
  terms_reviewed_by TEXT,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_error_code TEXT,
  circuit_state TEXT NOT NULL DEFAULT 'closed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- products: produtos normalizados
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES sources(id),
  external_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  gtin TEXT,
  category TEXT,
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  image_url TEXT,
  availability TEXT NOT NULL DEFAULT 'unknown',
  metadata JSONB NOT NULL DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, external_id)
);

-- ---------------------------------------------------------------------------
-- price_observations: histórico de preços
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_observations (
  id BIGSERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id),
  current_price_cents BIGINT NOT NULL CHECK (current_price_cents > 0),
  previous_price_cents BIGINT,
  currency CHAR(3) NOT NULL,
  availability TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}',
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_observations_product_time
  ON price_observations(product_id, captured_at DESC);

-- ---------------------------------------------------------------------------
-- offers: ofertas candidatas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  source_observation_id BIGINT NOT NULL REFERENCES price_observations(id),
  status TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2),
  affiliate_url TEXT,
  affiliate_provider TEXT,
  image_url TEXT,
  proposed_caption TEXT,
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- approvals: registro de decisões humanas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES offers(id),
  decision TEXT NOT NULL,
  actor_telegram_user_id BIGINT NOT NULL,
  actor_username TEXT,
  notes TEXT,
  payload_before JSONB NOT NULL,
  payload_after JSONB,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- publications: publicações no canal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS publications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES offers(id),
  channel_id TEXT NOT NULL,
  telegram_message_id BIGINT,
  final_caption TEXT NOT NULL,
  final_image_url TEXT,
  final_affiliate_url TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  published_at TIMESTAMPTZ,
  error_code TEXT,
  error_detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- workflow_events: auditoria append-only
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_events (
  id BIGSERIAL PRIMARY KEY,
  correlation_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_events_correlation
  ON workflow_events(correlation_id);

CREATE INDEX IF NOT EXISTS idx_workflow_events_entity
  ON workflow_events(entity_type, entity_id);
