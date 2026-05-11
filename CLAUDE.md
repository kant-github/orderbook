# Orderbook — Project Context

A CEX-style spot exchange. Learning project pushed toward production-shaped architecture. See `plan.md` for the full design and build order.

## What this is

- **Type:** Centralized spot exchange. Perps later, after spot is solid.
- **Custody:** Mocked balances. Designed so a Solana deposit-watcher can be added later as a separate service without redesign.
- **Markets:** Multi-market from day one (`SOL/USDC` first). Engine is one matcher instance per market.

## Stack (locked — do not propose alternatives without asking)

| Layer            | Choice                                |
|------------------|---------------------------------------|
| Monorepo         | Turborepo + Bun                       |
| Matching engine  | Rust (Cargo workspace inside repo)    |
| REST API         | TypeScript on Bun (Hono or Express)   |
| WebSocket fanout | TypeScript on Bun                     |
| Workers          | TypeScript on Bun                     |
| Frontend         | Next.js 16 + React 19 + Tailwind v4   |
| Database         | Postgres + Prisma 7 (`prisma.config.ts` style) |
| Cache            | Redis                                  |
| Event bus        | Redpanda (Kafka-compatible)           |

## Architecture (event-sourced)

All services communicate through Redpanda topics. Engine has zero knowledge of Postgres, HTTP, or clients — its only I/O is Redpanda.

Topics:
- `orders.in` — new orders, cancels (key = market for partition ordering)
- `orders.ack` — engine acks (filled/partial/rejected/canceled)
- `trades.out` — executed trades
- `book.delta` — orderbook level changes

## Service layout

```
apps/
  engine/        Rust — matching engine
  api/           TS  — REST: auth, orders, balances
  ws/            TS  — WebSocket fanout (public + private channels)
  settlement/    TS  — consumes trades.out → ledger writes
  market-data/   TS  — consumes trades.out → candles in Redis + Postgres
  web/           Next.js trading UI
packages/
  db/            Prisma schema + client (@repo/db)
  types/         Shared TS types + Zod schemas (@repo/types)
  proto/         Event schemas (JSON for now, Protobuf later) (@repo/proto)
  ui/            Shared React components (@repo/ui)
infra/
  docker-compose.yml — Postgres, Redis, Redpanda, Redpanda Console
```

## Hard rules — never break these

1. **No floats anywhere near money.** All prices/quantities/balances are `NUMERIC(38,18)` in Postgres. Engine uses fixed-point integer math (qty/price scaled by lot/tick exponent).
2. **`ledger_entries` is append-only.** Never update or delete. Compensations are new rows. The chain is the audit trail and replay source.
3. **All balance changes go through `ledger_entries`.** The `balances` table is a derived projection, rebuildable from ledger.
4. **Engine has zero DB / HTTP / client awareness.** Only Redpanda I/O. Any temptation to "just have the engine write to Postgres" — stop.
5. **Balance reservation lives in `api`, not engine.** Engine matches qty; it doesn't know what USDC or SOL means.
6. **Idempotency on every consumer.** Unique keys on `(user_id, client_order_id)` for orders, `(ref_type, ref_id, user_id, asset, reason)` for ledger entries. Crashes must be safe to re-consume.
7. **Engine determinism.** Every input event has a monotonic `seq`. Engine snapshots state + records `last_applied_seq` for replay/recovery.

## Patterns

- **Order ack flow:** `api` publishes to `orders.in`, awaits `orders.ack` correlated by `client_order_id` up to ~500ms, returns to caller. Background reaper marks any 30s+ pending order as rejected and releases its reservation.
- **WS reconnect:** client gets snapshot via REST + `last_seq`, then streams deltas from `last_seq+1`. Sequence-gap detection on client.
- **Settlement is eventually consistent (~10-50ms behind matches).** Documented in API. Don't try to make it synchronous.
- **Multi-market:** key `orders.in` by market id → all orders for one market land on the same partition → preserves ordering within a market.

## Conventions

- **Prisma 7:** `prisma.config.ts` is the source of truth for `DATABASE_URL`, NOT the `url` field in `schema.prisma`'s datasource block.
- **TS shared package** (`@repo/types`) exports raw TypeScript — no build step.
- **React 19:** use `React.SyntheticEvent`, not the deprecated `React.FormEvent`.
- **Bun is the runtime + package manager** for all TS apps. Not Node.

## What's out of scope for v1

- Stop / stop-limit orders (separate trigger engine, add later).
- Perps (mark price, funding, leverage, liquidations).
- On-chain deposits/withdrawals (separate deposit-watcher project once spot is solid).
- HFT-grade latency optimizations (custom price-ladder arrays, kernel bypass, etc.).

## Working with the user

- Correct the user when a question or approach is wrong. The user explicitly wants this — no rubber-stamping.
- Build slowly, step by step (see the build order in `plan.md`). Don't skip ahead.
- If a decision conflicts with the locked stack or hard rules above, surface the conflict before implementing.
