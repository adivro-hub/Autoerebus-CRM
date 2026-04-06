import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

// GET - get equipment for a vehicle
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const equipment = await prisma.vehicleEquipment.findMany({
    where: { vehicleId: id },
    select: { itemId: true },
  });

  return NextResponse.json({
    success: true,
    data: equipment.map((e: { itemId: string }) => e.itemId),
  });
}

// PUT - replace all equipment for a vehicle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { itemIds } = body as { itemIds: string[] };

  if (!Array.isArray(itemIds)) {
    return NextResponse.json({ error: "itemIds must be an array" }, { status: 400 });
  }

  // Delete existing and create new in a transaction
  await prisma.$transaction([
    prisma.vehicleEquipment.deleteMany({ where: { vehicleId: id } }),
    ...itemIds.map((itemId: string) =>
      prisma.vehicleEquipment.create({
        data: { vehicleId: id, itemId },
      })
    ),
  ]);

  return NextResponse.json({ success: true, count: itemIds.length });
}
