import Link from "next/link";

interface ProductWithStock {
  _id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}

async function getProducts(): Promise<ProductWithStock[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!baseUrl) {
      console.error("NEXT_PUBLIC_APP_URL is missing");
      return [];
    }

    const res = await fetch(`${baseUrl}/api/products`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("Failed to fetch products");
    }

    return res.json();
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Allo Inventory</h1>

          <Link
            href="/add-product"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add Product
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="bg-white p-6 rounded shadow text-center text-gray-500">
            No products found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product._id}
                className="bg-white rounded shadow p-5"
              >
                <h2 className="text-xl font-semibold mb-2">
                  {product.name}
                </h2>

                <p className="text-gray-600 mb-1">
                  Category: {product.category}
                </p>

                <p className="text-gray-600 mb-1">
                  Price: ₹{product.price}
                </p>

                <p className="text-gray-600 mb-4">
                  Stock: {product.stock}
                </p>

                <div className="flex gap-3">
                  <Link
                    href={`/edit-product/${product._id}`}
                    className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                  >
                    Edit
                  </Link>

                  <button className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}