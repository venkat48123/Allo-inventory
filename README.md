# Allo Inventory

Multi-warehouse inventory reservation platform built with Next.js 14, Prisma, Postgres, and Redis.

## Live Demo

> Deploy URL goes here after `vercel deploy`

---

## Getting Started

### Prerequisites

- Node.js 18+
- A hosted Postgres instance (Supabase, Neon, or Railway — all have free tiers)
- A Redis instance (Upstash or Redis Cloud — both have free tiers)

### 1. Clone & install

```bash
git clone <repo-url>
cd allo-inventory
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Fill in DATABASE_URL, REDIS_URL, NEXT_PUBLIC_APP_URL, CRON_SECRET
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (must be hosted, not local) |
| `REDIS_URL` | Redis connection string |
| `NEXT_PUBLIC_APP_URL` | Full origin for server-side fetch (e.g. `http://localhost:3000`) |
| `CRON_SECRET` | Random secret that authorises the cron endpoint |

### 3. Migrate & seed

```bash
# Push schema to DB and generate Prisma client
npm run db:push

# (Optional) Generate and apply a named migration
npm run db:migrate

# Seed with sample products, warehouses, and stock
npm run db:seed
```

### 4. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## Architecture

### Data model

```
Product  ─────< Stock >───── Warehouse
                               │
                               └── Reservation (PENDING / CONFIRMED / RELEASED)
```

- **Stock** has two counters: `total` (physical units on shelf) and `reserved` (held by PENDING reservations).  
  `available = total - reserved`.
- On **confirm**, both `total` and `reserved` are decremented (the unit is sold).
- On **release / expire**, only `reserved` is decremented (the unit goes back to available).

### Concurrency safety

The reservation endpoint is the critical path. Two concurrent requests for the last unit must result in exactly one success and one 409.

**Two-layer approach:**

1. **Redis distributed lock** (`SET NX PX 5000`) per `(productId, warehouseId)` pair.  
   This prevents thundering-herd across multiple Next.js / Vercel instances.  
   A Lua script does atomic check-and-delete on release so a slow request can't accidentally release another request's lock.

2. **`SELECT … FOR UPDATE`** inside a Postgres transaction.  
   Even if two requests slip through the Redis lock simultaneously (e.g. on first deploy before Redis is warm), the row-level lock ensures only one can proceed at a time.

Together these guarantees are: each reservation attempt reads a consistent snapshot of available stock, increments `reserved` atomically, and never double-allocates.

### Reservation expiry

**Production approach — Vercel Cron:**

`vercel.json` schedules `GET /api/cron/expire-reservations` to run every minute. The endpoint:

1. Finds all `PENDING` reservations with `expiresAt < now()`.
2. Batches the `reserved` decrements grouped by `(productId, warehouseId)`.
3. Marks them `RELEASED` — all in one transaction.

**Lazy cleanup (belt-and-suspenders):**  
`POST /api/reservations/:id/confirm` also checks `expiresAt` on read and releases the reservation if it has expired. This ensures the UI reflects the correct state even if the cron hasn't run yet.

**Alternative (not implemented):** A background worker (Bull/BullMQ + Redis) would give sub-minute precision but adds operational overhead. For a 10-minute TTL, once-per-minute cron is precise enough.

---

## Idempotency (bonus)

`POST /api/reservations` and `POST /api/reservations/:id/confirm` support the `Idempotency-Key` request header.

**Strategy:** keys and their cached response bodies are stored in the `IdempotencyKey` table (Postgres). On a retry:

1. Look up the key in the DB.
2. If found and `< 24h` old and same endpoint → return the cached `responseBody` / `responseStatus` with an `Idempotency-Replayed: true` header.
3. If not found → run the handler, persist the result, return it.

A race between two simultaneous identical retries is safe: `CREATE` on a `UNIQUE` key will throw a conflict for the slower request, which we catch and ignore (the first writer wins and both callers get the same response).

Redis is intentionally **not** used for idempotency storage — Postgres gives durability and auditability without extra infrastructure complexity.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/products` | List products with available stock per warehouse |
| GET | `/api/warehouses` | List warehouses |
| POST | `/api/reservations` | Reserve units — 409 if insufficient stock |
| POST | `/api/reservations/:id/confirm` | Confirm reservation — 410 if expired |
| POST | `/api/reservations/:id/release` | Release reservation early |
| GET | `/api/cron/expire-reservations` | Cron: release expired reservations |

---

## Trade-offs & what I'd do differently

- **Single-unit checkout only.** The UI always reserves `quantity: 1`. The API and DB fully support multi-unit quantities but the product card doesn't expose a quantity picker. Easy to add.

- **No auth.** Reservations are anonymous. In production you'd attach a `userId` to the reservation and gate the confirm/release endpoints behind session checks.

- **Cron granularity.** Vercel Cron minimum is 1 minute; reservations could sit "expired but unreleased" for up to 60 seconds. For most UX this is fine. A BullMQ job scheduled at `expiresAt` would be precise but adds a worker process.

- **Idempotency TTL cleanup.** The `IdempotencyKey` table grows forever. A nightly cron deleting rows older than 24 h would be trivial to add.

- **Optimistic UI.** The product listing page does a full server-side fetch on load. After reserving, navigating back doesn't reflect the updated stock count until a reload. Adding SWR or React Query would fix this cleanly.

- **Redis failure mode.** If Redis is unreachable, the lock acquisition fails with a 503. An improvement would be to fall through to the Postgres-only path (which is still safe) rather than returning an error.
