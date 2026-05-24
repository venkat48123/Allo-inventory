// src/app/checkout/[id]/CheckoutClient.tsx
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle,
  XCircle,
  Clock,
  ShoppingBag,
  MapPin,
  Package,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CountdownTimer } from "@/components/CountdownTimer";
import { formatPrice } from "@/lib/utils";

interface ReservationData {
  id: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  productPrice: number;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
}

interface CheckoutClientProps {
  reservation: ReservationData;
}

type UiStatus = "PENDING" | "CONFIRMED" | "RELEASED" | "EXPIRED";

export function CheckoutClient({ reservation: initial }: CheckoutClientProps) {
  const [status, setStatus] = useState<UiStatus>(initial.status);
  const [loading, setLoading] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExpired = useCallback(() => {
    setStatus("EXPIRED");
  }, []);

  async function handleConfirm() {
    setLoading("confirm");
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${initial.id}/confirm`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.status === 410) {
        setStatus("EXPIRED");
        setError("Your reservation expired before we could confirm it.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setStatus("CONFIRMED");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel() {
    setLoading("cancel");
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${initial.id}/release`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setStatus("RELEASED");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(null);
    }
  }

  const statusConfig = {
    PENDING: {
      label: "Awaiting Payment",
      color: "warning" as const,
      icon: <Clock className="w-4 h-4" />,
    },
    CONFIRMED: {
      label: "Order Confirmed",
      color: "success" as const,
      icon: <CheckCircle className="w-4 h-4" />,
    },
    RELEASED: {
      label: "Reservation Cancelled",
      color: "secondary" as const,
      icon: <XCircle className="w-4 h-4" />,
    },
    EXPIRED: {
      label: "Reservation Expired",
      color: "destructive" as const,
      icon: <XCircle className="w-4 h-4" />,
    },
  };

  const cfg = statusConfig[status];

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-slate-500 hover:text-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-slate-900">Checkout</span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Order summary card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {initial.productImageUrl && (
            <img
              src={initial.productImageUrl}
              alt={initial.productName}
              className="w-full h-48 object-cover"
            />
          )}
          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">{initial.productName}</h1>
                <p className="text-slate-500 text-sm flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {initial.warehouseName}
                </p>
              </div>
              <Badge variant={cfg.color} className="flex items-center gap-1 whitespace-nowrap">
                {cfg.icon}
                {cfg.label}
              </Badge>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-slate-600">
                <Package className="w-4 h-4" />
                <span className="text-sm">Qty: {initial.quantity}</span>
              </div>
              <span className="text-2xl font-bold text-slate-900">
                {formatPrice(initial.productPrice * initial.quantity)}
              </span>
            </div>

            {/* Reservation details */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Reservation ID</span>
                <code className="text-slate-700 font-mono text-xs bg-slate-200 px-2 py-0.5 rounded">
                  {initial.id.slice(0, 12)}…
                </code>
              </div>
              {(status === "PENDING") && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Time remaining</span>
                  <CountdownTimer
                    expiresAt={initial.expiresAt}
                    onExpired={handleExpired}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-4 border border-red-200">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        {status === "PENDING" && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleConfirm}
              disabled={!!loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-12 text-base"
            >
              {loading === "confirm" ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Confirm Purchase
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={!!loading}
              className="flex-1 h-12 text-base border-slate-300 text-slate-700"
            >
              {loading === "cancel" ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  Cancelling…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Cancel
                </span>
              )}
            </Button>
          </div>
        )}

        {status === "CONFIRMED" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-bold text-emerald-800">Order Confirmed!</h2>
            <p className="text-emerald-700 text-sm">
              Your purchase has been confirmed and stock has been allocated from {initial.warehouseName}.
            </p>
            <Link href="/">
              <Button variant="outline" className="mt-2">
                Continue Shopping
              </Button>
            </Link>
          </div>
        )}

        {(status === "RELEASED" || status === "EXPIRED") && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-3">
            <XCircle className="w-12 h-12 text-slate-400 mx-auto" />
            <h2 className="text-lg font-bold text-slate-700">
              {status === "EXPIRED" ? "Reservation Expired" : "Reservation Cancelled"}
            </h2>
            <p className="text-slate-500 text-sm">
              {status === "EXPIRED"
                ? "Your hold on this item has expired. The stock has been returned to inventory."
                : "Your reservation was cancelled and the stock has been returned."}
            </p>
            <Link href="/">
              <Button className="mt-2 bg-indigo-600 hover:bg-indigo-700">
                Back to Products
              </Button>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
