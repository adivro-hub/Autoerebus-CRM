"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { CustomerOverlay } from "@/components/customer-overlay";
import { Card, CardContent } from "@autoerebus/ui/components/card";
import { Badge } from "@autoerebus/ui/components/badge";
import { Button } from "@autoerebus/ui/components/button";
import {
  Plus,
  Calendar,
  Clock,
  User,
  Car,
  X,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Phone,
  Mail,
  AlertCircle,
  Bell,
  Loader2,
} from "lucide-react";

interface TestDrive {
  id: string;
  customerId: string;
  scheduledAt: string;
  duration: number;
  status: string;
  brand: string;
  notes: string | null;
  feedback: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  customer: { firstName: string; lastName: string; phone: string | null; email: string | null };
  vehicle: { id: string; make: { name: string }; model: { name: string }; year: number } | null;
  agent: { firstName: string; lastName: string } | null;
}

interface Vehicle {
  id: string;
  title: string | null;
  year: number;
  brand: string;
  make: { name: string };
  model: { name: string };
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
}

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  SCHEDULED: { label: "Programat", color: "border-blue-300 bg-blue-50 text-blue-700" },
  CONFIRMED: { label: "Confirmat", color: "bg-green-100 text-green-800" },
  IN_PROGRESS: { label: "In Desfasurare", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "Finalizat", color: "bg-gray-100 text-gray-700" },
  CANCELLED: { label: "Anulat", color: "bg-red-100 text-red-700" },
  NO_SHOW: { label: "Neprezentare", color: "bg-red-100 text-red-700" },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: ["SCHEDULED"],
  NO_SHOW: ["SCHEDULED"],
};

const DAYS_RO = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sam", "Dum"];
const MONTHS_RO = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

