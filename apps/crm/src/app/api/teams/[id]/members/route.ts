import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/teams/[id]/members
 * Add a user to a team.
 * Body: { userId: string, role?: "MEMBER" | "SUPERVISOR" }
 */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Doar Super Admin" }, { status: 403 });
  }

  const { id: teamId } = await params;
  const body = await request.json();
  const { userId, role: memberRole = "MEMBER" } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId obligatoriu" }, { status: 400 });
  }

  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });

  if (existing) {
    return NextResponse.json({ error: "Utilizatorul este deja membru" }, { status: 400 });
  }

  const member = await prisma.teamMember.create({
    data: { userId, teamId, role: memberRole },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  return NextResponse.json({ success: true, member });
}
