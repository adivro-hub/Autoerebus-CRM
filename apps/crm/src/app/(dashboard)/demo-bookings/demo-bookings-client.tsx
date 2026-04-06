"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui";
import { Button } from "@autoerebus/ui";
import { Badge } from "@autoerebus/ui";
import { Input } from "@autoerebus/ui";
import { CarFront, Plus, Calendar, Check, X, Clock, AlertCircle } from "lucide-react";
import { useBrand } from "@/components/brand-switcher";
import BookingFormModal from "./booking-form-modal";

interface Vehicle {
  id: string;
  title: string | null;
  brand: string;
  year: number | null;
  price: number | null;
  make?: { name: string };
  model?: { name: string };
  images?: { url: string }[];
  demoBookings?: BookingLite[];
  testDrives?: { id: string; scheduledAt: string; status: string }[];
}

interface BookingLite {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  user?: { firstName: string; lastName: string } | null;
  customer?: { firstName: string; lastName: string } | null;
}

interface Booking {
  id: string;
  vehicleId: string;
  brand: string;
  recipientType: string;
  status: string;
  startDate: string;
  endDate: string;
  purpose: string;
  notes: string | null;
  rejectedReason: string | null;
  cancelledReason: string | null;
  vehicle: {
    id: string;
    title: string | null;
    make?: { name: string };
    model?: { name: string };
    year: number | null;
    images?: { url: string }[];
  };
  user?: { id: string; firstName: string; lastName: string; email?: string; phone?: string } | null;
  customer?: { id: string; firstName: string; lastName: string; email?: string; phone?: string } | null;
  createdBy: { id: string; firstName: string; lastName: string };
  approvedBy?: { firstName: string; lastName: string } | null;
  team: { brand: string; name: string };
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Props {
  currentUserId: string;
  isSuperAdmin: boolean;
  isSupervisor: boolean;
  userBrands: string[];
  teamMembers: TeamMember[];
}

type Tab = "available" | "mine" | "created" | "approvals" | "team";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "În așteptare", color: "bg-amber-100 text-amber-800 border-amber-300" },
  APPROVED: { label: "Aprobat", color: "bg-green-100 text-green-800 border-green-300" },
  REJECTED: { label: "Respins", color: "bg-red-100 text-red-800 border-red-300" },
  COMPLETED: { label: "Finalizat", color: "bg-gray-100 text-gray-700 border-gray-300" },
  CANCELLED: { label: "Anulat", color: "bg-gray-100 text-gray-500 border-gray-300" },
  CONFLICTED: { label: "Conflict Test Drive", color: "bg-orange-100 text-orange-800 border-orange-300" },
};

