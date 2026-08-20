---
type: "query"
date: "2026-08-20T13:11:30.100404+00:00"
question: "Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Env", "Source", "OauthStateRepository", "ApprovalRepository", "BrowserPool", "SessionStore", "TelegramGateway"]
---

# Q: Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?

## Answer

Expanded from original query via graph vocabulary: env, approval, automation, browser, oauth, offer, repository, session, source, telegram, adapter. Env is a shared validated configuration hub imported by 24 nodes. It connects communities because offer adapters read source credentials and intervals; persistence reads database settings; OAuth reads Mercado Livre credentials; Telegram approval reads bot and administrator settings; browser automation reads session and browser settings; the HTTP server reads authentication and runtime settings. These are import dependencies, not evidence that Env orchestrates the business flow. The architectural consequence is broad configuration coupling: changing the Env contract may affect many communities.

## Outcome

- Signal: useful

## Source Nodes

- Env
- Source
- OauthStateRepository
- ApprovalRepository
- BrowserPool
- SessionStore
- TelegramGateway