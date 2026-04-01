import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

// PATCH - update test drive status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const testDrive = await prisma.testDrive.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.feedback !== undefined && { feedback: body.feedback }),
        ...(body.agentId !== undefined && { agentId: body.agentId || null }),
        ...(body.scheduledAt && { scheduledAt: new Date(body.scheduledAt) }),
        ...(body.duration && { duration: body.duration }),
      },
    });

    return NextResponse.json(testDrive);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Eroare la actualizare";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - cancel/delete test drive
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.testDrive.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Eroare la stergere";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