function formatDate(d: string | Date) {
  return new Date(d).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DemoBookingsClient({
  currentUserId,
  isSuperAdmin,
  isSupervisor,
  userBrands,
  teamMembers,
}: Props) {
  const { selectedBrand } = useBrand();
  const [tab, setTab] = useState<Tab>("available");
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [preselectedVehicle, setPreselectedVehicle] = useState<Vehicle | null>(null);

  async function loadVehicles() {
    setLoading(true);
    try {
      const res = await fetch("/api/demo-bookings/available-vehicles");
      const data = await res.json();
      setVehicles(data.vehicles || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadBookings(filter: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/demo-bookings?filter=${filter}`);
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "available") loadVehicles();
    else if (tab === "mine") loadBookings("mine");
    else if (tab === "created") loadBookings("created-by-me");
    else if (tab === "approvals") loadBookings("pending-approval");
    else if (tab === "team") loadBookings("team");
  }, [tab]);

  const filteredVehicles = useMemo(() => {
    let list = vehicles;
    if (selectedBrand !== "ALL") {
      list = list.filter((v) => v.brand === selectedBrand);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) =>
        [v.title, v.make?.name, v.model?.name, v.brand].some((s) => s?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [vehicles, selectedBrand, search]);

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (selectedBrand !== "ALL") {
      list = list.filter((b) => b.brand === selectedBrand);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) => {
        const title = b.vehicle?.title?.toLowerCase() || "";
        const userName = b.user ? `${b.user.firstName} ${b.user.lastName}`.toLowerCase() : "";
        const customerName = b.customer
          ? `${b.customer.firstName} ${b.customer.lastName}`.toLowerCase()
          : "";
        const purpose = b.purpose?.toLowerCase() || "";
        return [title, userName, customerName, purpose].some((s) => s.includes(q));
      });
    }
    return list;
  }, [bookings, selectedBrand, search]);

  async function handleApprove(bookingId: string) {
    if (!confirm("Aprobi această rezervare?")) return;
    const res = await fetch(`/api/demo-bookings/${bookingId}/approve`, { method: "POST" });
    if (res.ok) {
      await loadBookings(tab === "approvals" ? "pending-approval" : "team");
    } else {
      const data = await res.json();
      alert("Eroare: " + (data.error || "necunoscută"));
    }
  }

  async function handleReject(bookingId: string) {
    const reason = prompt("Motivul respingerii:");
    if (!reason?.trim()) return;
    const res = await fetch(`/api/demo-bookings/${bookingId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      await loadBookings(tab === "approvals" ? "pending-approval" : "team");
    } else {
      const data = await res.json();
      alert("Eroare: " + (data.error || "necunoscută"));
    }
  }

  async function handleCancel(bookingId: string) {
    const reason = prompt("Motiv anulare (opțional):") || undefined;
    const res = await fetch(`/api/demo-bookings/${bookingId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      const filter = tab === "mine" ? "mine" : tab === "created" ? "created-by-me" : "team";
      await loadBookings(filter);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mașini Demo</h1>
          <p className="text-sm text-muted-foreground">Rezervă mașini pentru clienți sau uz intern</p>
        </div>
        <Button onClick={() => { setPreselectedVehicle(null); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Rezervare nouă
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {[
          { id: "available", label: "Disponibile", icon: CarFront },
          { id: "mine", label: "Rezervările mele", icon: Calendar },
          { id: "created", label: "Create de mine", icon: Plus },
          ...(isSupervisor ? [{ id: "approvals", label: "Așteaptă aprobare", icon: Clock }] : []),
          { id: "team", label: "Toate", icon: CarFront },
        ].map((t) => {
          const Icon = t.icon as any;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm transition ${
                active
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <Input
        placeholder="Caută..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {loading && <p className="text-sm text-muted-foreground">Se încarcă...</p>}

      {!loading && tab === "available" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((v) => {
            const hasActiveBooking = (v.demoBookings || []).some((b) =>
              ["PENDING", "APPROVED"].includes(b.status)
            );
            const nextTestDrive = v.testDrives?.[0];
            return (
              <Card key={v.id} className="overflow-hidden">
                {v.images?.[0] && (
                  <img src={v.images[0].url} alt={v.title || ""} className="h-40 w-full object-cover" />
                )}
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{v.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.make?.name} {v.model?.name} · {v.year}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-gray-900 text-gray-900">
                      {v.brand}
                    </Badge>
                  </div>

                  {hasActiveBooking && (
                    <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Rezervat
                      </div>
                      {v.demoBookings
                        ?.filter((b) => ["PENDING", "APPROVED"].includes(b.status))
                        .slice(0, 2)
                        .map((b) => (
                          <div key={b.id} className="mt-1 text-[10px]">
                            {formatDate(b.startDate)} — {formatDate(b.endDate)}
                            {b.user && ` · ${b.user.firstName} ${b.user.lastName}`}
                            {b.customer && ` · ${b.customer.firstName} ${b.customer.lastName}`}
                          </div>
                        ))}
                    </div>
                  )}

                  {nextTestDrive && (
                    <div className="rounded-md bg-blue-50 p-2 text-xs text-blue-900">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Test drive: {formatDate(nextTestDrive.scheduledAt)}
                      </div>
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setPreselectedVehicle(v);
                      setShowForm(true);
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Rezervă
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {filteredVehicles.length === 0 && (
            <p className="text-sm text-muted-foreground">Nicio mașină disponibilă.</p>
          )}
        </div>
      )}

      {!loading && tab !== "available" && (
        <div className="space-y-3">
          {filteredBookings.map((b) => {
            const statusInfo = STATUS_LABELS[b.status] || STATUS_LABELS.PENDING;
            const recipient = b.user
              ? `${b.user.firstName} ${b.user.lastName} (angajat)`
              : b.customer
                ? `${b.customer.firstName} ${b.customer.lastName} (client)`
                : "—";
            const canApprove = b.status === "PENDING" && (isSupervisor || isSuperAdmin);
            const canCancel = ["PENDING", "APPROVED"].includes(b.status);
            return (
              <Card key={b.id}>
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-4">
                    {b.vehicle.images?.[0] && (
                      <img
                        src={b.vehicle.images[0].url}
                        alt=""
                        className="h-16 w-24 rounded object-cover"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{b.vehicle.title}</p>
                        <Badge variant="outline" className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                        <Badge variant="outline" className="border-gray-900 text-gray-900">
                          {b.brand}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(b.startDate)} → {formatDate(b.endDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pentru: {recipient} · Scop: {b.purpose}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Creat de: {b.createdBy.firstName} {b.createdBy.lastName}
                        {b.approvedBy && ` · Aprobat de: ${b.approvedBy.firstName} ${b.approvedBy.lastName}`}
                      </p>
                      {b.rejectedReason && (
                        <p className="text-xs text-red-600">Motiv respingere: {b.rejectedReason}</p>
                      )}
                      {b.cancelledReason && (
                        <p className="text-xs text-gray-500">Motiv anulare: {b.cancelledReason}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canApprove && (
                      <>
                        <Button size="sm" onClick={() => handleApprove(b.id)}>
                          <Check className="mr-1 h-3 w-3" /> Aprobă
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReject(b.id)}>
                          <X className="mr-1 h-3 w-3" /> Respinge
                        </Button>
                      </>
                    )}
                    {canCancel && !canApprove && (
                      <Button size="sm" variant="outline" onClick={() => handleCancel(b.id)}>
                        Anulează
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredBookings.length === 0 && (
            <p className="text-sm text-muted-foreground">Nicio rezervare.</p>
          )}
        </div>
      )}

      {showForm && (
        <BookingFormModal
          currentUserId={currentUserId}
          teamMembers={teamMembers}
          userBrands={userBrands}
          preselectedVehicle={preselectedVehicle}
          onClose={() => {
            setShowForm(false);
            setPreselectedVehicle(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setPreselectedVehicle(null);
            if (tab === "available") loadVehicles();
            else loadBookings(tab === "mine" ? "mine" : tab === "created" ? "created-by-me" : "team");
          }}
        />
      )}
    </div>
  );
}
