# Orderbook — Design & Build Plan

A CEX-style spot exchange, learning project pushed toward production-shaped architecture. Spot first, perps later. Mocked balances at MVP, designed so on-chain Solana deposits can be bolted on later as a separate service.

---

## Scope (MVP)

- **Type:** Centralized exchange (CEX), spot.
- **Custody:** Mocked balances. Ledger interface designed so a future deposit-watcher can be slotted in without redesign.
- **Order types:** limit, market, IOC, FOK, post-only.
- **Markets:** Multi-market from day one (engine is one instance per market). Start with `SOL/USDC`.
- **Frontend:** Next.js trading UI — orderbook, depth, recent trades, order entry, balances.
- **Stop / stop-limit:** Out of scope for v1 (separate trigger engine — add later).
- **Perps:** Out of scope for v1. Layer on top of working spot.

---

## Tech stack (locked)

| Layer            | Choice                                |
|------------------|---------------------------------------|
| Monorepo         | Turborepo + Bun                       |
| Matching engine  | Rust (Cargo workspace inside repo)    |
| REST API         | TypeScript on Bun (Hono or Express)   |
| WebSocket fanout | TypeScript on Bun                     |
| Workers          | TypeScript on Bun                     |
| Frontend         | Next.js 16 + React 19 + Tailwind v4   |
| Database         | Postgres (Prisma 7, `prisma.config.ts` style) |
| Cache            | Redis                                  |
| Event bus        | Redpanda (Kafka-compatible)           |
| Container        | docker-compose for infra              |

**Why Rust for the engine:** no GC pauses, deterministic, in-memory, single-threaded matching loop, easy to make replayable. The engine is the heart of the system — language matters here. Everything else is glue and TS is fine glue.

---

## Architecture (event-sourced topology)

```
                        ┌─────────────┐
   Browser ─── REST ───▶│  api (TS)   │──┐
        └──── WS ─────▶ │  ws  (TS)   │  │
                        └─────────────┘  │
                                         ▼
                                  ┌──────────────┐  topics:
                                  │  Redpanda    │   orders.in
                                  │  (event bus) │   orders.ack
                                  └──────────────┘   trades.out
                                    ▲      │         book.delta
                                    │      ▼         balances.delta
                              ┌──────────┐  ┌──────────────┐
                              │ engine   │  │ settlement   │──▶ Postgres
                              │ (Rust)   │  │ worker (TS)  │
                              │ in-mem   │  └──────────────┘
                              │ per mkt  │  ┌──────────────┐
                              └──────────┘  │ ws-fanout TS │──▶ clients
                                            └──────────────┘
                                            ┌──────────────┐
                                            │ market-data  │──▶ Redis
                                            │ (candles) TS │
                                            └──────────────┘
```

**Hard isolation rule:** the Rust engine has zero knowledge of Postgres, HTTP, or clients. Its only I/O is Redpanda topics. This is what makes it testable and replayable.

---

## Repo layout

```
orderbook/
├── apps/
│   ├── engine/           # Rust binary — matching engine
│   ├── api/              # TS — REST: auth, order entry, balances, history
│   ├── ws/               # TS — WebSocket fanout
│   ├── settlement/       # TS — consumes trades.out, writes ledger
│   ├── market-data/      # TS — consumes trades.out, builds candles
│   └── web/              # Next.js trading UI
├── packages/
│   ├── types/            # Shared TS types + Zod schemas
│   ├── proto/            # Event schemas (JSON now, Protobuf later)
│   ├── db/               # Prisma schema + generated client
│   └── ui/               # Shared React components
├── infra/
│   └── docker-compose.yml # Postgres, Redis, Redpanda, Redpanda Console
└── turbo.json
```

---

## Component responsibilities

### `engine/` (Rust)
- State: `HashMap<MarketId, OrderBook>`. Each `OrderBook` = `BTreeMap<Price, VecDeque<Order>>` for bids and asks (price-time priority).
- **Input topic:** `orders.in` (one partition per market preserves order).
- **Output topics:** `trades.out`, `book.delta`, `orders.ack`.
- No DB, no HTTP. Pure event-in / event-out.
- Determinism: every event carries monotonic `seq`; engine replays from a given seq for recovery.
- Recovery: periodic snapshot + last-applied-seq to disk → replay log on boot.

