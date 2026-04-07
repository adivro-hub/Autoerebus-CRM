import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import bcrypt from "bcryptjs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    return NextResponse.json({ error: "Doar adminii pot edita utilizatori" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const updates: any = {};
  if (body.firstName !== undefined) updates.firstName = body.firstName;
  if (body.lastName !== undefined) updates.lastName = body.lastName;
  if (body.phone !== undefined) updates.phone = body.phone || null;
  if (body.role !== undefined) updates.role = body.role;
  if (body.brands !== undefined) updates.brands = Array.isArray(body.brands) ? body.brands : [];
  if (body.permissions !== undefined) updates.permissions = Array.isArray(body.permissions) ? body.permissions : [];
  if (body.active !== undefined) updates.active = body.active;
  if (body.email !== undefined) updates.email = body.email.toLowerCase();
  if (body.password) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Parola trebuie să aibă minim 8 caractere" }, { status: 400 });
    }
    updates.passwordHash = await bcrypt.hash(body.password, 10);
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        brands: true,
        permissions: true,
        active: true,
      },
    });

    await prisma.auditLog
      .create({
        data: {
          action: "USER_UPDATED",
          entity: "User",
          entityId: id,
          userId: session.user.id,
          details: Object.keys(updates),
        },
      })
      .catch(() => {});

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("[Users:PATCH] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Eroare internă" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Doar Super Admin poate șterge utilizatori" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "Nu te poți șterge pe tine" }, { status: 400 });
  }

  // Soft delete (mark as inactive)
  await prisma.user.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ success: true });
}
