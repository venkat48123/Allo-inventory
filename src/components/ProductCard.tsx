// src/components/ProductCard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Package, MapPin, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import type { ProductWithStock } from "@/types";

interface ProductCardProps {
  product: ProductWithStock;
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const firstAvailableStock = product.stocks.find((stock) => stock.available > 0);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(
    firstAvailableStock?.warehouseId ?? product.stocks[0]?.warehouseId ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStock = product.stocks.find((s) => s.warehouseId === selectedWarehouse);
  const available = selectedStock?.available ?? 0;

  async function handleReserve() {
    if (!selectedWarehouse || available <= 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouse,
          quantity: 1,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError("Not enough stock available — someone just grabbed the last unit!");
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      router.push(`/checkout/${data.id}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {product.imageUrl && (
        <div className="relative h-48 bg-slate-100">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-5 flex flex-col flex-1 gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 text-lg leading-snug">{product.name}</h2>
          {product.description && (
            <p className="text-slate-500 text-sm mt-1 line-clamp-2">{product.description}</p>
          )}
        </div>

        <p className="text-2xl font-bold text-slate-900">{formatPrice(product.price)}</p>

        {/* Warehouse selector */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Select Warehouse
          </p>
          <div className="flex flex-col gap-1.5">
            {product.stocks.map((stock) => (
              <label
                key={stock.warehouseId}
                className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  selectedWarehouse === stock.warehouseId
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`warehouse-${product.id}`}
                    value={stock.warehouseId}
                    checked={selectedWarehouse === stock.warehouseId}
                    onChange={() => setSelectedWarehouse(stock.warehouseId)}
                    className="accent-indigo-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{stock.warehouseName}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {stock.warehouseLocation}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={stock.available > 3 ? "success" : stock.available > 0 ? "warning" : "destructive"}
                >
                  {stock.available > 0 ? `${stock.available} left` : "Out of stock"}
                </Badge>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          onClick={handleReserve}
          disabled={loading || available <= 0 || !selectedWarehouse}
          className="mt-auto bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Reserving…
            </span>
          ) : available <= 0 ? (
            "Out of Stock"
          ) : (
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Reserve Now
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
