import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.idempotencyKey.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const [mumbai, delhi, bangalore] = await Promise.all([
    prisma.warehouse.create({
      data: { name: "Mumbai Hub", location: "Mumbai, Maharashtra" },
    }),
    prisma.warehouse.create({
      data: { name: "Delhi DC", location: "New Delhi, Delhi" },
    }),
    prisma.warehouse.create({
      data: { name: "Bangalore FC", location: "Bangalore, Karnataka" },
    }),
  ]);

  console.log("✅ Warehouses created");

  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Wireless Noise-Cancelling Headphones",
        description: "Premium over-ear headphones with 30hr battery life and ANC.",
        price: 1299900,
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Mechanical Keyboard TKL",
        description: "Tenkeyless mechanical keyboard with Cherry MX switches.",
        price: 849900,
        imageUrl: "https://images.unsplash.com/photo-1561112078-7d24e04c3407?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "27\" 4K IPS Monitor",
        description: "Ultra-sharp 4K display with 99% sRGB coverage.",
        price: 3299900,
        imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "USB-C Hub 7-in-1",
        description: "HDMI 4K, 3× USB-A, SD card reader, 100W PD passthrough.",
        price: 249900,
        imageUrl: "https://images.unsplash.com/photo-1625842268584-8f3296236761?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Ergonomic Office Chair",
        description: "Lumbar support, adjustable armrests, mesh back.",
        price: 2199900,
        imageUrl: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Smartphone Stand & Wireless Charger",
        description: "15W fast wireless charging with adjustable viewing angle.",
        price: 179900,
        imageUrl: "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Portable SSD 1TB",
        description: "USB-C, up to 1050MB/s read speed, shock resistant.",
        price: 899900,
        imageUrl: "https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Webcam 4K Auto-Focus",
        description: "4K 30fps, built-in ring light, noise-cancelling mic.",
        price: 649900,
        imageUrl: "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Mechanical Numpad",
        description: "Compact 21-key numpad with Cherry MX Red switches.",
        price: 299900,
        imageUrl: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Desk Lamp with USB Charging",
        description: "LED, 5 colour temps, 10 brightness levels, USB-A port.",
        price: 249900,
        imageUrl: "https://images.unsplash.com/photo-1534189479463-9194b52e7b5e?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Gaming Mouse 16000 DPI",
        description: "RGB, 7 programmable buttons, 16000 DPI optical sensor.",
        price: 349900,
        imageUrl: "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Laptop Backpack 15.6\"",
        description: "Water-resistant, USB charging port, anti-theft zipper.",
        price: 189900,
        imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Smart LED Desk Fan",
        description: "Brushless motor, 12 speeds, touch control, whisper quiet.",
        price: 399900,
        imageUrl: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Noise-Cancelling Earbuds TWS",
        description: "ANC, 8hr battery + 32hr case, IPX5 water resistant.",
        price: 799900,
        imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Monitor Light Bar",
        description: "Auto-dimming, no screen glare, USB powered, warm/cool light.",
        price: 219900,
        imageUrl: "https://images.unsplash.com/photo-1616763355548-1b606f439f86?w=400",
      },
    }),
  ]);

  console.log("✅ Products created");

  const stockData = [];
  for (const product of products) {
    for (const warehouse of [mumbai, delhi, bangalore]) {
      const total = Math.random() < 0.2 ? 1 : Math.floor(Math.random() * 20) + 3;
      stockData.push({
        productId: product.id,
        warehouseId: warehouse.id,
        total,
        reserved: 0,
      });
    }
  }

  await prisma.stock.createMany({ data: stockData });

  console.log("✅ Stock created");
  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());