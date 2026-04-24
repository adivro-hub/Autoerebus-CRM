import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui/components/card";
import { Badge } from "@autoerebus/ui/components/badge";
import { Mail, Bell, Smartphone, Clock, User, Shield, Users, Car, FileText } from "lucide-react";
import {
  leadNewToManagerHtml,
  leadAssignedToAgentHtml,
  leadSlaAgentReminderHtml,
  leadSlaManagerEscalationHtml,
  testDriveNewToManagerHtml,
  testDriveConfirmedToCustomerHtml,
  testDriveReminderToCustomerHtml,
  priceOfferRequestToManagerHtml,
  priceOfferAssignedToAgentHtml,
  priceOfferToCustomerHtml,
} from "@/lib/notifications/email-templates";

export const metadata = { title: "Preview Notificări" };

type Channel = "IN_APP" | "EMAIL" | "SMS";
type Recipient = "agent" | "manager" | "supervisor" | "user" | "customer";

interface Notification {
  id: number;
  category: string;
  trigger: string;
  recipient: Recipient;
  channels: Channel[];
  title: string;
  message: string;
  emailSubject?: string;
  emailHtml?: string;
  smsBody?: string;
  status: "live" | "new";
}

interface Sample {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicle: string;
  vehicleImage: string;
  vehiclePrice: string;
  brand: string;
  brandLabel: string;
  agentName: string;
  agentEmail: string;
  link: string;
  scheduledAt: string;
}

function buildSample(brand: string): Sample {
  const isNissan = brand === "NISSAN";
  return {
    customerName: "Ion Popescu",
    customerPhone: "0722 123 456",
    customerEmail: "ion.popescu@gmail.com",
    vehicle: isNissan
      ? "Nissan Qashqai 1.3 DIG-T MHEV Xtronic N-Connecta (2024)"
      : "Renault Austral 160 MHEV Techno (2024)",
    vehicleImage: "https://res.cloudinary.com/dbxygobsc/image/upload/v1774517355/autoerebus/cars/ubebqspo3kyh2jmtjdy0.jpg",
    vehiclePrice: isNissan ? "34.900 €" : "31.500 €",
    brand,
    brandLabel: isNissan ? "Nissan" : "Renault",
    agentName: "Maria Ionescu",
    agentEmail: "maria.ionescu@autoerebus.ro",
    link: "https://crm.autoerebus.ro/sales?leadId=abc123",
    scheduledAt: "Joi, 25 Aprilie 2026, ora 14:00",
  };
}

