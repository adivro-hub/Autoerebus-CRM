/**
 * HTML email templates for CRM notifications.
 * Each template returns a self-contained HTML string suitable for Mailjet HTMLPart.
 *
 * Design: minimal, brand-neutral, optimized for Gmail/Outlook clients.
 */

const BRAND_COLORS: Record<string, string> = {
  NISSAN: "#C3002F",
  RENAULT: "#FFCC00",
  AUTORULATE: "#1F4E79",
  SERVICE: "#2E7D32",
};

const BRAND_LABELS: Record<string, string> = {
  NISSAN: "Nissan",
  RENAULT: "Renault",
  AUTORULATE: "Autorulate",
  SERVICE: "Service",
};

// Brand logo HTML — white on black header for client-facing emails
// Renault logo is inline SVG (diamond), Nissan is a white PNG hosted on their site
function brandLogoHtml(brand: string): string {
  if (brand === "RENAULT") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 66 86" width="42" height="55" fill="#ffffff" style="display:block;"><path d="m52.3 43-23 43H23L0 43 22.9 0h6.5L6.5 43l19.6 36.9L45.7 43 34.3 21.5l3.3-6.1zM42.5 0h-6.6L13.1 43l14.7 27.6 3.2-6.1L19.6 43 39.2 6l19.6 37-22.9 43h6.6l22.8-43z"/></svg>`;
  }
  if (brand === "NISSAN") {
    return `<img src="https://nissan-autoerebus.vercel.app/images/logo/nissan-logo-white.png" width="140" alt="Nissan" style="display:block;height:auto;">`;
  }
  // Autorulate/Service fallback — text logo
  return `<div style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.3px;">${BRAND_LABELS[brand] || "Autoerebus"}</div>`;
}

interface BaseLayoutOpts {
  preheader?: string;
  brand?: string;
  title: string;
  bodyHtml: string;
  ctaText?: string;
  ctaLink?: string;
  footerNote?: string;
}

