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
-- merchants: lojas parceiras de redes de afiliados
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES sources(id),
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  relationship_status TEXT,
  country TEXT,
  feed_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, external_id)
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

CREATE INDEX IF NOT EXISTS idx_products_gtin ON products(gtin) WHERE gtin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_brand_model ON products(brand, model);
CREATE INDEX IF NOT EXISTS idx_products_normalized_title ON products USING gin(to_tsvector('portuguese', normalized_title));

-- ---------------------------------------------------------------------------
-- source_products: mapeamento source_id + external_product_id -> product_id
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_products (
  source_id UUID NOT NULL REFERENCES sources(id),
  external_product_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  merchant_id UUID REFERENCES merchants(id),
  raw_title TEXT,
  raw_identifiers JSONB NOT NULL DEFAULT '{}',
  raw_attributes JSONB NOT NULL DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, external_product_id)
);

CREATE INDEX IF NOT EXISTS idx_source_products_product ON source_products(product_id);

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

CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_product ON offers(product_id);

-- ---------------------------------------------------------------------------
-- offer_price_history: histórico imutável de preços por oferta
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offer_price_history (
  id BIGSERIAL PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES offers(id),
  current_price_cents BIGINT NOT NULL,
  previous_price_cents BIGINT,
  currency CHAR(3) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_price_history_offer
  ON offer_price_history(offer_id, captured_at DESC);

-- ---------------------------------------------------------------------------
-- product_matches: comparações de produtos entre fontes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  left_source_product_id UUID NOT NULL REFERENCES source_products(product_id),
  right_source_product_id UUID NOT NULL REFERENCES source_products(product_id),
  score NUMERIC(3,2) NOT NULL CHECK (score >= 0 AND score <= 1),
  method TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'review',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(left_source_product_id, right_source_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_matches_left
  ON product_matches(left_source_product_id);
CREATE INDEX IF NOT EXISTS idx_product_matches_right
  ON product_matches(right_source_product_id);
CREATE INDEX IF NOT EXISTS idx_product_matches_status
  ON product_matches(status);

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

CREATE INDEX IF NOT EXISTS idx_publications_offer ON publications(offer_id);

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

-- ---------------------------------------------------------------------------
-- dead_letters: ofertas que falharam após retries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dead_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  error_code TEXT NOT NULL,
  error_detail JSONB NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dead_letters_entity
  ON dead_letters(entity_type, entity_id);
