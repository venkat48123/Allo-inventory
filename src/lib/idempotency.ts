// src/lib/idempotency.ts
/**
 * Idempotency helpers.
 *
 * Strategy: store keyed responses in the IdempotencyKey table.
 * On retry (same Idempotency-Key header + same endpoint) we return the
 * cached response body/status without re-running any side effect.
 *
 * Redis is intentionally NOT used here so the record survives restarts
 * and can be inspected by ops. TTL is enforced at the DB level — keys
 * older than 24 h are ignored (a cron/lazy-cleanup can purge them).
 */
import { prisma } from "./prisma";
import { NextResponse } from "next/server";

const KEY_TTL_HOURS = 24;

export async function withIdempotency<T>(
  idempotencyKey: string | null,
  endpoint: string,
  handler: () => Promise<{ body: T; status: number }>
): Promise<NextResponse> {
  if (!idempotencyKey) {
    // No key supplied — just run the handler
    const { body, status } = await handler();
    return NextResponse.json(body, { status });
  }

  // Check for existing key
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key: idempotencyKey },
  });

  if (existing) {
    const age =
      (Date.now() - existing.createdAt.getTime()) / (1000 * 60 * 60);
    if (age < KEY_TTL_HOURS && existing.endpoint === endpoint) {
      // Return cached response
      return NextResponse.json(existing.responseBody, {
        status: existing.responseStatus,
        headers: { "Idempotency-Replayed": "true" },
      });
    }
    // Key exists but is stale or for a different endpoint — treat as new
  }

  const { body, status } = await handler();

  // Persist — ignore conflicts (two simultaneous identical requests race)
  try {
    await prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        endpoint,
        responseBody: body as object,
        responseStatus: status,
        // Optionally link to a reservation when body contains an id
        reservationId:
          typeof body === "object" &&
          body !== null &&
          "id" in body &&
          typeof (body as { id: unknown }).id === "string"
            ? (body as { id: string }).id
            : undefined,
      },
    });
  } catch {
    // Conflict on unique key — another request beat us to it; not fatal
  }

  return NextResponse.json(body, { status });
}
