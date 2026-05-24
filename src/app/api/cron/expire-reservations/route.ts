// src/app/api/cron/expire-reservations/route.ts
/**
 * Vercel Cron Job — runs every minute in production.
 * Configure in vercel.json:
 *   { "crons": [{ "path": "/api/cron/expire-reservations", "schedule": "* * * * *" }] }
 *
 * Finds PENDING reservations past their expiresAt and releases them,
 * returning the reserved units to available stock.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // In production Vercel signs cron requests; validate if secret is set
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const expired = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      select: { id: true, productId: true, warehouseId: true, quantity: true },
    });

    if (!expired.length) {
      return NextResponse.json({ released: 0 });
    }

    // Group by productId+warehouseId to batch updates
    const grouped = new Map<string, { productId: string; warehouseId: string; quantity: number }>();
    for (const r of expired) {
      const key = `${r.productId}:${r.warehouseId}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.quantity += r.quantity;
      } else {
        grouped.set(key, {
          productId: r.productId,
          warehouseId: r.warehouseId,
          quantity: r.quantity,
        });
      }
    }

    await prisma.$transaction([
      // Release all expired reservations
      prisma.reservation.updateMany({
        where: { id: { in: expired.map((r) => r.id) } },
        data: { status: "RELEASED" },
      }),
      // Batch-decrement reserved counters
      ...Array.from(grouped.values()).map(({ productId, warehouseId, quantity }) =>
        prisma.stock.updateMany({
          where: { productId, warehouseId },
          data: { reserved: { decrement: quantity } },
        })
      ),
    ]);

    console.log(`[cron] Released ${expired.length} expired reservations`);
    return NextResponse.json({ released: expired.length });
  } catch (error) {
    console.error("[cron/expire-reservations]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
