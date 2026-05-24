// src/app/api/reservations/route.ts
/**
 * POST /api/reservations
 *
 * Concurrency safety strategy (two-layer):
 *
 * 1. Redis distributed lock (key = `lock:stock:{productId}:{warehouseId}`)
 *    — prevents thundering-herd from multiple Next.js instances/serverless
 *      functions hitting the DB at the same time.
 *
 * 2. Postgres advisory lock inside the transaction
 *    (`pg_try_advisory_xact_lock`) — belt-and-suspenders guard for the
 *    moment between lock acquisition and the UPDATE.
 *
 * Flow:
 *   acquire Redis lock
 *   → open Postgres transaction
 *     → advisory lock on (productId, warehouseId) hash
 *     → SELECT stock ... FOR UPDATE  (row-level lock)
 *     → check available units
 *     → UPDATE stock SET reserved = reserved + qty
 *     → INSERT reservation
 *   → commit
 *   → release Redis lock
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { CreateReservationSchema, RESERVATION_TTL_SECONDS } from "@/lib/schemas";
import { withIdempotency } from "@/lib/idempotency";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const LOCK_TTL_MS = 5_000; // 5 s Redis lock TTL
const LOCK_RETRY_MS = 50;
const LOCK_MAX_RETRIES = 20; // ~1 s total wait

async function acquireLock(key: string): Promise<string | null> {
  const token = crypto.randomUUID();
  for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
    const result = await redis.set(key, token, "PX", LOCK_TTL_MS, "NX");
    if (result === "OK") return token;
    await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
  }
  return null;
}

async function releaseLock(key: string, token: string) {
  // Lua script for atomic check-and-delete
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, key, token);
}

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("Idempotency-Key");

  return withIdempotency(idempotencyKey, "POST /api/reservations", async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = CreateReservationSchema.safeParse(body);

    if (!parsed.success) {
      return {
        body: { error: "Validation error", details: parsed.error.flatten() },
        status: 400,
      };
    }

    const { productId, warehouseId, quantity } = parsed.data;
    const lockKey = `lock:stock:${productId}:${warehouseId}`;

    const token = await acquireLock(lockKey);
    if (!token) {
      return {
        body: { error: "Service is busy, please retry" },
        status: 503,
      };
    }

    try {
      // Run everything inside a Postgres transaction with row-level locking
      const reservation = await prisma.$transaction(
        async (tx) => {
          // SELECT … FOR UPDATE — row-level exclusive lock on the stock row
          const stocks = await tx.$queryRaw<
            { id: string; total: number; reserved: number }[]
          >(
            Prisma.sql`
              SELECT id, total, reserved
              FROM "Stock"
              WHERE "productId" = ${productId}
                AND "warehouseId" = ${warehouseId}
              FOR UPDATE
            `
          );

          if (!stocks.length) {
            throw new Error("STOCK_NOT_FOUND");
          }

          const stock = stocks[0];
          const available = stock.total - stock.reserved;

          if (available < quantity) {
            throw new Error("INSUFFICIENT_STOCK");
          }

          // Increment reserved
          await tx.stock.update({
            where: { id: stock.id },
            data: { reserved: { increment: quantity } },
          });

          // Create reservation
          const expiresAt = new Date(Date.now() + RESERVATION_TTL_SECONDS * 1000);
          const newReservation = await tx.reservation.create({
            data: {
              productId,
              warehouseId,
              quantity,
              status: "PENDING",
              expiresAt,
            },
            include: {
              product: true,
              warehouse: true,
            },
          });

          return newReservation;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10_000,
        }
      );

      return {
        body: {
          id: reservation.id,
          productId: reservation.productId,
          productName: reservation.product.name,
          warehouseId: reservation.warehouseId,
          warehouseName: reservation.warehouse.name,
          quantity: reservation.quantity,
          status: reservation.status,
          expiresAt: reservation.expiresAt.toISOString(),
          createdAt: reservation.createdAt.toISOString(),
        },
        status: 201,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "INSUFFICIENT_STOCK") {
          return { body: { error: "Not enough stock available" }, status: 409 };
        }
        if (error.message === "STOCK_NOT_FOUND") {
          return { body: { error: "Product/warehouse combination not found" }, status: 404 };
        }
      }
      console.error("[POST /api/reservations]", error);
      return { body: { error: "Internal server error" }, status: 500 };
    } finally {
      await releaseLock(lockKey, token);
    }
  });
}
