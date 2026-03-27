import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: { firstName: "asc" },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}
