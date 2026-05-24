// src/app/api/reservations/[id]/release/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (reservation.status === "RELEASED") {
      return NextResponse.json({ message: "Already released" }, { status: 200 });
    }

    if (reservation.status === "CONFIRMED") {
      return NextResponse.json(
        { error: "Cannot release a confirmed reservation" },
        { status: 409 }
      );
    }

    // Release: return the hold back to available
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

    return NextResponse.json({
      id: reservation.id,
      status: "RELEASED",
      message: "Reservation released",
    });
  } catch (error) {
    console.error("[POST /api/reservations/:id/release]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
