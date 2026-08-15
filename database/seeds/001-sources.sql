-- Seed: fontes iniciais do MVP
INSERT INTO sources (slug, name, store, type, adapter_version, enabled, priority, config)
VALUES
  ('manual', 'Entrada Manual', 'Manual', 'manual', '0.1.0', TRUE, 1, '{}'),
  ('feed-example', 'Feed Exemplo', 'Exemplo', 'feed', '0.1.0', FALSE, 100, '{"url": "https://example.com/feed.json", "format": "json"}')
ON CONFLICT (slug) DO NOTHING;
