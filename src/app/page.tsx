// src/app/page.tsx
export const dynamic = "force-dynamic";

import { ProductCard } from "@/components/ProductCard";
import type { ProductWithStock } from "@/types";
import { ShoppingBag } from "lucide-react";

async function getProducts(): Promise<ProductWithStock[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/products`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Allo Inventory</h1>
            <p className="text-xs text-slate-500">Multi-warehouse fulfillment</p>
          </div>
        </div>
      </header>

      {/* Product grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
          <p className="text-slate-500 text-sm mt-1">
            {products.length} products available across your warehouses
          </p>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No products found. Run <code className="bg-slate-100 px-1 rounded">npm run db:seed</code> to add sample data.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}