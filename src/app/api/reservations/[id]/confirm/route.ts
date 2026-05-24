// src/app/api/reservations/[id]/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const idempotencyKey = req.headers.get("Idempotency-Key");
  const { id } = params;

  return withIdempotency(
    idempotencyKey,
    `POST /api/reservations/${id}/confirm`,
    async () => {
      const reservation = await prisma.reservation.findUnique({
        where: { id },
        include: { product: true, warehouse: true },
      });

      if (!reservation) {
        return { body: { error: "Reservation not found" }, status: 404 };
      }

      if (reservation.status === "CONFIRMED") {
        return {
          body: {
            id: reservation.id,
            status: reservation.status,
            message: "Already confirmed",
          },
          status: 200,
        };
      }

      if (reservation.status === "RELEASED") {
        return {
          body: { error: "Reservation has already been released" },
          status: 410,
        };
      }

      if (new Date() > reservation.expiresAt) {
        await prisma.$transaction([
          prisma.stock.updateMany({
            where: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
            data: { reserved: { decrement: reservation.quantity } },
          }),
          prisma.reservation.update({
            where: { id },
            data: { status: "RELEASED" },
          }),
        ]);
        return { body: { error: "Reservation has expired" }, status: 410 };
      }

      await prisma.$transaction([
        prisma.stock.updateMany({
          where: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
          data: {
            total: { decrement: reservation.quantity },
            reserved: { decrement: reservation.quantity },
          },
        }),
        prisma.reservation.update({
          where: { id },
          data: { status: "CONFIRMED" },
        }),
      ]);

      return {
        body: {
          id: reservation.id,
          productName: reservation.product.name,
          warehouseName: reservation.warehouse.name,
          quantity: reservation.quantity,
          status: "CONFIRMED" as const,
          message: "Reservation confirmed successfully",
        },
        status: 200,
      };
    }
  );
}