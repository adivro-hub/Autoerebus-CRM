import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  if (typeof body.availableTestDrive !== "boolean") {
    return NextResponse.json(
      { error: "availableTestDrive must be a boolean" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.vehicle.update({
      where: { id },
      data: { availableTestDrive: body.availableTestDrive },
      select: { id: true, availableTestDrive: true },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json(
      { error: "Eroare la actualizare" },
      { status: 500 }
    );
  }
}
