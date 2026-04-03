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

    const existing = await prisma.testDrive.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

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

    // If test drive CONFIRMED, move lead/deal to "Test Drive Programat" and set lead to QUALIFIED
    if (body.status === "CONFIRMED" && existing.vehicleId) {
      const lead = await prisma.lead.findFirst({
        where: {
          customerId: existing.customerId,
          vehicleId: existing.vehicleId,
          status: { not: "LOST" },
        },
        include: { deals: true },
      });

      if (lead) {
        // Update lead status to QUALIFIED
        if (lead.status === "NEW") {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "QUALIFIED", assignedToId: body.agentId || lead.assignedToId },
          });
        }

        if (lead.deals.length > 0) {
          const programatStage = await prisma.pipelineStage.findFirst({
            where: {
              brand: existing.brand,
              pipelineType: "SALES",
              name: "Test Drive Programat",
            },
          });

          if (programatStage) {
            const deal = lead.deals[0];
            const oldStage = await prisma.pipelineStage.findUnique({
              where: { id: deal.stageId },
              select: { name: true },
            });

            await prisma.deal.update({
              where: { id: deal.id },
              data: { stageId: programatStage.id, assignedToId: body.agentId || deal.assignedToId },
            });

            await prisma.activity.create({
              data: {
                type: "STAGE_CHANGE",
                content: `Mutat din "${oldStage?.name || "?"}" în "Test Drive Programat" — Test drive confirmat de admin`,
                leadId: lead.id,
                dealId: deal.id,
                userId: session.user.id || null,
              },
            }).catch(() => {});
          }
        }
      }
    }

    // If test drive confirmed as COMPLETED, move lead/deal to "Test Drive Efectuat"
    if (body.status === "COMPLETED" && existing.vehicleId) {
      const lead = await prisma.lead.findFirst({
        where: {
          customerId: existing.customerId,
          vehicleId: existing.vehicleId,
          status: { not: "LOST" },
        },
        include: { deals: true },
      });

      if (lead && lead.deals.length > 0) {
        const efectuatStage = await prisma.pipelineStage.findFirst({
          where: {
            brand: existing.brand,
            pipelineType: "SALES",
            name: "Test Drive Efectuat",
          },
        });

        if (efectuatStage) {
          const deal = lead.deals[0];
          const oldStage = await prisma.pipelineStage.findUnique({
            where: { id: deal.stageId },
            select: { name: true },
          });

          await prisma.deal.update({
            where: { id: deal.id },
            data: { stageId: efectuatStage.id },
          });

          await prisma.activity.create({
            data: {
              type: "STAGE_CHANGE",
              content: `Mutat din "${oldStage?.name || "?"}" în "Test Drive Efectuat" — Test drive confirmat`,
              leadId: lead.id,
              dealId: deal.id,
              userId: session.user.id || null,
            },
          }).catch(() => {});
        }
      }

      // Log test drive completion on lead
      const leadForLog = await prisma.lead.findFirst({
        where: { customerId: existing.customerId, vehicleId: existing.vehicleId },
      });
      if (leadForLog) {
        await prisma.activity.create({
          data: {
            type: "TEST_DRIVE",
            content: `Test drive efectuat${body.feedback ? ` — Feedback: ${body.feedback}` : ""}`,
            leadId: leadForLog.id,
            userId: session.user.id || null,
          },
        }).catch(() => {});
      }
    }

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
