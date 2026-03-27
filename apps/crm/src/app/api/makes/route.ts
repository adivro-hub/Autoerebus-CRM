import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  try {
    const makes = await prisma.make.findMany({
      orderBy: { order: "asc" },
      include: {
        models: {
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
      },
    });

    return NextResponse.json({ success: true, data: makes });
  } catch (error) {
    console.error("Error fetching makes:", error);
    return NextResponse.json(
      { error: "Eroare la incarcarea marcilor" },
      { status: 500 }
    );
  }
}
