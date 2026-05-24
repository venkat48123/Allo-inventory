export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import {
  CreateReservationSchema,
  RESERVATION_TTL_SECONDS,
} from "@/lib/schemas";
import { withIdempotency } from "@/lib/idempotency";
import { Prisma } from "@prisma/client";

const LOCK_TTL_MS = 5_000;
const LOCK_RETRY_MS = 50;
const LOCK_MAX_RETRIES = 20;

async function acquireLock(key: string): Promise<string | null> {
  const redis = getRedis();

  // Skip Redis lock if Redis is not configured
  if (!redis) {
    console.warn("Redis not configured");
    return "no-redis";
  }

  const token = crypto.randomUUID();

  for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
    const result = await redis.set(key, token, "PX", LOCK_TTL_MS, "NX");

    if (result === "OK") {
      return token;
    }

    await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
  }

  return null;
}

async function releaseLock(key: string, token: string) {
  const redis = getRedis();

  if (!redis || token === "no-redis") {
    return;
  }

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

  return withIdempotency(
    idempotencyKey,
    "POST /api/reservations",
    async () => {
      const body = await req.json().catch(() => ({}));

      const parsed = CreateReservationSchema.safeParse(body);

      if (!parsed.success) {
        return {
          body: {
            error: "Validation error",
            details: parsed.error.flatten(),
          },
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
        const reservation = await prisma.$transaction(
          async (tx) => {
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

            await tx.stock.update({
              where: { id: stock.id },
              data: {
                reserved: {
                  increment: quantity,
                },
              },
            });

            const expiresAt = new Date(
              Date.now() + RESERVATION_TTL_SECONDS * 1000
            );

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
            isolationLevel:
              Prisma.TransactionIsolationLevel.ReadCommitted,
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
            return {
              body: { error: "Not enough stock available" },
              status: 409,
            };
          }

          if (error.message === "STOCK_NOT_FOUND") {
            return {
              body: {
                error: "Product/warehouse combination not found",
              },
              status: 404,
            };
          }
        }

        console.error("[POST /api/reservations]", error);

        return {
          body: { error: "Internal server error" },
          status: 500,
        };
      } finally {
        await releaseLock(lockKey, token);
      }
    }
  );
}