function buildNotifications(s: Sample): Notification[] {
  return [
    // ─── LEADS ──────────────────────────────────────────
    {
      id: 1,
      category: "Lead",
      trigger: "Lead nou intră în sistem (de pe site sau creat de manager fără agent)",
      recipient: "manager",
      channels: ["IN_APP", "EMAIL"],
      title: `Lead nou ${s.brandLabel}`,
      message: `${s.customerName} — atribuie unui agent`,
      emailSubject: `Lead nou ${s.brandLabel} — necesită atribuire`,
      emailHtml: leadNewToManagerHtml({
        customerName: s.customerName,
        brand: s.brand,
        type: "Cerere Info",
        source: `Website ${s.brandLabel}`,
        vehicle: s.vehicle,
        notes: "Doresc să fac un test drive. Sunt interesat și de variantele cu cutie automată.",
        link: s.link,
      }),
      status: "live",
    },
    {
      id: 2,
      category: "Lead",
      trigger: "Manager atribuie lead unui agent (sau agent își creează propriul lead)",
      recipient: "agent",
      channels: ["IN_APP", "EMAIL"],
      title: `Lead nou: ${s.customerName}`,
      message: `Ai 30 minute să procesezi. Brand: ${s.brandLabel}`,
      emailSubject: "Lead nou atribuit — ai 30 minute să răspunzi",
      emailHtml: leadAssignedToAgentHtml({
        customerName: s.customerName,
        brand: s.brand,
        type: "Cerere Info",
        vehicle: s.vehicle,
        assignedBy: "Andrei Popescu (Manager)",
        link: s.link,
      }),
      status: "live",
    },
    {
      id: 3,
      category: "Lead",
      trigger: "Agentul nu a acționat 30+ minute după atribuire (cron la 10 min)",
      recipient: "agent",
      channels: ["IN_APP", "EMAIL"],
      title: `⚠ Lead neprocesat: ${s.customerName}`,
      message: "Sunt 32 min de când ți-a fost atribuit acest lead și încă nu a fost procesat.",
      emailSubject: `⚠ Reminder: Lead neprocesat de 32 min — ${s.customerName}`,
      emailHtml: leadSlaAgentReminderHtml({
        customerName: s.customerName,
        brand: s.brand,
        vehicle: s.vehicle,
        elapsedMin: 32,
        link: s.link,
      }),
      status: "live",
    },
    {
      id: 4,
      category: "Lead",
      trigger: "SLA 30 min depășit — notificare escalație managerilor",
      recipient: "manager",
      channels: ["IN_APP", "EMAIL"],
      title: `⚠ SLA depășit: ${s.customerName}`,
      message: `Agentul ${s.agentName} nu a procesat lead-ul de 32 min.`,
      emailSubject: `⚠ SLA depășit — Lead ${s.customerName} (${s.brandLabel})`,
      emailHtml: leadSlaManagerEscalationHtml({
        customerName: s.customerName,
        agentName: s.agentName,
        brand: s.brand,
        elapsedMin: 32,
        link: s.link,
      }),
      status: "live",
    },

    // ─── TEST DRIVE ─────────────────────────────────────
    {
      id: 5,
      category: "Test Drive",
      trigger: "Client programează test drive de pe site (status SCHEDULED)",
      recipient: "manager",
      channels: ["IN_APP", "EMAIL"],
      title: `Test drive nou: ${s.customerName}`,
      message: `${s.vehicle} — ${s.scheduledAt}. Necesită confirmare.`,
      emailSubject: `Test drive nou — ${s.brandLabel} — necesită confirmare`,
      emailHtml: testDriveNewToManagerHtml({
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        customerEmail: s.customerEmail,
        vehicleTitle: s.vehicle,
        brand: s.brand,
        scheduledAt: s.scheduledAt,
        link: s.link,
      }),
      status: "new",
    },
    {
      id: 6,
      category: "Test Drive",
      trigger: "Agent/manager confirmă test drive-ul",
      recipient: "customer",
      channels: ["EMAIL"],
      title: "Test drive confirmat",
      message: "Programarea ta a fost confirmată.",
      emailSubject: `Test drive confirmat — ${s.vehicle}`,
      emailHtml: testDriveConfirmedToCustomerHtml({
        customerName: s.customerName,
        vehicleTitle: s.vehicle,
        vehicleImage: s.vehicleImage,
        brand: s.brand,
        scheduledAt: s.scheduledAt,
      }),
      status: "new",
    },
    {
      id: 7,
      category: "Test Drive",
      trigger: "24h înainte de test drive — reminder automat către client",
      recipient: "customer",
      channels: ["EMAIL"],
      title: "Reminder test drive mâine",
      message: `Mâine la 14:00 ai test drive pentru ${s.vehicle.split(" ").slice(0, 3).join(" ")}.`,
      emailSubject: `Reminder: test drive mâine — ${s.vehicle}`,
      emailHtml: testDriveReminderToCustomerHtml({
        customerName: s.customerName,
        vehicleTitle: s.vehicle,
        vehicleImage: s.vehicleImage,
        brand: s.brand,
        scheduledAt: s.scheduledAt,
      }),
      status: "new",
    },
    {
      id: 8,
      category: "Test Drive",
      trigger: "Test drive marcat automat No-Show (cron, 1h după ora programată)",
      recipient: "agent",
      channels: ["IN_APP"],
      title: "Test drive marcat automat No Show",
      message: `Test drive-ul pentru ${s.customerName} (${s.vehicle}) a fost marcat automat ca No Show (peste 1h întârziere).`,
      status: "live",
    },

    // ─── CERE OFERTĂ ────────────────────────────────────
    {
      id: 9,
      category: "Cere Ofertă",
      trigger: "Client cere ofertă de pe site pentru o mașină",
      recipient: "manager",
      channels: ["IN_APP", "EMAIL"],
      title: `Cerere ofertă: ${s.customerName}`,
      message: `${s.vehicle} — atribuie unui agent pentru răspuns.`,
      emailSubject: `Cerere ofertă nouă — ${s.brandLabel}`,
      emailHtml: priceOfferRequestToManagerHtml({
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        customerEmail: s.customerEmail,
        vehicleTitle: s.vehicle,
        vehiclePrice: s.vehiclePrice,
        customerMessage: "Sunt interesat de această mașină. Aș dori o ofertă cu finanțare pe 4 ani și să știu ce echipamente sunt incluse.",
        brand: s.brand,
        link: s.link,
      }),
      status: "new",
    },
    {
      id: 10,
      category: "Cere Ofertă",
      trigger: "Agent primește cererea de ofertă (după atribuire)",
      recipient: "agent",
      channels: ["IN_APP", "EMAIL"],
      title: `Cerere ofertă: ${s.customerName}`,
      message: `Pregătește oferta pentru ${s.vehicle.split(" ").slice(0, 3).join(" ")}. 30 minute SLA.`,
      emailSubject: `Cerere ofertă atribuită — ${s.vehicle}`,
      emailHtml: priceOfferAssignedToAgentHtml({
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        customerEmail: s.customerEmail,
        vehicleTitle: s.vehicle,
        vehiclePrice: s.vehiclePrice,
        customerMessage: "Sunt interesat de această mașină. Aș dori o ofertă cu finanțare pe 4 ani și să știu ce echipamente sunt incluse.",
        brand: s.brand,
        assignedBy: "Andrei Popescu (Manager)",
        link: s.link,
      }),
      status: "new",
    },
    {
      id: 11,
      category: "Cere Ofertă",
      trigger: "Agent trimite oferta către client",
      recipient: "customer",
      channels: ["EMAIL"],
      title: `Oferta ta pentru ${s.vehicle.split(" ").slice(0, 3).join(" ")}`,
      message: "Oferta pregătită este atașată.",
      emailSubject: `Ofertă personalizată — ${s.vehicle}`,
      emailHtml: priceOfferToCustomerHtml({
        customerName: s.customerName,
        vehicleTitle: s.vehicle,
        vehicleImage: s.vehicleImage,
        brand: s.brand,
        originalPrice: s.vehiclePrice,
        offerPrice: s.brand === "NISSAN" ? "32.500 €" : "29.900 €",
        savings: s.brand === "NISSAN" ? "2.400 €" : "1.600 €",
        validUntil: "30 Aprilie 2026",
        monthlyPayment: s.brand === "NISSAN" ? "420 €" : "385 €",
        equipmentList: [
          "Cutie automată",
          "Climatronic dual-zone",
          "Sistem multimedia cu navigație",
          "Cameră marșarier + senzori parcare 360°",
          "Scaune încălzite (față)",
          "Asistență la parcare",
        ],
        agentName: s.agentName,
        agentEmail: s.agentEmail,
      }),
      status: "new",
    },
  ];
}

