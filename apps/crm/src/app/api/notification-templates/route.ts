import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.notificationTemplate.findMany({
    orderBy: [{ channel: "asc" }, { key: "asc" }],
  });

  return NextResponse.json({ templates });
}
