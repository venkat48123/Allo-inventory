// src/lib/idempotency.ts
import { prisma } from "./prisma";
import { NextResponse } from "next/server";

const KEY_TTL_HOURS = 24;

type HandlerResult = {
  body: Record<string, unknown>;
  status: number;
};

export async function withIdempotency(
  idempotencyKey: string | null,
  endpoint: string,
  handler: () => Promise<HandlerResult>
): Promise<NextResponse> {
  if (!idempotencyKey) {
    const { body, status } = await handler();
    return NextResponse.json(body, { status });
  }

  const existing = await prisma.idempotencyKey.findUnique({
    where: { key: idempotencyKey },
  });

  if (existing) {
    const age = (Date.now() - existing.createdAt.getTime()) / (1000 * 60 * 60);
    if (age < KEY_TTL_HOURS && existing.endpoint === endpoint) {
      return NextResponse.json(existing.responseBody, {
        status: existing.responseStatus,
        headers: { "Idempotency-Replayed": "true" },
      });
    }
  }

  const { body, status } = await handler();

  try {
await prisma.idempotencyKey.create({
  data: {
    key: idempotencyKey,
    endpoint,
    responseBody: body as object,
    responseStatus: status,
    reservationId:
      "id" in body && typeof body.id === "string" ? body.id : undefined,
  },
});
  } catch {
    // ignore duplicate key
  }

  return NextResponse.json(body, { status });
}