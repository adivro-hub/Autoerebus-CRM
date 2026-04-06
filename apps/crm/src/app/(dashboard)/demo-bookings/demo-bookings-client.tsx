"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui";
import { Button } from "@autoerebus/ui";
import { Badge } from "@autoerebus/ui";
import { Input } from "@autoerebus/ui";
import { CarFront, Plus, Calendar, Check, X, Clock, AlertCircle, Edit2, AlertTriangle } from "lucide-react";
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
  conflictingTestDriveId: string | null;
  conflictingTestDrive?: {
    id: string;
    scheduledAt: string;
    duration: number;
    status: string;
    contactName: string | null;
    customer?: { firstName: string; lastName: string; phone: string | null } | null;
  } | null;
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
          <h1 className="text-base font-semibold text-gray-900">Mașini Demo</h1>
          <p className="text-sm text-gray-500">Rezervă mașini pentru clienți sau uz intern</p>
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
                  : "border-transparent text-gray-500 hover:text-gray-900"
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

      {loading && <p className="text-sm text-gray-500">Se încarcă...</p>}

      {!loading && tab === "available" && (
        <div className="space-y-2">
          {filteredVehicles.map((v) => {
            const activeBookings = (v.demoBookings || []).filter((b) =>
              ["PENDING", "APPROVED"].includes(b.status)
            );
            const nextTestDrive = v.testDrives?.[0];
            return (
              <div
                key={v.id}
                onClick={() => {
                  setPreselectedVehicle(v);
                  setShowForm(true);
                }}
                className="flex cursor-pointer items-center gap-4 rounded-md border bg-white p-3 transition hover:border-primary hover:shadow-sm"
              >
                {v.images?.[0] ? (
                  <img
                    src={v.images[0].url}
                    alt={v.title || ""}
                    className="h-14 w-20 flex-shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-20 flex-shrink-0 items-center justify-center rounded bg-gray-100">
                    <CarFront className="h-6 w-6 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base font-medium text-gray-900">{v.title}</p>
                    <Badge variant="outline" className="border-gray-900 text-gray-900">
                      {v.brand}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span>
                      {v.make?.name} {v.model?.name} · {v.year}
                    </span>
                    {activeBookings.length > 0 && (
                      <span className="flex items-center gap-1 text-gray-500">
                        <AlertCircle className="h-3 w-3" />
                        Rezervat: {formatDate(activeBookings[0].startDate)}—{formatDate(activeBookings[0].endDate)}
                        {activeBookings.length > 1 && ` (+${activeBookings.length - 1})`}
                      </span>
                    )}
                    {nextTestDrive && (
                      <span className="flex items-center gap-1 text-gray-500">
                        <Calendar className="h-3 w-3" /> TD: {formatDate(nextTestDrive.scheduledAt)}
                      </span>
                    )}
                  </div>
                </div>
                <Plus className="h-4 w-4 flex-shrink-0 text-gray-500" />
              </div>
            );
          })}
          {filteredVehicles.length === 0 && (
            <p className="text-sm text-gray-500">Nicio mașină disponibilă.</p>
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
            const canCancel = ["PENDING", "APPROVED", "CONFLICTED"].includes(b.status);
            const canEdit = ["PENDING", "APPROVED", "CONFLICTED"].includes(b.status);
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
                        <p className="text-base font-medium text-gray-900">{b.vehicle.title}</p>
                        <Badge variant="outline" className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                        <Badge variant="outline" className="border-gray-900 text-gray-900">
                          {b.brand}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDate(b.startDate)} → {formatDate(b.endDate)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Pentru: {recipient} · Scop: {b.purpose}
                      </p>
                      <p className="text-sm text-gray-500">
                        Creat de: {b.createdBy.firstName} {b.createdBy.lastName}
                        {b.approvedBy && ` · Aprobat de: ${b.approvedBy.firstName} ${b.approvedBy.lastName}`}
                      </p>
                      {b.rejectedReason && (
                        <p className="text-sm text-gray-900">Motiv respingere: {b.rejectedReason}</p>
                      )}
                      {b.cancelledReason && (
                        <p className="text-sm text-gray-500">Motiv anulare: {b.cancelledReason}</p>
                      )}
                      {b.status === "CONFLICTED" && b.conflictingTestDrive && (
                        <div className="mt-2 flex items-start gap-2 rounded-md border border-orange-300 bg-orange-50 p-2 text-sm text-gray-900">
                          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <div>
                            <p className="font-medium">Conflict cu test drive</p>
                            <p>
                              Test drive programat pe {formatDate(b.conflictingTestDrive.scheduledAt)} (
                              {b.conflictingTestDrive.duration || 30} min)
                            </p>
                            <p>
                              Client:{" "}
                              {b.conflictingTestDrive.customer
                                ? `${b.conflictingTestDrive.customer.firstName} ${b.conflictingTestDrive.customer.lastName}`
                                : b.conflictingTestDrive.contactName || "—"}
                              {b.conflictingTestDrive.customer?.phone &&
                                ` · ${b.conflictingTestDrive.customer.phone}`}
                            </p>
                          </div>
                        </div>
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
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPreselectedVehicle({
                            id: b.vehicle.id,
                            title: b.vehicle.title,
                            brand: b.brand,
                            year: b.vehicle.year,
                            price: null,
                            make: b.vehicle.make,
                            model: b.vehicle.model,
                            images: b.vehicle.images,
                          } as any);
                          setShowForm(true);
                        }}
                      >
                        <Edit2 className="mr-1 h-3 w-3" /> Editează
                      </Button>
                    )}
                    {canCancel && (
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
            <p className="text-sm text-gray-500">Nicio rezervare.</p>
          )}
        </div>
      )}

      {showForm && (
        <BookingFormModal
          currentUserId={currentUserId}
          isSuperAdmin={isSuperAdmin}
          isSupervisor={isSupervisor}
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
