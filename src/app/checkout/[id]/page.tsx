import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/ProductCard";
import { ShoppingBag } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let products: any[] = [];

  try {
    products = await prisma.product.findMany({
      include: {
        stocks: {
          include: { warehouse: true },
        },
      },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch products:", error);
  }

  const mapped = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    price: p.price,
    stocks: p.stocks.map((s: any) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      warehouseLocation: s.warehouse.location,
      total: s.total,
      reserved: s.reserved,
      available: Math.max(0, s.total - s.reserved),
    })),
  }));

  return (
    <main className="min-h-screen bg-slate-50">
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
          <p className="text-slate-500 text-sm mt-1">
            {mapped.length} products available across your warehouses
          </p>
        </div>

        {mapped.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No products found. Run <code className="bg-slate-100 px-1 rounded">npm run db:seed</code> to add sample data.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {mapped.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}