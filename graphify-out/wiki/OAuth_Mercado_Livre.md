# OAuth Mercado Livre

> 19 nodes

## Key Concepts

- **oauth.ts** (20 connections) — `apps/worker/src/adapters/mercadolivre/oauth.ts`
- **mercadolivre.ts** (10 connections) — `apps/worker/src/http/routes/mercadolivre.ts`
- **getMercadoLivreAccessToken()** (8 connections) — `apps/worker/src/adapters/mercadolivre/oauth.ts`
- **completeMercadoLivreAuthorization()** (6 connections) — `apps/worker/src/adapters/mercadolivre/oauth.ts`
- **registerMercadoLivreRoutes()** (6 connections) — `apps/worker/src/http/routes/mercadolivre.ts`
- **createMercadoLivreAuthorizationUrl()** (5 connections) — `apps/worker/src/adapters/mercadolivre/oauth.ts`
- **oauth-state-repository.ts** (5 connections) — `apps/worker/src/adapters/persistence/oauth-state-repository.ts`
- **IntegrationCredentialRepository** (4 connections) — `apps/worker/src/adapters/persistence/integration-credential-repository.ts`
- **OauthStateRepository** (4 connections) — `apps/worker/src/adapters/persistence/oauth-state-repository.ts`
- **assertConfigured()** (4 connections) — `apps/worker/src/adapters/mercadolivre/oauth.ts`
- **requestToken()** (4 connections) — `apps/worker/src/adapters/mercadolivre/oauth.ts`
- **saveToken()** (3 connections) — `apps/worker/src/adapters/mercadolivre/oauth.ts`
- **hashState()** (3 connections) — `apps/worker/src/adapters/persistence/oauth-state-repository.ts`
- **base64Url()** (2 connections) — `apps/worker/src/adapters/mercadolivre/oauth.ts`
- **.consume()** (2 connections) — `apps/worker/src/adapters/persistence/oauth-state-repository.ts`
- **.save()** (2 connections) — `apps/worker/src/adapters/persistence/oauth-state-repository.ts`
- **TokenResponse** (1 connections) — `apps/worker/src/adapters/mercadolivre/oauth.ts`
- **.get()** (1 connections) — `apps/worker/src/adapters/persistence/integration-credential-repository.ts`
- **.save()** (1 connections) — `apps/worker/src/adapters/persistence/integration-credential-repository.ts`

## Relationships

- [Serviços do Worker](Serviços_do_Worker.md) (9 shared connections)
- [Persistência de Produtos](Persistência_de_Produtos.md) (4 shared connections)
- [Adaptadores de Ofertas](Adaptadores_de_Ofertas.md) (3 shared connections)
- [Integrações de Afiliados](Integrações_de_Afiliados.md) (3 shared connections)
- [Aprovação e Telegram](Aprovação_e_Telegram.md) (2 shared connections)

## Source Files

- `apps/worker/src/adapters/mercadolivre/oauth.ts`
- `apps/worker/src/adapters/persistence/integration-credential-repository.ts`
- `apps/worker/src/adapters/persistence/oauth-state-repository.ts`
- `apps/worker/src/http/routes/mercadolivre.ts`

## Audit Trail

- EXTRACTED: 56 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*