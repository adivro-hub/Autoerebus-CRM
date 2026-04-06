import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

type Params = { params: Promise<{ id: string; userId: string }> };

/**
 * PATCH /api/teams/[id]/members/[userId]
 * Update member role
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentRole = (session.user as any).role;
  if (currentRole !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Doar Super Admin" }, { status: 403 });
  }

  const { id: teamId, userId } = await params;
  const body = await request.json();
  const { role } = body;

  if (!role || !["MEMBER", "SUPERVISOR"].includes(role)) {
    return NextResponse.json({ error: "Rol invalid" }, { status: 400 });
  }

  const updated = await prisma.teamMember.update({
    where: { userId_teamId: { userId, teamId } },
    data: { role },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  return NextResponse.json({ success: true, member: updated });
}

/**
 * DELETE /api/teams/[id]/members/[userId]
 * Remove user from team
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentRole = (session.user as any).role;
  if (currentRole !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Doar Super Admin" }, { status: 403 });
  }

  const { id: teamId, userId } = await params;

  await prisma.teamMember.delete({
    where: { userId_teamId: { userId, teamId } },
  });

  return NextResponse.json({ success: true });
}
