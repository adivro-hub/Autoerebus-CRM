import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSuperAdmin = (session.user as any).role === "SUPER_ADMIN";
  const isAdmin = (session.user as any).role === "ADMIN";
  if (!isSuperAdmin && !isAdmin) {
    return NextResponse.json({ error: "Doar administratorii pot edita templates" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { subject, body: tplBody, enabled } = body;

  const updates: any = {};
  if (subject !== undefined) updates.subject = subject;
  if (tplBody !== undefined) updates.body = tplBody;
  if (enabled !== undefined) updates.enabled = enabled;

  const updated = await prisma.notificationTemplate.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json({ success: true, template: updated });
}
