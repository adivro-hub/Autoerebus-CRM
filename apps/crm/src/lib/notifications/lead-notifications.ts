import { prisma } from "@autoerebus/database";
import { sendNotification } from "./send";

const BRAND_LABELS: Record<string, string> = {
  NISSAN: "Nissan",
  RENAULT: "Renault",
  AUTORULATE: "Autorulate",
  SERVICE: "Service",
};

const LEAD_TYPE_LABELS: Record<string, string> = {
  GENERAL: "General",
  TEST_DRIVE: "Test Drive",
  PRICE_OFFER: "Ofertă Preț",
  CAR_INQUIRY: "Cerere Info",
  PRICE_ALERT: "Alertă Preț",
  CALLBACK: "Callback",
};

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE_NISSAN: "Website Nissan",
  WEBSITE_RENAULT: "Website Renault",
  WEBSITE_AUTORULATE: "Website Autorulate",
  WEBSITE_SERVICE: "Website Service",
  PHONE: "Telefon",
  WALK_IN: "Walk-in",
  REFERRAL: "Recomandare",
  AUTOVIT: "Autovit",
  FACEBOOK: "Facebook",
  GOOGLE_ADS: "Google Ads",
  OTHER: "Altele",
};

interface NotifyManagersParams {
  leadId: string;
  brand: string;
  customerName: string;
  source?: string | null;
  type?: string | null;
  vehicleTitle?: string | null;
  notes?: string | null;
}

/**
 * Notify all managers of a given brand that a new lead arrived and needs assignment.
 */
export async function notifyManagersNewLead(params: NotifyManagersParams) {
  const { leadId, brand, customerName, source, type, vehicleTitle, notes } = params;

  try {
    const managers = await prisma.user.findMany({
      where: {
        role: { in: ["MANAGER", "ADMIN", "SUPER_ADMIN"] },
        active: true,
        OR: [
          { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
          { brands: { has: brand as never } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (managers.length === 0) return 0;

    const brandLabel = BRAND_LABELS[brand] || brand;
    const typeLabel = type ? LEAD_TYPE_LABELS[type] || type : null;
    const sourceLabel = source ? SOURCE_LABELS[source] || source : null;
    const link = `/sales?leadId=${leadId}`;

    const emailSubject = `Lead nou ${brandLabel} — necesită atribuire`;
    const emailBodyLines = [
      `Un lead nou a fost înregistrat pentru ${brandLabel} și așteaptă să fie atribuit unui agent.`,
      "",
      `Client: ${customerName}`,
    ];
    if (typeLabel) emailBodyLines.push(`Tip: ${typeLabel}`);
    if (sourceLabel) emailBodyLines.push(`Sursă: ${sourceLabel}`);
    if (vehicleTitle) emailBodyLines.push(`Vehicul: ${vehicleTitle}`);
    if (notes) emailBodyLines.push("", `Note: ${notes}`);
    emailBodyLines.push("", "Accesează lead-ul și atribuie-l unui agent:", link);
    const emailBody = emailBodyLines.join("\n");

    await Promise.all(
      managers.map((m) =>
        sendNotification({
          userId: m.id,
          type: "LEAD_NEW",
          channels: ["IN_APP", "EMAIL"],
          data: {
            customerName,
            brand: brandLabel,
            type: typeLabel || "",
            source: sourceLabel || "",
            vehicle: vehicleTitle || "",
          },
          link,
          metadata: { leadId, brand },
          fallback: {
            title: `Lead nou ${brandLabel}`,
            message: `${customerName} — atribuie unui agent`,
            emailSubject,
            emailBody,
          },
        }).catch((e) => console.error("[notifyManagersNewLead] error for", m.email, e))
      )
    );

    return managers.length;
  } catch (e) {
    console.error("[notifyManagersNewLead] error:", e);
    return 0;
  }
}

interface NotifyAgentAssignedParams {
  leadId: string;
  agentId: string;
  brand: string;
  customerName: string;
  type?: string | null;
  vehicleTitle?: string | null;
  assignedByName?: string;
}

/**
 * Notify the agent that they have been assigned a lead and they have 30 minutes to act.
 */
export async function notifyAgentLeadAssigned(params: NotifyAgentAssignedParams) {
  const { leadId, agentId, brand, customerName, type, vehicleTitle, assignedByName } = params;

  try {
    const brandLabel = BRAND_LABELS[brand] || brand;
    const typeLabel = type ? LEAD_TYPE_LABELS[type] || type : null;
    const link = `/sales?leadId=${leadId}`;

    const emailSubject = `Lead nou atribuit — ai 30 minute să răspunzi`;
    const emailBodyLines = [
      `Ți-a fost atribuit un lead nou${assignedByName ? ` de către ${assignedByName}` : ""}.`,
      "",
      `Client: ${customerName}`,
      `Brand: ${brandLabel}`,
    ];
    if (typeLabel) emailBodyLines.push(`Tip: ${typeLabel}`);
    if (vehicleTitle) emailBodyLines.push(`Vehicul: ${vehicleTitle}`);
    emailBodyLines.push(
      "",
      "⏱ IMPORTANT: Ai la dispoziție 30 de minute pentru a procesa acest lead.",
      "",
      "Accesează lead-ul:",
      link
    );
    const emailBody = emailBodyLines.join("\n");

    await sendNotification({
      userId: agentId,
      type: "LEAD_ASSIGNED",
      channels: ["IN_APP", "EMAIL"],
      data: {
        customerName,
        brand: brandLabel,
        type: typeLabel || "",
        vehicle: vehicleTitle || "",
        assignedBy: assignedByName || "",
      },
      link,
      metadata: { leadId, brand, slaMinutes: 30 },
      fallback: {
        title: `Lead nou: ${customerName}`,
        message: `Ai 30 minute să procesezi. Brand: ${brandLabel}`,
        emailSubject,
        emailBody,
      },
    });

    return true;
  } catch (e) {
    console.error("[notifyAgentLeadAssigned] error:", e);
    return false;
  }
}
