export const dynamic = "force-dynamic";

import { prisma } from "@autoerebus/database";
import { Badge } from "@autoerebus/ui/components/badge";
import { formatDate } from "@autoerebus/ui/lib/utils";
import { Building2, Phone, Mail, User } from "lucide-react";

export const metadata = { title: "Intalniri Showroom" };

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: "Programat", cls: "bg-blue-100 text-blue-700" },
  CONFIRMED: { label: "Confirmat", cls: "bg-green-100 text-green-700" },
  IN_PROGRESS: { label: "În Desfășurare", cls: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "Finalizat", cls: "bg-gray-100 text-gray-700" },
  CANCELLED: { label: "Anulat", cls: "bg-red-100 text-red-700" },
  NO_SHOW: { label: "Nu s-a prezentat", cls: "bg-red-100 text-red-700" },
};

interface PageProps {
  searchParams: Promise<{ brand?: string; status?: string }>;
}

export default async function ShowroomPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const where: Record<string, unknown> = {};
  if (params.brand && params.brand !== "ALL") where.brand = params.brand;
  if (params.status) where.status = params.status;

  let appointments: Array<{
    id: string;
    scheduledAt: Date;
    duration: number;
    status: string;
    brand: string;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    notes: string | null;
    customer: { firstName: string; lastName: string; phone: string | null; email: string | null };
    agent: { firstName: string; lastName: string } | null;
  }> = [];

  try {
    appointments = (await prisma.showroomAppointment.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
        agent: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 100,
    })) as unknown as typeof appointments;
  } catch {
    // DB unavailable
  }

  // Group by status
  const upcoming = appointments.filter(
    (a) => new Date(a.scheduledAt) >= new Date() && ["SCHEDULED", "CONFIRMED"].includes(a.status)
  );
  const past = appointments.filter(
    (a) => new Date(a.scheduledAt) < new Date() || !["SCHEDULED", "CONFIRMED"].includes(a.status)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-base font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Întâlniri Showroom
          </h1>
          <p className="text-sm text-gray-500">{appointments.length} întâlniri în total</p>
        </div>
      </div>

      {/* Upcoming */}
      <section>
        <h2 className="text-sm font-semibold mb-2">Viitoare ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
            Nicio întâlnire programată
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcoming.map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2 text-gray-500">Istoric ({past.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {past.map((a) => (
              <AppointmentCard key={a.id} appointment={a} muted />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AppointmentCard({
  appointment,
  muted = false,
}: {
  appointment: {
    id: string;
    scheduledAt: Date;
    duration: number;
    status: string;
    brand: string;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    notes: string | null;
    customer: { firstName: string; lastName: string; phone: string | null; email: string | null };
    agent: { firstName: string; lastName: string } | null;
  };
  muted?: boolean;
}) {
  const status = STATUS_LABELS[appointment.status] || {
    label: appointment.status,
    cls: "bg-gray-100 text-gray-700",
  };
  const dt = new Date(appointment.scheduledAt);

  return (
    <div className={`rounded-lg border bg-white p-4 ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500">
            {formatDate(dt)}
          </p>
          <p className="text-lg font-semibold">
            {dt.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>
          {status.label}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <User className="h-3.5 w-3.5 text-gray-400" />
          {appointment.customer.firstName} {appointment.customer.lastName}
        </p>
        {appointment.contactPhone && (
          <p className="flex items-center gap-1.5 text-gray-600">
            <Phone className="h-3.5 w-3.5 text-gray-400" />
            {appointment.contactPhone}
          </p>
        )}
        {appointment.contactEmail && (
          <p className="flex items-center gap-1.5 text-gray-600">
            <Mail className="h-3.5 w-3.5 text-gray-400" />
            {appointment.contactEmail}
          </p>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>
          <Badge variant="outline">{appointment.brand}</Badge>
        </span>
        {appointment.agent && (
          <span>
            Agent: {appointment.agent.firstName} {appointment.agent.lastName}
          </span>
        )}
      </div>
      {appointment.notes && (
        <p className="mt-2 text-xs text-gray-500 italic">{appointment.notes}</p>
      )}
    </div>
  );
}
