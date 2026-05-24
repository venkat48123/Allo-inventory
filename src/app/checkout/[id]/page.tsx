// src/app/checkout/[id]/page.tsx
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CheckoutClient } from "./CheckoutClient";

interface PageProps {
  params: { id: string };
}

async function getReservation(id: string) {
  try {
    const r = await prisma.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    });
    return r;
  } catch {
    return null;
  }
}

export default async function CheckoutPage({ params }: PageProps) {
  const reservation = await getReservation(params.id);

  if (!reservation) notFound();

  // Determine if already expired on load
  const isExpired =
    reservation.status === "PENDING" &&
    new Date() > reservation.expiresAt;

  return (
    <CheckoutClient
      reservation={{
        id: reservation.id,
        productId: reservation.productId,
        productName: reservation.product.name,
        productImageUrl: reservation.product.imageUrl,
        productPrice: reservation.product.price,
        warehouseId: reservation.warehouseId,
        warehouseName: reservation.warehouse.name,
        quantity: reservation.quantity,
        status: isExpired
          ? "RELEASED"
          : (reservation.status as "PENDING" | "CONFIRMED" | "RELEASED"),
        expiresAt: reservation.expiresAt.toISOString(),
        createdAt: reservation.createdAt.toISOString(),
      }}
    />
  );
}