### `api/` (TS)
- REST: `POST /orders`, `DELETE /orders/:id`, `GET /balances`, `GET /orders`, `GET /trades`, auth (`/auth/*`).
- Validates with Zod. Reserves balance in Postgres (one tx). Publishes to `orders.in`.
- Awaits `orders.ack` (correlated by `client_order_id`) up to ~500ms; returns to caller.
- Background reaper: any `pending` order older than 30s with no ack → mark rejected, release reservation.

### `settlement/` (TS worker)
- Consumes `trades.out` → debits/credits ledger in Postgres in one tx (double-entry: maker + taker legs).
- Idempotent on `trade_id` via unique key on `ledger_entries`.

### `ws/` (TS)
- Consumes `book.delta` and `trades.out`, fans out to subscribed clients.
- Public channels: `book@MARKET`, `trades@MARKET`, `ticker@MARKET`. Private: `user@USER_ID` (gated by JWT).
- Stateless. Reconnect strategy: client gets snapshot via REST + `last_seq`, streams deltas from `last_seq+1`.

### `market-data/` (TS)
- Consumes `trades.out`, aggregates 1m/5m/1h/1d candles → Redis (hot) + Postgres (history).

### `web/` (Next.js)
- Trading view, order entry, balances, history. REST + WS to backend.

---

## Order lifecycle (limit BUY 1.5 SOL @ $150)

1. Browser → `POST /orders` with `{client_order_id, market, side, type, price, qty}` + JWT.
2. **api** validates Zod, looks up balance, in one tx reserves 225 USDC (decrement `available`, increment `locked`).
3. **api** publishes to `orders.in` (key = market for partition ordering).
4. **api** subscribes to `orders.ack` filtered by `client_order_id`, waits up to 500ms.
5. **engine** consumes, assigns `order_id`, walks ask side from lowest price up while `ask.price <= 150 && remaining > 0`. Each match emits `Trade` on `trades.out`. Remaining qty rests on bid book at $150. Emits `book.delta` + `orders.ack`.
6. **api** receives ack, returns 200.
7. **settlement** consumes each `Trade`. One Postgres tx: debit taker locked USDC, credit taker available SOL, debit maker locked SOL, credit maker available USDC. Writes `trade` row + ledger entries.
8. **ws** fans out `book.delta` to public subscribers; `trades.out` to public + private user channels.
9. **market-data** updates current candle in Redis; rolls completed candles to Postgres.

**Cancel:** same shape — `DELETE /orders/:id` → publish cancel → engine removes → emits `book.delta` + `ack(canceled)` → settlement releases locked funds.

**Two subtleties:**
- Balance reservation lives in **api**, not engine. Engine doesn't know about USD/SOL — it just matches qty.
- Settlement is eventually consistent (~10-50ms). A trader may see "filled" via WS before `GET /balances` reflects it. Documented; acceptable; this is how real exchanges work.

---

## Postgres schema (load-bearing tables)

```
users(id, email, password_hash, created_at)

assets(symbol PK)
markets(id PK, base, quote, tick_size, lot_size, min_qty, status)

balances(user_id, asset, available NUMERIC(38,18), locked NUMERIC(38,18))
  PRIMARY KEY (user_id, asset)

orders(
  id BIGSERIAL PK,
  client_order_id TEXT,
  user_id, market_id, side, type, price, qty,
  filled_qty, status,
  engine_seq BIGINT,
  created_at, updated_at
)
  UNIQUE (user_id, client_order_id)

trades(id, market_id, maker_order_id, taker_order_id, price, qty,
       maker_user_id, taker_user_id, ts)

ledger_entries(
  id BIGSERIAL PK,
  user_id, asset, delta NUMERIC(38,18),
  reason TEXT,                    -- reserve | release | trade_fill | deposit | withdrawal
  ref_type, ref_id,
  created_at,
  UNIQUE (ref_type, ref_id, user_id, asset, reason)  -- idempotency
)

candles(market_id, interval, open_time, o, h, l, c, v,
        PRIMARY KEY (market_id, interval, open_time))
```

