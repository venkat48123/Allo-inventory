"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Package, AlertCircle, X, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import type { ProductWithStock } from "@/types";

interface ProductCardProps {
  product: ProductWithStock;
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(
    product.stocks[0]?.warehouseId ?? ""
  );
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStock = product.stocks.find((s) => s.warehouseId === selectedWarehouse);
  const available = selectedStock?.available ?? 0;

  function openModal() {
    setSelectedWarehouse(product.stocks[0]?.warehouseId ?? "");
    setQuantity(1);
    setError(null);
    setShowModal(true);
  }

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
          quantity,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError("Not enough stock available!");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      setShowModal(false);
      router.push(`/checkout/${data.id}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  const totalAvailable = product.stocks.reduce((sum, s) => sum + s.available, 0);

  return (
    <>
      {/* Product Card */}
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

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Total available</span>
            <Badge variant={totalAvailable > 5 ? "success" : totalAvailable > 0 ? "warning" : "destructive"}>
              {totalAvailable > 0 ? `${totalAvailable} units` : "Out of stock"}
            </Badge>
          </div>

          <Button
            onClick={openModal}
            disabled={totalAvailable <= 0}
            className="mt-auto bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Package className="w-4 h-4 mr-2" />
            {totalAvailable <= 0 ? "Out of Stock" : "Reserve Now"}
          </Button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Modal Box */}
          <div className="relative bg-[#1a1a2e] text-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            {/* Close */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title */}
            <div>
              <h2 className="text-xl font-bold">{product.name}</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                SKU: {product.id.slice(0, 10).toUpperCase()}
              </p>
            </div>

            {/* Hold notice */}
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-amber-400 text-sm">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>
                Holds stock for <strong>10 minutes</strong>. Complete checkout before it expires.
              </span>
            </div>

            {/* Warehouse selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Warehouse</p>
              <div className="space-y-2">
                {product.stocks.map((stock) => (
                  <button
                    key={stock.warehouseId}
                    onClick={() => {
                      setSelectedWarehouse(stock.warehouseId);
                      setQuantity(1);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm ${
                      selectedWarehouse === stock.warehouseId
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-slate-700 bg-slate-800/50 hover:border-slate-500"
                    }`}
                  >
                    <span className="font-medium">{stock.warehouseName}</span>
                    <span className={stock.available > 0 ? "text-emerald-400" : "text-red-400"}>
                      {stock.available > 0 ? `${stock.available} available` : "Out of stock"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quantity</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-2">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="text-slate-300 hover:text-white w-6 h-6 flex items-center justify-center text-lg font-bold"
                  >
                    −
                  </button>
                  <span className="text-white font-bold text-lg w-6 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(available, q + 1))}
                    className="text-slate-300 hover:text-white w-6 h-6 flex items-center justify-center text-lg font-bold"
                  >
                    +
                  </button>
                </div>
                <span className="text-slate-400 text-sm">of {available} available</span>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-700">
              <span className="text-slate-400">Total</span>
              <span className="text-2xl font-bold">{formatPrice(product.price * quantity)}</span>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReserve}
                disabled={loading || available <= 0}
                className="flex-1 py-3 rounded-xl bg-white text-black font-semibold hover:bg-slate-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Reserve Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}