const CHANNEL_CONFIG: Record<Channel, { label: string; cls: string; icon: typeof Mail }> = {
  IN_APP: { label: "In-App", cls: "bg-purple-100 text-purple-700", icon: Bell },
  EMAIL: { label: "Email", cls: "bg-blue-100 text-blue-700", icon: Mail },
  SMS: { label: "SMS", cls: "bg-amber-100 text-amber-700", icon: Smartphone },
};

const RECIPIENT_CONFIG: Record<Recipient, { label: string; cls: string; icon: typeof User }> = {
  agent: { label: "Agent", cls: "bg-cyan-100 text-cyan-700", icon: User },
  manager: { label: "Manager", cls: "bg-orange-100 text-orange-700", icon: Shield },
  supervisor: { label: "Supervisor", cls: "bg-rose-100 text-rose-700", icon: Shield },
  user: { label: "Utilizator CRM", cls: "bg-gray-100 text-gray-700", icon: Users },
  customer: { label: "Client extern", cls: "bg-green-100 text-green-700", icon: User },
};

const CATEGORY_ICONS: Record<string, typeof Mail> = {
  Lead: FileText,
  "Test Drive": Car,
  "Cere Ofertă": Mail,
  "Demo Booking": Clock,
};

interface PageProps {
  searchParams: Promise<{ brand?: string }>;
}

