import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

// GET - list all equipment categories with items
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await prisma.equipmentCategory.findMany({
    orderBy: { order: "asc" },
    include: {
      items: {
        orderBy: { order: "asc" },
      },
    },
  });

  return NextResponse.json({ success: true, data: categories });
}

// POST - seed/sync equipment from Autovit scan
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { categories } = body as {
    categories: {
      key: string;
      label: string;
      items: { key: string; label: string }[];
    }[];
  };

  if (!categories || !Array.isArray(categories)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  let categoriesCreated = 0;
  let categoriesUpdated = 0;
  let itemsCreated = 0;
  let itemsUpdated = 0;

  for (let ci = 0; ci < categories.length; ci++) {
    const cat = categories[ci];

    // Upsert category
    const existing = await prisma.equipmentCategory.findUnique({
      where: { autovitKey: cat.key },
    });

    let categoryId: string;
    if (existing) {
      await prisma.equipmentCategory.update({
        where: { id: existing.id },
        data: { name: cat.label, order: ci },
      });
      categoryId = existing.id;
      categoriesUpdated++;
    } else {
      const created = await prisma.equipmentCategory.create({
        data: {
          name: cat.label,
          autovitKey: cat.key,
          order: ci,
        },
      });
      categoryId = created.id;
      categoriesCreated++;
    }

    // Upsert items
    for (let ii = 0; ii < cat.items.length; ii++) {
      const item = cat.items[ii];

      const existingItem = await prisma.equipmentItem.findUnique({
        where: { autovitKey: item.key },
      });

      if (existingItem) {
        await prisma.equipmentItem.update({
          where: { id: existingItem.id },
          data: { name: item.label, categoryId, order: ii },
        });
        itemsUpdated++;
      } else {
        await prisma.equipmentItem.create({
          data: {
            name: item.label,
            autovitKey: item.key,
            categoryId,
            order: ii,
          },
        });
        itemsCreated++;
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      categoriesCreated,
      categoriesUpdated,
      itemsCreated,
      itemsUpdated,
      totalCategories: categories.length,
      totalItems: categories.reduce((s, c) => s + c.items.length, 0),
    },
  });
}