function baseLayout(opts: BaseLayoutOpts): string {
  const {
    preheader = "",
    brand = "AUTORULATE",
    title,
    bodyHtml,
    ctaText,
    ctaLink,
    footerNote = "",
  } = opts;
  const brandColor = BRAND_COLORS[brand] || "#1F4E79";
  const brandLabel = BRAND_LABELS[brand] || "Autoerebus";

  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
  <span style="display:none;font-size:1px;color:#f4f5f7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:600px;width:100%;">

          <!-- Header strip with brand color -->
          <tr>
            <td style="height:6px;background-color:${brandColor};"></td>
          </tr>

          <!-- Logo/header area -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0;font-size:13px;color:#6b7280;letter-spacing:0.5px;text-transform:uppercase;font-weight:600;">Autoerebus ${brandLabel}</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">${title}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:16px 32px 24px;font-size:15px;line-height:1.6;color:#374151;">
              ${bodyHtml}
            </td>
          </tr>

          ${ctaText && ctaLink ? `
          <!-- CTA -->
          <tr>
            <td style="padding:8px 32px 32px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#111827;border-radius:6px;">
                    <a href="${ctaLink}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:6px;">${ctaText}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #e5e7eb;background-color:#f9fafb;font-size:12px;color:#6b7280;line-height:1.5;">
              ${footerNote ? `<p style="margin:0 0 8px;">${footerNote}</p>` : ""}
              <p style="margin:0;">
                Autoerebus Nord — Bld. Expoziției Nr. 2, Sector 1, București<br>
                Tel: <a href="tel:0215272335" style="color:#6b7280;text-decoration:none;">021 527 2335</a> ·
                <a href="mailto:contact@autoerebus.ro" style="color:#6b7280;text-decoration:none;">contact@autoerebus.ro</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Customer-facing layout (with logo + hero image) ───

interface CustomerLayoutOpts {
  preheader?: string;
  brand: string;
  title: string;
  subtitle?: string;
  heroImage?: string; // Vehicle image URL
  heroCaption?: string; // Vehicle title / caption
  bodyHtml: string;
  ctaText?: string;
  ctaLink?: string;
  footerNote?: string;
}

function customerLayout(opts: CustomerLayoutOpts): string {
  const {
    preheader = "",
    brand,
    title,
    subtitle,
    heroImage,
    heroCaption,
    bodyHtml,
    ctaText,
    ctaLink,
    footerNote,
  } = opts;
  const brandColor = BRAND_COLORS[brand] || "#1F4E79";
  const brandLabel = BRAND_LABELS[brand] || "Autoerebus";

  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
  <span style="display:none;font-size:1px;color:#f0f2f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);max-width:600px;width:100%;">

          <!-- Brand header bar: black bg, white logo, colored accent strip -->
          <tr>
            <td style="background-color:#000000;padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="50%" valign="middle">
                    ${brandLogoHtml(brand)}
                  </td>
                  <td width="50%" valign="middle" align="right">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;text-align:right;">
                      <div style="font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;opacity:0.7;font-weight:500;">Autoerebus Nord</div>
                      <div style="font-size:13px;color:#ffffff;opacity:0.9;margin-top:4px;font-weight:400;">București</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Brand accent strip (colored line under black header) -->
          <tr>
            <td style="height:4px;background-color:${brandColor};line-height:0;font-size:0;">&nbsp;</td>
          </tr>

          ${heroImage ? `
          <!-- Hero image -->
          <tr>
            <td style="padding:0;line-height:0;">
              <img src="${heroImage}" alt="${heroCaption || "Vehicul"}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
            </td>
          </tr>
          ${heroCaption ? `
          <tr>
            <td style="background-color:#111827;padding:14px 32px;">
              <p style="margin:0;color:#ffffff;font-size:15px;font-weight:600;">${heroCaption}</p>
            </td>
          </tr>
          ` : ""}
          ` : ""}

          <!-- Title + subtitle -->
          <tr>
            <td style="padding:${heroImage ? "32px" : "40px"} 32px 8px;">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#111827;line-height:1.3;">${title}</h1>
              ${subtitle ? `<p style="margin:8px 0 0;font-size:16px;color:#6b7280;line-height:1.5;">${subtitle}</p>` : ""}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:20px 32px 28px;font-size:15px;line-height:1.7;color:#374151;">
              ${bodyHtml}
            </td>
          </tr>

          ${ctaText && ctaLink ? `
          <!-- CTA (black button, consistent across brands) -->
          <tr>
            <td style="padding:0 32px 36px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#000000;border-radius:8px;">
                    <a href="${ctaLink}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;border-radius:8px;letter-spacing:0.3px;">${ctaText}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          <!-- Contact strip -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #e5e7eb;background-color:#f9fafb;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:13px;color:#6b7280;line-height:1.7;">
                    <strong style="color:#111827;">Autoerebus Nord</strong><br>
                    Bld. Expoziției Nr. 2, Sector 1, București<br>
                    Tel: <a href="tel:0215272335" style="color:#1f2937;text-decoration:none;font-weight:500;">021 527 2335</a> ·
                    <a href="mailto:contact@autoerebus.ro" style="color:#1f2937;text-decoration:none;font-weight:500;">contact@autoerebus.ro</a><br>
                    <span style="color:#9ca3af;font-size:12px;">L–V: 09:00–18:00 · S–D: 10:00–14:00</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${footerNote ? `
          <!-- Footer note -->
          <tr>
            <td style="padding:16px 32px;background-color:#111827;font-size:12px;color:#9ca3af;line-height:1.5;text-align:center;">
              ${footerNote}
            </td>
          </tr>
          ` : ""}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#6b7280;font-size:14px;width:35%;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${value}</td>
  </tr>`;
}

function infoTable(rows: { label: string; value: string }[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0;background-color:#f9fafb;border-radius:6px;padding:12px 16px;">
    ${rows.map((r) => infoRow(r.label, r.value)).join("")}
  </table>`;
}

// ─── Lead notifications ─────────────────────────────────

export interface LeadNewToManagerData {
  customerName: string;
  brand: string;
  type?: string;
  source?: string;
  vehicle?: string;
  notes?: string;
  link: string;
}

export function leadNewToManagerHtml(d: LeadNewToManagerData): string {
  const rows = [
    { label: "Client", value: d.customerName },
    { label: "Brand", value: BRAND_LABELS[d.brand] || d.brand },
  ];
  if (d.type) rows.push({ label: "Tip", value: d.type });
  if (d.source) rows.push({ label: "Sursă", value: d.source });
  if (d.vehicle) rows.push({ label: "Vehicul", value: d.vehicle });

  return baseLayout({
    brand: d.brand,
    preheader: `Lead nou ${BRAND_LABELS[d.brand] || d.brand} — atribuie unui agent`,
    title: `Lead nou — necesită atribuire`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Un lead nou a fost înregistrat și așteaptă să fie atribuit unui agent.</p>
      ${infoTable(rows)}
      ${d.notes ? `<p style="margin:12px 0 0;color:#6b7280;font-size:14px;"><strong style="color:#374151;">Note:</strong><br>${d.notes.replace(/\n/g, "<br>")}</p>` : ""}
    `,
    ctaText: "Atribuie unui agent →",
    ctaLink: d.link,
    footerNote: "Acest email este trimis automat. Te rugăm să atribui lead-ul cât mai curând.",
  });
}

export interface LeadAssignedToAgentData {
  customerName: string;
  brand: string;
  type?: string;
  vehicle?: string;
  assignedBy?: string;
  link: string;
}

export function leadAssignedToAgentHtml(d: LeadAssignedToAgentData): string {
  const rows = [
    { label: "Client", value: d.customerName },
    { label: "Brand", value: BRAND_LABELS[d.brand] || d.brand },
  ];
  if (d.type) rows.push({ label: "Tip", value: d.type });
  if (d.vehicle) rows.push({ label: "Vehicul", value: d.vehicle });

  return baseLayout({
    brand: d.brand,
    preheader: `Ai 30 minute să răspunzi`,
    title: `Lead nou atribuit ție`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Ți-a fost atribuit un lead nou${d.assignedBy ? ` de către <strong>${d.assignedBy}</strong>` : ""}.</p>
      ${infoTable(rows)}
      <div style="margin:16px 0;padding:14px 16px;background-color:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;">
        <p style="margin:0;color:#92400e;font-size:14px;"><strong>⏱ Important:</strong> Ai la dispoziție <strong>30 de minute</strong> pentru a procesa acest lead.</p>
      </div>
    `,
    ctaText: "Deschide lead →",
    ctaLink: d.link,
  });
}

export interface LeadSlaAgentReminderData {
  customerName: string;
  brand: string;
  vehicle?: string;
  elapsedMin: number;
  link: string;
}

export function leadSlaAgentReminderHtml(d: LeadSlaAgentReminderData): string {
  const rows = [
    { label: "Client", value: d.customerName },
    { label: "Brand", value: BRAND_LABELS[d.brand] || d.brand },
    { label: "Timp scurs", value: `${d.elapsedMin} minute` },
  ];
  if (d.vehicle) rows.push({ label: "Vehicul", value: d.vehicle });

  return baseLayout({
    brand: d.brand,
    preheader: `⚠ Lead atribuit acum ${d.elapsedMin} min, încă neprocesat`,
    title: `⚠ Lead neprocesat`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Ți-a fost atribuit un lead acum <strong>${d.elapsedMin} de minute</strong> și încă nu ai luat nicio acțiune.</p>
      ${infoTable(rows)}
      <p style="margin:16px 0 0;color:#dc2626;font-weight:600;">Te rugăm să procesezi lead-ul urgent.</p>
    `,
    ctaText: "Procesează acum →",
    ctaLink: d.link,
  });
}

export interface LeadSlaManagerEscalationData {
  customerName: string;
  agentName: string;
  brand: string;
  elapsedMin: number;
  link: string;
}

export function leadSlaManagerEscalationHtml(d: LeadSlaManagerEscalationData): string {
  return baseLayout({
    brand: d.brand,
    preheader: `Agent ${d.agentName} — SLA depășit`,
    title: `⚠ SLA depășit`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Un lead atribuit nu a fost procesat în timp.</p>
      ${infoTable([
        { label: "Agent", value: d.agentName },
        { label: "Client", value: d.customerName },
        { label: "Brand", value: BRAND_LABELS[d.brand] || d.brand },
        { label: "Timp scurs", value: `${d.elapsedMin} minute` },
      ])}
      <p style="margin:12px 0 0;">Decide dacă reatribui agent-ul sau escaladezi situația.</p>
    `,
    ctaText: "Vezi lead și acționează →",
    ctaLink: d.link,
  });
}

// ─── Test Drive notifications ───────────────────────────

export interface TestDriveNewToManagerData {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicleTitle: string;
  brand: string;
  scheduledAt: string;
  link: string;
}

export function testDriveNewToManagerHtml(d: TestDriveNewToManagerData): string {
  const rows = [
    { label: "Client", value: d.customerName },
  ];
  if (d.customerPhone) rows.push({ label: "Telefon", value: d.customerPhone });
  if (d.customerEmail) rows.push({ label: "Email", value: d.customerEmail });
  rows.push({ label: "Vehicul", value: d.vehicleTitle });
  rows.push({ label: "Brand", value: BRAND_LABELS[d.brand] || d.brand });
  rows.push({ label: "Data și ora", value: d.scheduledAt });

  return baseLayout({
    brand: d.brand,
    preheader: `Test drive nou — ${d.vehicleTitle}`,
    title: `Test drive nou — necesită confirmare`,
    bodyHtml: `
      <p style="margin:0 0 12px;">O nouă programare de test drive a fost înregistrată și așteaptă confirmare.</p>
      ${infoTable(rows)}
    `,
    ctaText: "Confirmă programarea →",
    ctaLink: d.link,
  });
}

export interface TestDriveConfirmedToCustomerData {
  customerName: string;
  vehicleTitle: string;
  vehicleImage?: string;
  brand: string;
  scheduledAt: string;
}

export function testDriveConfirmedToCustomerHtml(d: TestDriveConfirmedToCustomerData): string {
  return customerLayout({
    brand: d.brand,
    preheader: `Programarea ta pentru ${d.vehicleTitle} este confirmată`,
    heroImage: d.vehicleImage,
    heroCaption: d.vehicleTitle,
    title: `Test drive confirmat ✓`,
    subtitle: `Salut ${d.customerName}, îți confirmăm programarea pentru test drive.`,
    bodyHtml: `
      ${infoTable([
        { label: "Vehicul", value: `<strong>${d.vehicleTitle}</strong>` },
        { label: "Data și ora", value: `<strong>${d.scheduledAt}</strong>` },
        { label: "Durată", value: "30 minute" },
        { label: "Locație", value: "Autoerebus Nord<br>Bld. Expoziției Nr. 2, București" },
      ])}
      <div style="margin:24px 0 0;padding:16px 20px;background-color:#ecfdf5;border-left:4px solid #10b981;border-radius:4px;">
        <p style="margin:0;color:#065f46;font-size:14px;line-height:1.5;"><strong>💡 Sfat:</strong> Adu cu tine permisul de conducere valabil. Te așteptăm cu o cafea caldă!</p>
      </div>
      <p style="margin:20px 0 0;color:#6b7280;font-size:14px;">Pentru orice modificare, ne poți suna la <a href="tel:0215272335" style="color:#111827;font-weight:500;">021 527 2335</a>.</p>
    `,
    footerNote: `Acest email a fost trimis automat de sistemul Autoerebus.`,
  });
}

export interface TestDriveReminderToCustomerData {
  customerName: string;
  vehicleTitle: string;
  vehicleImage?: string;
  brand: string;
  scheduledAt: string;
}

export function testDriveReminderToCustomerHtml(d: TestDriveReminderToCustomerData): string {
  return customerLayout({
    brand: d.brand,
    preheader: `Mâine ai test drive pentru ${d.vehicleTitle}`,
    heroImage: d.vehicleImage,
    heroCaption: d.vehicleTitle,
    title: `Pe mâine! 🚗`,
    subtitle: `Salut ${d.customerName}, îți reamintim programarea pentru test drive.`,
    bodyHtml: `
      ${infoTable([
        { label: "Vehicul", value: `<strong>${d.vehicleTitle}</strong>` },
        { label: "Data și ora", value: `<strong>${d.scheduledAt}</strong>` },
        { label: "Locație", value: "Autoerebus Nord<br>Bld. Expoziției Nr. 2, București" },
      ])}
      <p style="margin:20px 0 0;color:#6b7280;font-size:14px;">Dacă apar schimbări, sună-ne la <a href="tel:0215272335" style="color:#111827;font-weight:500;">021 527 2335</a>.</p>
    `,
    footerNote: `Acest email a fost trimis automat de sistemul Autoerebus.`,
  });
}

// ─── Cere Ofertă notifications ──────────────────────────

export interface PriceOfferRequestToManagerData {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicleTitle: string;
  vehiclePrice?: string;
  customerMessage?: string;
  brand: string;
  link: string;
}

export function priceOfferRequestToManagerHtml(d: PriceOfferRequestToManagerData): string {
  const rows = [
    { label: "Client", value: d.customerName },
  ];
  if (d.customerPhone) rows.push({ label: "Telefon", value: d.customerPhone });
  if (d.customerEmail) rows.push({ label: "Email", value: d.customerEmail });
  rows.push({ label: "Vehicul", value: d.vehicleTitle });
  if (d.vehiclePrice) rows.push({ label: "Preț afișat", value: d.vehiclePrice });

  return baseLayout({
    brand: d.brand,
    preheader: `Cerere ofertă — ${d.vehicleTitle}`,
    title: `Cerere de ofertă nouă`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Un client a cerut o ofertă personalizată pentru o mașină.</p>
      ${infoTable(rows)}
      ${d.customerMessage ? `<div style="margin:16px 0;padding:12px 16px;background-color:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;">
        <p style="margin:0 0 4px;color:#1e3a8a;font-size:13px;font-weight:600;">Mesaj client:</p>
        <p style="margin:0;color:#1e40af;font-size:14px;line-height:1.5;">${d.customerMessage.replace(/\n/g, "<br>")}</p>
      </div>` : ""}
    `,
    ctaText: "Atribuie unui agent →",
    ctaLink: d.link,
  });
}

export interface PriceOfferAssignedToAgentData {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicleTitle: string;
  vehiclePrice?: string;
  customerMessage?: string;
  brand: string;
  assignedBy?: string;
  link: string;
}

export function priceOfferAssignedToAgentHtml(d: PriceOfferAssignedToAgentData): string {
  const rows = [
    { label: "Client", value: d.customerName },
  ];
  if (d.customerPhone) rows.push({ label: "Telefon", value: d.customerPhone });
  if (d.customerEmail) rows.push({ label: "Email", value: d.customerEmail });
  rows.push({ label: "Vehicul", value: d.vehicleTitle });
  if (d.vehiclePrice) rows.push({ label: "Preț afișat", value: d.vehiclePrice });

  return baseLayout({
    brand: d.brand,
    preheader: `Cerere ofertă atribuită ție — ai 30 min`,
    title: `Cerere ofertă atribuită ție`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Ți-a fost atribuită o cerere de ofertă${d.assignedBy ? ` de către <strong>${d.assignedBy}</strong>` : ""}.</p>
      ${infoTable(rows)}
      ${d.customerMessage ? `<div style="margin:16px 0;padding:12px 16px;background-color:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;">
        <p style="margin:0 0 4px;color:#1e3a8a;font-size:13px;font-weight:600;">Mesaj client:</p>
        <p style="margin:0;color:#1e40af;font-size:14px;line-height:1.5;">${d.customerMessage.replace(/\n/g, "<br>")}</p>
      </div>` : ""}
      <div style="margin:16px 0;padding:14px 16px;background-color:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;">
        <p style="margin:0;color:#92400e;font-size:14px;"><strong>⏱ Important:</strong> Ai <strong>30 minute</strong> pentru primul contact.</p>
      </div>
    `,
    ctaText: "Pregătește oferta →",
    ctaLink: d.link,
  });
}

export interface PriceOfferToCustomerData {
  customerName: string;
  vehicleTitle: string;
  vehicleImage?: string;
  brand: string;
  originalPrice?: string;
  offerPrice: string;
  savings?: string;
  validUntil: string;
  monthlyPayment?: string;
  equipmentList?: string[];
  agentName: string;
  agentEmail: string;
}

export function priceOfferToCustomerHtml(d: PriceOfferToCustomerData): string {
  return customerLayout({
    brand: d.brand,
    preheader: `Oferta ta personalizată pentru ${d.vehicleTitle}`,
    heroImage: d.vehicleImage,
    heroCaption: d.vehicleTitle,
    title: `Oferta ta personalizată`,
    subtitle: `Salut ${d.customerName}, mulțumim pentru interesul acordat. Iată oferta noastră pentru tine.`,
    bodyHtml: `
      <!-- Price hero card (black with colored accent) -->
      <div style="margin:0 0 24px;padding:28px 24px;background:#000000;border-radius:10px;text-align:center;border-top:4px solid ${BRAND_COLORS[d.brand] || "#1F4E79"};">
        ${d.originalPrice ? `<p style="margin:0 0 6px;color:rgba(255,255,255,0.5);font-size:14px;text-decoration:line-through;">Preț listă: ${d.originalPrice}</p>` : ""}
        <p style="margin:0;color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;letter-spacing:2px;font-weight:500;">Preț special pentru tine</p>
        <p style="margin:10px 0 0;color:#ffffff;font-size:44px;font-weight:900;letter-spacing:-1px;line-height:1;">${d.offerPrice}</p>
        ${d.savings ? `<p style="margin:14px 0 0;"><span style="display:inline-block;background-color:${BRAND_COLORS[d.brand] || "#1F4E79"};color:${d.brand === "RENAULT" ? "#000" : "#fff"};padding:6px 16px;border-radius:20px;font-size:13px;font-weight:700;">💰 Economisești ${d.savings}</span></p>` : ""}
      </div>

      <!-- Details -->
      ${infoTable([
        { label: "Valabilitate ofertă", value: `<strong>${d.validUntil}</strong>` },
        ...(d.monthlyPayment ? [{ label: "Finanțare", value: `de la <strong>${d.monthlyPayment}/lună</strong>` }] : []),
      ])}

      ${d.equipmentList && d.equipmentList.length > 0 ? `
      <div style="margin:24px 0 0;padding:20px;background-color:#f9fafb;border-radius:8px;">
        <p style="margin:0 0 12px;color:#111827;font-weight:600;font-size:15px;">✓ Echipamente și opțiuni incluse</p>
        <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;">
          ${d.equipmentList.map((e) => `<li>${e}</li>`).join("")}
        </ul>
      </div>
      ` : ""}

      <!-- Agent contact -->
      <div style="margin:24px 0 0;padding:20px;background-color:#ffffff;border:2px solid #e5e7eb;border-radius:8px;">
        <p style="margin:0 0 12px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Consilierul tău de vânzări</p>
        <p style="margin:0 0 4px;color:#111827;font-size:18px;font-weight:700;">${d.agentName}</p>
        <p style="margin:0 0 12px;color:#6b7280;font-size:14px;">Autoerebus ${BRAND_LABELS[d.brand] || d.brand}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right:16px;">
              <a href="tel:0215272335" style="display:inline-block;color:#111827;text-decoration:none;font-size:14px;font-weight:500;">📞 021 527 2335</a>
            </td>
            <td>
              <a href="mailto:${d.agentEmail}" style="display:inline-block;color:#111827;text-decoration:none;font-size:14px;font-weight:500;">✉ ${d.agentEmail}</a>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:24px 0 0;font-size:14px;color:#6b7280;text-align:center;font-style:italic;">Ne bucurăm să te ajutăm să-ți găsești mașina potrivită.</p>
    `,
    ctaText: "Contactează consilierul",
    ctaLink: `mailto:${d.agentEmail}?subject=Ofertă ${d.vehicleTitle}`,
    footerNote: `Ofertă valabilă până la ${d.validUntil}. Prețul este în EUR, TVA inclus. Nu constituie ofertă fermă.`,
  });
}
