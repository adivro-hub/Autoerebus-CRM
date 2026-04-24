import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@autoerebus/database";
import { sendNotification } from "@/lib/notifications/send";

/**
 * GET /api/cron/lead-sla-reminder
 * Vercel Cron — every 10 minutes.
 *
 * Finds leads assigned to agents >30 minutes ago where the agent has not
 * taken any action (no activity by the agent since the assignment) and
 * sends reminder to both agent and brand managers. Each lead only gets
 * one reminder (tracked by Lead.slaReminderSentAt).
 */

const SLA_MINUTES = 30;

const BRAND_LABELS: Record<string, string> = {
  NISSAN: "Nissan",
  RENAULT: "Renault",
  AUTORULATE: "Autorulate",
  SERVICE: "Service",
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const threshold = new Date(now.getTime() - SLA_MINUTES * 60 * 1000);
  const results = { checked: 0, reminded: 0, errors: [] as string[] };

  try {
    // Candidate leads: assigned, assignedAt older than threshold, not already reminded,
    // not in a terminal state
    const candidates = await prisma.lead.findMany({
      where: {
        assignedToId: { not: null },
        assignedAt: { lte: threshold, not: null },
        slaReminderSentAt: null,
        status: { notIn: ["WON", "LOST"] },
      },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        vehicle: {
          select: {
            make: { select: { name: true } },
            model: { select: { name: true } },
            year: true,
          },
        },
      },
    });

    results.checked = candidates.length;

    for (const lead of candidates) {
      try {
        if (!lead.assignedToId || !lead.assignedAt || !lead.assignedTo) continue;

        // Check if agent has logged any activity AFTER assignedAt
        const agentActivity = await prisma.activity.findFirst({
          where: {
            leadId: lead.id,
            userId: lead.assignedToId,
            createdAt: { gt: lead.assignedAt },
          },
          select: { id: true },
        });

        if (agentActivity) continue; // agent has acted — skip

        const customerName = `${lead.customer.firstName} ${lead.customer.lastName}`;
        const vehicleTitle = lead.vehicle
          ? `${lead.vehicle.make.name} ${lead.vehicle.model.name} (${lead.vehicle.year})`
          : null;
        const brandLabel = BRAND_LABELS[lead.brand] || lead.brand;
        const link = `/sales?leadId=${lead.id}`;
        const elapsedMin = Math.round((now.getTime() - lead.assignedAt.getTime()) / 60000);

        // Notify agent
        await sendNotification({
          userId: lead.assignedToId,
          type: "LEAD_ASSIGNED",
          channels: ["IN_APP", "EMAIL"],
          data: {
            customerName,
            brand: brandLabel,
            elapsedMin,
          },
          link,
          metadata: { leadId: lead.id, reminder: true },
          fallback: {
            title: `⚠ Lead neprocesat: ${customerName}`,
            message: `Sunt ${elapsedMin} min de când ți-a fost atribuit acest lead și încă nu a fost procesat. ${brandLabel}.`,
            emailSubject: `⚠ Reminder: Lead neprocesat de ${elapsedMin} min — ${customerName}`,
            emailBody: [
              `Ți-a fost atribuit un lead acum ${elapsedMin} de minute și încă nu ai luat nicio acțiune.`,
              "",
              `Client: ${customerName}`,
              `Brand: ${brandLabel}`,
              ...(vehicleTitle ? [`Vehicul: ${vehicleTitle}`] : []),
              "",
              "Te rugăm să procesezi lead-ul urgent:",
              link,
            ].join("\n"),
          },
        }).catch((e) => console.error("[SLA agent notif]", e));

        // Notify brand managers
        const managers = await prisma.user.findMany({
          where: {
            active: true,
            OR: [
              { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
              {
                role: "MANAGER",
                brands: { has: lead.brand as never },
              },
            ],
          },
          select: { id: true },
        });

        for (const m of managers) {
          await sendNotification({
            userId: m.id,
            type: "LEAD_ASSIGNED",
            channels: ["IN_APP", "EMAIL"],
            data: {
              customerName,
              agentName: `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`,
              brand: brandLabel,
              elapsedMin,
            },
            link,
            metadata: { leadId: lead.id, reminder: true, role: "manager" },
            fallback: {
              title: `⚠ SLA depășit: ${customerName}`,
              message: `Agentul ${lead.assignedTo.firstName} ${lead.assignedTo.lastName} nu a procesat lead-ul de ${elapsedMin} min. ${brandLabel}.`,
              emailSubject: `⚠ SLA depășit — Lead ${customerName} (${brandLabel})`,
              emailBody: [
                `Un lead atribuit nu a fost procesat în timp.`,
                "",
                `Agent: ${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`,
                `Client: ${customerName}`,
                `Brand: ${brandLabel}`,
                `Timp scurs: ${elapsedMin} minute`,
                "",
                "Accesează lead-ul pentru a reatribui sau escala:",
                link,
              ].join("\n"),
            },
          }).catch((e) => console.error("[SLA manager notif]", e));
        }

        // Mark as reminded to prevent repeats
        await prisma.lead.update({
          where: { id: lead.id },
          data: { slaReminderSentAt: now },
        });

        results.reminded++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.errors.push(`lead ${lead.id}: ${msg}`);
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("[cron lead-sla-reminder] error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
