// src/lib/schemas.ts
import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  warehouseId: z.string().min(1, "warehouseId is required"),
  quantity: z.number().int().positive("quantity must be a positive integer"),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const RESERVATION_TTL_SECONDS = 10 * 60; // 10 minutes
