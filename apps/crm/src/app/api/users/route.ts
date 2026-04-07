import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import bcrypt from "bcryptjs";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get("detailed") === "1";

  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: detailed
        ? {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            brands: true,
            active: true,
            lastLoginAt: true,
            createdAt: true,
          }
        : { id: true, firstName: true, lastName: true, role: true },
      orderBy: { firstName: "asc" },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    return NextResponse.json({ error: "Doar adminii pot crea utilizatori" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, password, firstName, lastName, phone, role: newRole, brands, permissions } = body;

    if (!email || !password || !firstName || !lastName || !newRole) {
      return NextResponse.json(
        { error: "Email, parolă, nume, prenume și rol sunt obligatorii" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Parola trebuie să aibă minim 8 caractere" }, { status: 400 });
    }

    // Check uniqueness
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "Există deja un utilizator cu acest email" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        phone: phone || null,
        role: newRole,
        brands: Array.isArray(brands) ? brands : [],
        permissions: Array.isArray(permissions) ? permissions : [],
      },
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
        createdAt: true,
      },
    });

    await prisma.auditLog
      .create({
        data: {
          action: "USER_CREATED",
          entity: "User",
          entityId: user.id,
          userId: session.user.id,
          details: { email: user.email, role: user.role, brands: user.brands },
        },
      })
      .catch(() => {});

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    console.error("[Users:POST] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Eroare internă" },
      { status: 500 }
    );
  }
}