export default function TestDrivesClient({
  initialTestDrives,
}: {
  initialTestDrives: TestDrive[];
}) {
  const [testDrives, setTestDrives] = useState<TestDrive[]>(initialTestDrives);
  const [showForm, setShowForm] = useState(false);
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeFeedback, setCompleteFeedback] = useState("");
  const [completingLoading, setCompletingLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Helper: local date string (YYYY-MM-DD) to avoid UTC timezone shift
  const toLocalDateStr = (d: Date | string) => {
    const date = typeof d === "string" ? new Date(d) : d;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  // Calendar state
  const today = new Date();
  const todayStr = toLocalDateStr(today);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  // Form state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [formData, setFormData] = useState({
    vehicleId: "",
    customerId: "",
    scheduledAt: "",
    duration: 30,
    agentId: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Reschedule state
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  // New customer inline form
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });

  // ─── Derived data ───────────────────────────────────────

  const unconfirmed = useMemo(
    () => testDrives.filter((td) => td.status === "SCHEDULED"),
    [testDrives]
  );

  // Count test drives per day for calendar
  const countsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    testDrives.forEach((td) => {
      if (td.status === "CANCELLED" || td.status === "NO_SHOW") return;
      const key = toLocalDateStr(td.scheduledAt);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [testDrives]);

  // Test drives for selected day
  const selectedDayDrives = useMemo(() => {
    if (!selectedDate) return [];
    return testDrives
      .filter((td) => {
        const tdDate = toLocalDateStr(td.scheduledAt);
        return tdDate === selectedDate;
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [testDrives, selectedDate]);

  // ─── Calendar grid ──────────────────────────────────────

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0

    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(calYear, calMonth, -i);
      days.push({
        date: toLocalDateStr(d),
        day: d.getDate(),
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(calYear, calMonth, d);
      days.push({
        date: toLocalDateStr(date),
        day: d,
        isCurrentMonth: true,
      });
    }

    // Next month padding
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const date = new Date(calYear, calMonth + 1, d);
        days.push({
          date: toLocalDateStr(date),
          day: d,
          isCurrentMonth: false,
        });
      }
    }

    return days;
  }, [calMonth, calYear]);

  // ─── Form handlers ─────────────────────────────────────

  useEffect(() => {
    if (!showForm) return;
    fetch("/api/test-drives?type=vehicles")
      .then((r) => r.json())
      .then(setVehicles)
      .catch(() => {});
    fetch("/api/test-drives?type=agents")
      .then((r) => r.json())
      .then(setAgents)
      .catch(() => {});
  }, [showForm]);

  const searchCustomers = useCallback((search: string) => {
    fetch(`/api/test-drives?type=customers&search=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then(setCustomers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showForm) return;
    const timer = setTimeout(() => searchCustomers(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch, showForm, searchCustomers]);

  async function handleCreateCustomer() {
    if (!newCustomer.firstName || !newCustomer.lastName) return;
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomer),
      });
      if (!res.ok) throw new Error("Eroare la crearea clientului");
      const customer = await res.json();
      setCustomers((prev) => [customer, ...prev]);
      setFormData((prev) => ({ ...prev, customerId: customer.id }));
      setShowNewCustomer(false);
      setNewCustomer({ firstName: "", lastName: "", phone: "", email: "" });
    } catch {
      setError("Eroare la crearea clientului");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.vehicleId || !formData.customerId || !formData.scheduledAt) {
      setError("Selectati vehiculul, clientul si data");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/test-drives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Eroare la programare");
      }
      const created = await res.json();
      setTestDrives((prev) => [{ ...created, scheduledAt: created.scheduledAt }, ...prev]);
      setShowForm(false);
      setFormData({ vehicleId: "", customerId: "", scheduledAt: "", duration: 30, agentId: "", notes: "" });
      setSuccess("Test drive programat cu succes!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Eroare la programare");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const res = await fetch(`/api/test-drives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Eroare la actualizare");
      setTestDrives((prev) =>
        prev.map((td) => (td.id === id ? { ...td, status: newStatus } : td))
      );
      setStatusMenuId(null);
    } catch {
      setError("Eroare la actualizarea statusului");
    }
  }

  async function handleCompleteTestDrive() {
    if (!completingId || !completeFeedback.trim()) return;
    setCompletingLoading(true);
    try {
      const res = await fetch(`/api/test-drives/${completingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED", feedback: completeFeedback.trim() }),
      });
      if (!res.ok) throw new Error("Eroare");
      setTestDrives((prev) =>
        prev.map((td) => (td.id === completingId ? { ...td, status: "COMPLETED", feedback: completeFeedback.trim() } : td))
      );
      setCompletingId(null);
      setCompleteFeedback("");
      setStatusMenuId(null);
    } catch {
      setError("Eroare la confirmarea test drive-ului");
    } finally {
      setCompletingLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Sigur doriti sa stergeti acest test drive?")) return;
    try {
      const res = await fetch(`/api/test-drives/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Eroare la stergere");
      setTestDrives((prev) => prev.filter((td) => td.id !== id));
    } catch {
      setError("Eroare la stergere");
    }
  }

  function openReschedule(td: TestDrive) {
    const d = new Date(td.scheduledAt);
    setRescheduleId(td.id);
    setRescheduleDate(toLocalDateStr(d));
    setRescheduleTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  }

  async function handleReschedule() {
    if (!rescheduleId || !rescheduleDate || !rescheduleTime) return;
    setRescheduleSaving(true);
    try {
      const res = await fetch(`/api/test-drives/${rescheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: `${rescheduleDate}T${rescheduleTime}:00` }),
      });
      if (!res.ok) throw new Error("Eroare la reprogramare");
      const updated = await res.json();
      setTestDrives((prev) =>
        prev.map((td) =>
          td.id === rescheduleId
            ? { ...td, scheduledAt: updated.scheduledAt || `${rescheduleDate}T${rescheduleTime}:00` }
            : td
        )
      );
      setRescheduleId(null);
      setSuccess("Test drive reprogramat cu succes!");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Eroare la reprogramarea test drive-ului");
    } finally {
      setRescheduleSaving(false);
    }
  }

  const selectedCustomer = customers.find((c) => c.id === formData.customerId);

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Success Toast */}
      {success && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 rounded-lg bg-green-600 px-4 py-3 text-sm text-white shadow-lg">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            {success}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-base font-bold tracking-tight">Test Drive</h1>
          <p className="text-sm text-gray-500">{testDrives.length} programari totale</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Programeaza Test Drive
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
          <button onClick={() => setError("")} className="ml-auto">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ═══ SECTION 1: Unconfirmed ═══ */}
      {unconfirmed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-5 w-5 text-orange-500" />
            <h2 className="text-base font-semibold">Necesita confirmare</h2>
            <Badge className="bg-orange-100 text-orange-700">{unconfirmed.length}</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unconfirmed.map((td) => (
              <Card key={td.id} className="border-orange-200 bg-orange-50/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Calendar className="h-4 w-4 text-orange-500" />
                      {new Date(td.scheduledAt).toLocaleDateString("ro-RO", {
                        day: "numeric",
                        month: "short",
                      })}
                      <Clock className="h-3.5 w-3.5 text-gray-500 ml-1" />
                      {new Date(td.scheduledAt).toLocaleTimeString("ro-RO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <span className="text-sm text-gray-500">{td.duration} min</span>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-gray-500" />
                      <button onClick={() => setSelectedCustomerId(td.customerId)} className="text-sm font-medium text-blue-600 hover:underline">
                        {td.contactName || `${td.customer.firstName} ${td.customer.lastName}`}
                      </button>
                      {td.contactName && td.contactName !== `${td.customer.firstName} ${td.customer.lastName}` && (
                        <span className="text-sm text-gray-500">(cont: {td.customer.firstName} {td.customer.lastName})</span>
                      )}
                    </div>
                    {(td.contactPhone || td.customer.phone) && (
                      <a href={`tel:${td.contactPhone || td.customer.phone}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline ml-5">
                        <Phone className="h-3 w-3" />
                        {td.contactPhone || td.customer.phone}
                      </a>
                    )}
                    {(td.contactEmail || td.customer.email) && (
                      <a href={`mailto:${td.customer.email}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline ml-5">
                        <Mail className="h-3 w-3" />
                        {td.customer.email}
                      </a>
                    )}
                    {td.vehicle && (
                      <Link href={`/inventory/${td.vehicle.id}/edit`} className="flex items-center gap-2 text-blue-600 hover:underline">
                        <Car className="h-3.5 w-3.5" />
                        <span className="text-sm">
                          {td.vehicle.make.name} {td.vehicle.model.name} ({td.vehicle.year})
                        </span>
                      </Link>
                    )}
                  </div>

                  {td.notes && (
                    <p className="mt-2 text-sm text-gray-500 italic border-t pt-2">
                      {td.notes}
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleStatusChange(td.id, "CONFIRMED")}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Confirma
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleStatusChange(td.id, "CANCELLED")}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Anuleaza
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SECTION 2: Calendar ═══ */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Calendar Grid */}
        <Card>
          <CardContent className="p-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (calMonth === 0) {
                    setCalMonth(11);
                    setCalYear((y) => y - 1);
                  } else {
                    setCalMonth((m) => m - 1);
                  }
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-sm font-semibold">
                {MONTHS_RO[calMonth]} {calYear}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (calMonth === 11) {
                    setCalMonth(0);
                    setCalYear((y) => y + 1);
                  } else {
                    setCalMonth((m) => m + 1);
                  }
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_RO.map((d) => (
                <div key={d} className="text-center text-sm font-medium text-gray-500 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map(({ date, day, isCurrentMonth }) => {
                const count = countsByDate[date] || 0;
                const isToday = date === todayStr;
                const isSelected = date === selectedDate;

                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date === selectedDate ? null : date)}
                    className={`
                      relative flex flex-col items-center justify-center py-2 text-sm rounded-md transition-colors
                      ${!isCurrentMonth ? "text-gray-500/40" : ""}
                      ${isToday && !isSelected ? "bg-blue-50 font-bold text-blue-700" : ""}
                      ${isSelected ? "bg-blue-600 text-white" : "hover:bg-accent"}
                    `}
                  >
                    <span>{day}</span>
                    {count > 0 && (
                      <span
                        className={`
                          mt-0.5 text-sm font-bold leading-none rounded-full px-1.5 py-0.5
                          ${isSelected ? "bg-white/30 text-white" : "bg-blue-100 text-blue-700"}
                        `}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Day Detail */}
        <Card>
          <CardContent className="p-4">
            {selectedDate ? (
              <>
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {selectedDate === todayStr
                    ? "Azi"
                    : new Date(selectedDate + "T12:00:00").toLocaleDateString("ro-RO", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                  <Badge variant="secondary">{selectedDayDrives.length} programari</Badge>
                </h3>

                {selectedDayDrives.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                    <Calendar className="h-8 w-8 mb-2" />
                    <p className="text-sm">Nicio programare in aceasta zi</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                    {selectedDayDrives.map((td) => {
                      const statusInfo = STATUS_CONFIG[td.status] ?? {
                        label: td.status,
                        color: "",
                      };
                      const transitions = STATUS_TRANSITIONS[td.status] ?? [];

                      return (
                        <div
                          key={td.id}
                          className="rounded-lg border p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-bold">
                                {new Date(td.scheduledAt).toLocaleTimeString("ro-RO", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span className="text-sm text-gray-500">
                                ({td.duration} min)
                              </span>
                              {td.status !== "COMPLETED" && td.status !== "CANCELLED" && td.status !== "NO_SHOW" && (
                                <button
                                  onClick={() => openReschedule(td)}
                                  className="ml-1 rounded-md p-1 text-gray-500 hover:bg-muted hover:text-foreground transition-colors"
                                  title="Reprogramează"
                                >
                                  <Calendar className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Status dropdown */}
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setStatusMenuId(statusMenuId === td.id ? null : td.id)
                                }
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${statusInfo.color}`}
                              >
                                {statusInfo.label}
                                {transitions.length > 0 && <ChevronDown className="h-3 w-3" />}
                              </button>

                              {statusMenuId === td.id && transitions.length > 0 && (
                                <div className="absolute right-0 top-full mt-1 z-10 w-40 rounded-md border bg-white py-1 shadow-lg">
                                  {transitions.map((status) => {
                                    const s = STATUS_CONFIG[status];
                                    return (
                                      <button
                                        key={status}
                                        onClick={() => handleStatusChange(td.id, status)}
                                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
                                      >
                                        <span
                                          className={`inline-block h-2 w-2 rounded-full ${
                                            status === "CANCELLED" || status === "NO_SHOW"
                                              ? "bg-red-500"
                                              : status === "COMPLETED"
                                              ? "bg-gray-500"
                                              : status === "CONFIRMED"
                                              ? "bg-green-500"
                                              : status === "IN_PROGRESS"
                                              ? "bg-yellow-500"
                                              : "bg-blue-500"
                                          }`}
                                        />
                                        {s?.label ?? status}
                                      </button>
                                    );
                                  })}
                                  <div className="border-t my-1" />
                                  <button
                                    onClick={() => handleDelete(td.id)}
                                    className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                                  >
                                    Sterge
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-gray-500" />
                                <button onClick={() => setSelectedCustomerId(td.customerId)} className="text-sm font-medium text-blue-600 hover:underline">
                                  {td.contactName || `${td.customer.firstName} ${td.customer.lastName}`}
                                </button>
                                {td.contactName && td.contactName !== `${td.customer.firstName} ${td.customer.lastName}` && (
                                  <span className="text-sm text-gray-500">(cont: {td.customer.firstName} {td.customer.lastName})</span>
                                )}
                              </div>
                              {(td.contactPhone || td.customer.phone) && (
                                <a href={`tel:${td.contactPhone || td.customer.phone}`} className="ml-5 text-sm text-blue-600 hover:underline">
                                  {td.contactPhone || td.customer.phone}
                                </a>
                              )}
                              {(td.contactEmail || td.customer.email) && (
                                <div className="ml-5 text-sm text-gray-500 truncate">
                                  {td.contactEmail || td.customer.email}
                                </div>
                              )}
                            </div>
                            <div>
                              {td.vehicle && (
                                <Link href={`/inventory/${td.vehicle.id}/edit`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                                  <Car className="h-3.5 w-3.5" />
                                  <span className="text-sm">
                                    {td.vehicle.make.name} {td.vehicle.model.name} ({td.vehicle.year})
                                  </span>
                                </Link>
                              )}
                              {td.agent && (
                                <div className="ml-5 text-sm text-gray-500">
                                  Agent: {td.agent.firstName} {td.agent.lastName}
                                </div>
                              )}
                            </div>
                          </div>

                          {(td.status === "CONFIRMED" || td.status === "IN_PROGRESS") && (
                            <div className="border-t pt-2 space-y-2">
                              {completingId === td.id ? (
                                <>
                                  <textarea
                                    value={completeFeedback}
                                    onChange={(e) => setCompleteFeedback(e.target.value)}
                                    placeholder="Observații obligatorii (cum a decurs, impresii client, interes de cumpărare...)"
                                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => { setCompletingId(null); setCompleteFeedback(""); }}
                                      className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted transition-colors"
                                    >
                                      Anulează
                                    </button>
                                    <button
                                      onClick={handleCompleteTestDrive}
                                      disabled={!completeFeedback.trim() || completingLoading}
                                      className="flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                      {completingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                      Confirmă
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <button
                                  onClick={() => { setCompletingId(td.id); setCompleteFeedback(""); }}
                                  className="w-full flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-sm font-medium transition-colors"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Confirmă efectuarea test drive-ului
                                </button>
                              )}
                            </div>
                          )}

                          {td.feedback && (
                            <div className="border-t pt-1.5 text-sm">
                              <span className="font-medium text-gray-500">Feedback:</span>{" "}
                              <span>{td.feedback}</span>
                            </div>
                          )}

                          {td.notes && (
                            <p className="text-sm text-gray-500 italic border-t pt-1.5">
                              {td.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Calendar className="h-10 w-10 mb-3" />
                <p className="font-medium">Selectati o zi din calendar</p>
                <p className="text-sm">pentru a vedea programarile</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Schedule Form Modal ═══ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold">Programeaza Test Drive</h2>
              <button onClick={() => setShowForm(false)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Vehicle */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Vehicul <span className="text-red-500">*</span>
                </label>
                {vehicles.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    Niciun vehicul disponibil. Activati &quot;Disponibil pentru test drive&quot; pe vehicule din inventar.
                  </p>
                ) : (
                  <select
                    value={formData.vehicleId}
                    onChange={(e) => setFormData((f) => ({ ...f, vehicleId: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Selectati vehiculul</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.make.name} {v.model.name} ({v.year}){v.title ? ` - ${v.title}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Customer */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Client <span className="text-red-500">*</span>
                </label>
                {!showNewCustomer ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        placeholder="Cauta client..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
                      />
                    </div>
                    {selectedCustomer && (
                      <div className="mt-2 flex items-center justify-between rounded-md border bg-blue-50 px-3 py-2 text-sm">
                        <span className="font-medium">
                          {selectedCustomer.firstName} {selectedCustomer.lastName}
                          {selectedCustomer.phone && ` • ${selectedCustomer.phone}`}
                        </span>
                        <button type="button" onClick={() => setFormData((f) => ({ ...f, customerId: "" }))}>
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {!formData.customerId && customers.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto rounded-md border">
                        {customers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setFormData((f) => ({ ...f, customerId: c.id }))}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent text-left border-b last:border-0"
                          >
                            <User className="h-4 w-4 text-gray-500 shrink-0" />
                            <div>
                              <div className="font-medium">{c.firstName} {c.lastName}</div>
                              <div className="text-sm text-gray-500 flex gap-3">
                                {c.phone && <span><Phone className="h-3 w-3 inline mr-1" />{c.phone}</span>}
                                {c.email && <span><Mail className="h-3 w-3 inline mr-1" />{c.email}</span>}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={() => setShowNewCustomer(true)} className="mt-2 text-sm text-blue-600 hover:underline">
                      + Adauga client nou
                    </button>
                  </>
                ) : (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Prenume *" value={newCustomer.firstName} onChange={(e) => setNewCustomer((c) => ({ ...c, firstName: e.target.value }))} className="rounded-md border border-input px-3 py-2 text-sm" required />
                      <input placeholder="Nume *" value={newCustomer.lastName} onChange={(e) => setNewCustomer((c) => ({ ...c, lastName: e.target.value }))} className="rounded-md border border-input px-3 py-2 text-sm" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Telefon" value={newCustomer.phone} onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))} className="rounded-md border border-input px-3 py-2 text-sm" />
                      <input placeholder="Email" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))} className="rounded-md border border-input px-3 py-2 text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={handleCreateCustomer}>Salveaza Client</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewCustomer(false)}>Anuleaza</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Date & Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Data si ora <span className="text-red-500">*</span></label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData((f) => ({ ...f, scheduledAt: e.target.value }))}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Durata</label>
                  <select
                    value={formData.duration}
                    onChange={(e) => setFormData((f) => ({ ...f, duration: parseInt(e.target.value) }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 ora</option>
                    <option value={90}>1.5 ore</option>
                  </select>
                </div>
              </div>

              {/* Agent */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Agent</label>
                <select
                  value={formData.agentId}
                  onChange={(e) => setFormData((f) => ({ ...f, agentId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Fara agent</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Note</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Observatii..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Anuleaza</Button>
                <Button type="submit" disabled={saving}>{saving ? "Se programeaza..." : "Programeaza"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Click outside to close status menu */}
      {statusMenuId && (
        <div className="fixed inset-0 z-[5]" onClick={() => setStatusMenuId(null)} />
      )}

      {/* Customer History Overlay */}
      {selectedCustomerId && (
        <CustomerOverlay
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}

      {/* Reschedule Modal */}
      {rescheduleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold">Reprogramează Test Drive</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ora</label>
              <select
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selectați ora</option>
                {Array.from({ length: 17 }, (_, i) => {
                  const h = Math.floor(i / 2) + 9;
                  const m = i % 2 === 0 ? "00" : "30";
                  const t = `${String(h).padStart(2, "0")}:${m}`;
                  return <option key={t} value={t}>{t}</option>;
                })}
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setRescheduleId(null)}
                className="px-4 py-2 text-sm rounded-md border hover:bg-gray-50 transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={handleReschedule}
                disabled={!rescheduleDate || !rescheduleTime || rescheduleSaving}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {rescheduleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                Salvează
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
