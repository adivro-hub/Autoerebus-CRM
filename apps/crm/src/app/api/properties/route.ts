import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const category = request.nextUrl.searchParams.get("category");

  try {
    const where: Record<string, unknown> = { active: true };
    if (category) where.category = category;

    const properties = await prisma.carPropertyOption.findMany({
      where,
      orderBy: [{ category: "asc" }, { order: "asc" }],
    });

    return NextResponse.json({ success: true, data: properties });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}
