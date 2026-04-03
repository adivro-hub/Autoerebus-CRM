import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand");

  try {
    const leadWhere: Record<string, unknown> = {};
    if (brand && brand !== "ALL") leadWhere.brand = brand;

    const leads = await prisma.lead.findMany({
      where: leadWhere,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            title: true,
            year: true,
            price: true,
            discountPrice: true,
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { deals: true } },
      },
    });

    return NextResponse.json({ data: leads });
  } catch {
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