**Three rules:**
1. All balance changes go through `ledger_entries`. `balances` is a derived projection — rebuildable from ledger.
2. Idempotency on every consumer's unique key (settlement re-consume is safe).
3. `NUMERIC(38,18)` for all money; engine uses fixed-point integer math (qty/price scaled by lot/tick exponent). **No floats anywhere near balances or prices.**

---

## Failure modes (the interesting ones)

| Failure                          | Recovery                                                                 |
|----------------------------------|--------------------------------------------------------------------------|
| api crash mid-publish            | Client retries with same `client_order_id`; unique constraint dedupes.   |
| engine crash                     | Snapshot + replay from `last_applied_seq`. Idempotent producers.         |
| settlement crash mid-trade       | Kafka offset committed only after Postgres tx; ledger unique key dedupes.|
| ws crash / client disconnect     | Client reconnects, snapshot via REST + `last_seq`, deltas from `last_seq+1`. |
| Engine rejects order (post-only crosses, etc.) | `orders.ack(rejected)` → api releases reservation (compensating ledger entry). |
| Pending order, no ack            | Reaper marks rejected after 30s, releases reservation.                   |

**Append-only rule:** `ledger_entries` never updates or deletes. Compensations are new rows. The chain is the audit trail and the replay source.

---

## Build order

Each step is independently runnable. Don't move on until the previous one works end-to-end.

1. **Infra** — `docker-compose.yml` with Postgres + Redis + Redpanda + Redpanda Console. Boot it. Confirm Redpanda Console at localhost:8080.
2. **Turborepo skeleton** — root `package.json`, `turbo.json`, empty `apps/` and `packages/`. Bun workspace setup.
3. **`packages/db`** — Prisma 7 schema for `users`, `assets`, `markets`, `balances`. Initial migration. Seed: one user, one market (SOL/USDC), starting balances.
4. **`packages/types`** — Order, Trade, BookDelta, OrdersAck types + Zod schemas. Shared event envelope (`{seq, ts, type, payload}`).
5. **`apps/api` (auth + balances only)** — `/auth/register`, `/auth/login` (JWT), `/balances`. Hit it with curl.
6. **`apps/engine` v0** — Rust workspace, single market hardcoded, BTreeMap orderbook, limit-only, no Redpanda yet — drive with a CLI for unit tests on the matching loop. Cover: simple match, partial fill, multiple price levels, FIFO at same price.
7. **Wire engine to Redpanda** — engine consumes `orders.in`, emits `trades.out` + `book.delta` + `orders.ack`. Snapshot/replay.
8. **`apps/api` order entry** — `POST /orders` with balance reservation, publish to Redpanda, await ack. End-to-end with engine.
9. **`apps/settlement`** — consume `trades.out`, double-entry ledger writes. Verify balances reconcile.
10. **`apps/ws`** — public book + trades channels. Connect with `wscat`.
11. **Order types** — add market, IOC, FOK, post-only. Engine-side only; api just passes through.
12. **`apps/market-data`** — candles into Redis + Postgres.
13. **Multi-market** — engine spawns one matcher per market, key Kafka by market.
14. **`apps/web`** — Next.js trading UI: orderbook, depth, trades, order entry, balances.
15. **Private WS channels** — `user@USER_ID` with JWT gate.
16. **Cancel + reaper** — full cancel flow + the 30s pending reaper.
17. **Observability** — structured logs, correlation by `client_order_id`/`engine_seq`. Optional: Prometheus + Grafana.

After 17, you have a complete spot exchange. Then perps as the next chapter (mark price, funding, leverage, liquidations, position management).

---

## Open questions for later

- Self-trade prevention: cancel-newest, cancel-oldest, or decrement-and-cancel?
- Fee model: maker/taker bps, fee asset, where in the flow?
- Rate limiting on `POST /orders`?
- API keys + HMAC signing for programmatic clients?
- On-chain deposit watcher (Solana devnet) — separate project once spot is solid.
