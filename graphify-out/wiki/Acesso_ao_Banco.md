# Acesso ao Banco

> 6 nodes

## Key Concepts

- **Database** (6 connections) — `apps/worker/src/adapters/persistence/db.ts`
- **.query()** (2 connections) — `apps/worker/src/adapters/persistence/db.ts`
- **.withTransaction()** (2 connections) — `apps/worker/src/adapters/persistence/db.ts`
- **.close()** (1 connections) — `apps/worker/src/adapters/persistence/db.ts`
- **.constructor()** (1 connections) — `apps/worker/src/adapters/persistence/db.ts`
- **.healthCheck()** (1 connections) — `apps/worker/src/adapters/persistence/db.ts`

## Relationships

- [Persistência de Produtos](Persistência_de_Produtos.md) (1 shared connections)

## Source Files

- `apps/worker/src/adapters/persistence/db.ts`

## Audit Trail

- EXTRACTED: 7 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*