export default async function NotificationsPreviewPage({ searchParams }: PageProps) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "MANAGER") {
    redirect("/sales");
  }

  const { brand: brandParam } = await searchParams;
  const selectedBrand = brandParam === "NISSAN" ? "NISSAN" : "RENAULT";

  const sample = buildSample(selectedBrand);
  const notifications = buildNotifications(sample);

  const categories = Array.from(new Set(notifications.map((n) => n.category)));
  const counts = {
    total: notifications.length,
    live: notifications.filter((n) => n.status === "live").length,
    new: notifications.filter((n) => n.status === "new").length,
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-base font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Preview Notificări
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {counts.live} active, {counts.new} de implementat. Aceleași notificări pentru Renault și Nissan — doar brandingul se schimbă.
          </p>
        </div>

        {/* Brand toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Brand preview:</span>
          <div className="inline-flex rounded-md border overflow-hidden">
            <Link
              href="/settings/notifications?brand=RENAULT"
              className={`px-4 py-2 text-sm font-medium ${selectedBrand === "RENAULT" ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              Renault
            </Link>
            <Link
              href="/settings/notifications?brand=NISSAN"
              className={`px-4 py-2 text-sm font-medium ${selectedBrand === "NISSAN" ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              Nissan
            </Link>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{counts.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold text-green-600">{counts.live}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">De implementat</p>
            <p className="text-2xl font-bold text-amber-600">{counts.new}</p>
          </CardContent>
        </Card>
      </div>

      {/* Categories */}
      {categories.map((category) => {
        const items = notifications.filter((n) => n.category === category);
        const Icon = CATEGORY_ICONS[category] || Bell;
        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Icon className="h-4 w-4" />
                {category}
                <Badge variant="secondary" className="ml-1">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((n) => {
                const recipientCfg = RECIPIENT_CONFIG[n.recipient];
                const RecipientIcon = recipientCfg.icon;

                return (
                  <div
                    key={n.id}
                    className={`rounded-lg border p-4 ${n.status === "new" ? "border-amber-300 bg-amber-50/30" : "border-gray-200"}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-mono text-gray-400">#{n.id}</span>
                          {n.status === "new" && (
                            <Badge className="bg-amber-500 text-white text-xs">NOU</Badge>
                          )}
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${recipientCfg.cls}`}>
                            <RecipientIcon className="h-3 w-3" />
                            {recipientCfg.label}
                          </span>
                          {n.channels.map((ch) => {
                            const cfg = CHANNEL_CONFIG[ch];
                            const ChIcon = cfg.icon;
                            return (
                              <span key={ch} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
                                <ChIcon className="h-3 w-3" />
                                {cfg.label}
                              </span>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-sm text-gray-600 italic">Când: {n.trigger}</p>
                      </div>
                    </div>

                    {/* In-app preview */}
                    <div className="mb-3 rounded-md bg-gray-50 border border-gray-200 p-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                        <Bell className="h-3 w-3" />
                        In-App notification
                      </div>
                      <p className="text-sm font-semibold">{n.title}</p>
                      <p className="text-sm text-gray-700 mt-0.5">{n.message}</p>
                    </div>

                    {/* Email preview — full HTML */}
                    {n.channels.includes("EMAIL") && n.emailHtml && (
                      <div className="rounded-lg border border-blue-200 overflow-hidden">
                        <div className="border-b border-blue-200 bg-blue-50 px-3 py-2 flex items-center gap-2">
                          <Mail className="h-4 w-4 text-blue-700" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-blue-900/70">From: marketing@autoerebus.ro · To: {n.recipient === "customer" ? sample.customerEmail : `${n.recipient}@autoerebus.ro`}</p>
                            <p className="text-sm text-blue-900 font-semibold truncate">{n.emailSubject}</p>
                          </div>
                        </div>
                        <iframe
                          srcDoc={n.emailHtml}
                          className="w-full"
                          style={{
                            height: n.recipient === "customer" ? "1200px" : "700px",
                            border: "none",
                            backgroundColor: "#f0f2f5",
                          }}
                          title={`Email preview ${n.id}`}
                          sandbox=""
                        />
                      </div>
                    )}

                    {n.channels.includes("SMS") && n.smsBody && (
                      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/50 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Smartphone className="h-3.5 w-3.5 text-amber-700" />
                          <span className="text-xs text-amber-900 font-medium">SMS</span>
                        </div>
                        <p className="text-sm text-gray-800">{n.smsBody}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
