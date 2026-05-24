// src/types/index.ts

export type ReservationStatus = "PENDING" | "CONFIRMED" | "RELEASED";

export interface ProductWithStock {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  stocks: {
    warehouseId: string;
    warehouseName: string;
    warehouseLocation: string;
    total: number;
    reserved: number;
    available: number;
  }[];
}

export interface ReservationWithDetails {
  id: string;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface ApiError {
  error: string;
  code?: string;
}
