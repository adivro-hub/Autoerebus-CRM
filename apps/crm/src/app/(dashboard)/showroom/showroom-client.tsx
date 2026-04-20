"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { CustomerOverlay } from "@/components/customer-overlay";
import { useToast } from "@/components/toast-provider";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@autoerebus/ui/components/card";
import { Badge } from "@autoerebus/ui/components/badge";
import { Button } from "@autoerebus/ui/components/button";
import {
  Calendar,
  User,
  X,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Bell,
  Loader2,
  Building2,
} from "lucide-react";

interface Appointment {
  id: string;
  customerId: string;
  leadId: string | null;
  scheduledAt: string;
  duration: number;
  status: string;
  brand: string;
  notes: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  customer: { firstName: string; lastName: string; phone: string | null; email: string | null };
  agent: { id: string; firstName: string; lastName: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Programat", color: "border-blue-300 bg-blue-50 text-blue-700" },
  CONFIRMED: { label: "Confirmat", color: "bg-green-100 text-green-800" },
  IN_PROGRESS: { label: "În Desfășurare", color: "bg-yellow-100 text-yellow-800" },
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

const DAYS_RO = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];
const MONTHS_RO = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

export default function ShowroomClient({
  initialAppointments,
}: {
  initialAppointments: Appointment[];
}) {
  const toast = useToast();
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || "AGENT";
  const userPermissions: string[] = ((session?.user as { permissions?: string[] })?.permissions as string[]) || [];
  const canApprove =
    userRole === "SUPER_ADMIN" ||
    userRole === "ADMIN" ||
    userRole === "MANAGER" ||
    (userRole === "AGENT" && userPermissions.includes("TEST_DRIVE_APPROVE"));

  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const toLocalDateStr = (d: Date | string) => {
    const date = typeof d === "string" ? new Date(d) : d;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const today = new Date();
  const todayStr = toLocalDateStr(today);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calView, setCalView] = useState<"month" | "week">("month");

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterAgent, setFilterAgent] = useState<string>("ALL");
  const [groupBy, setGroupBy] = useState<"none" | "brand" | "agent">("none");

  // Reschedule state
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  const agentsFromAppointments = useMemo(() => {
    const m = new Map<string, { id: string; firstName: string; lastName: string }>();
    appointments.forEach((a) => {
      if (a.agent?.id) m.set(a.agent.id, a.agent);
    });
    return Array.from(m.values());
  }, [appointments]);

  // Filtered appointments
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments.filter((a) => {
      if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
      if (filterAgent !== "ALL") {
        if (filterAgent === "none" && a.agent) return false;
        if (filterAgent !== "none" && a.agent?.id !== filterAgent) return false;
      }
      if (q) {
        const customerName = `${a.customer.firstName} ${a.customer.lastName}`.toLowerCase();
        const contactName = (a.contactName || "").toLowerCase();
        const phone = (a.contactPhone || a.customer.phone || "").toLowerCase();
        if (!customerName.includes(q) && !contactName.includes(q) && !phone.includes(q)) return false;
      }
      return true;
    });
  }, [appointments, search, filterStatus, filterAgent]);

  const unconfirmed = useMemo(
    () => filtered.filter((a) => a.status === "SCHEDULED"),
    [filtered]
  );

  const countsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((a) => {
      if (a.status === "CANCELLED" || a.status === "NO_SHOW") return;
      const key = toLocalDateStr(a.scheduledAt);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [filtered]);

  const selectedDayAppointments = useMemo(() => {
    if (!selectedDate) return [];
    return filtered
      .filter((a) => toLocalDateStr(a.scheduledAt) === selectedDate)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [filtered, selectedDate]);

  const weekDays = useMemo(() => {
    const base = selectedDate ? new Date(selectedDate + "T12:00:00") : new Date(todayStr + "T12:00:00");
    const dayOfWeek = base.getDay();
    const monOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(base);
    monday.setDate(base.getDate() + monOffset);
    const days: { date: string; items: Appointment[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = toLocalDateStr(d);
      const items = filtered
        .filter((a) => toLocalDateStr(a.scheduledAt) === dateStr)
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
      days.push({ date: dateStr, items });
    }
    return days;
  }, [selectedDate, filtered, todayStr]);

  const groupedDayAppointments = useMemo(() => {
    if (groupBy === "none") return { "": selectedDayAppointments };
    const groups: Record<string, Appointment[]> = {};
    for (const a of selectedDayAppointments) {
      const key =
        groupBy === "brand"
          ? a.brand || "—"
          : a.agent
            ? `${a.agent.firstName} ${a.agent.lastName}`
            : "Fără agent";
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return groups;
  }, [selectedDayAppointments, groupBy]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7;

    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];

    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(calYear, calMonth, -i);
      days.push({ date: toLocalDateStr(d), day: d.getDate(), isCurrentMonth: false });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(calYear, calMonth, d);
      days.push({ date: toLocalDateStr(date), day: d, isCurrentMonth: true });
    }

    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const date = new Date(calYear, calMonth + 1, d);
        days.push({ date: toLocalDateStr(date), day: d, isCurrentMonth: false });
      }
    }

    return days;
  }, [calMonth, calYear]);

  // ─── Actions ───────────────────────────────────────────

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/showroom-appointments");
      const data = await res.json();
      if (data.success) setAppointments(data.data);
    } catch {
      // ignore
    }
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    setStatusMenuId(null);
    try {
      const res = await fetch(`/api/showroom-appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      await refresh();
      toast.success(`Status schimbat: ${STATUS_CONFIG[status]?.label || status}`);
    } catch {
      toast.error("Nu s-a putut schimba statusul");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Ștergi această întâlnire?")) return;
    setStatusMenuId(null);
    try {
      const res = await fetch(`/api/showroom-appointments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await refresh();
      toast.success("Șters");
    } catch {
      toast.error("Eroare la ștergere");
    }
  };

  const openReschedule = (a: Appointment) => {
    const d = new Date(a.scheduledAt);
    setRescheduleId(a.id);
    setRescheduleDate(toLocalDateStr(d));
    setRescheduleTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  };

  const saveReschedule = async () => {
    if (!rescheduleId || !rescheduleDate || !rescheduleTime) return;
    setRescheduleSaving(true);
    try {
      const scheduledAt = `${rescheduleDate}T${rescheduleTime}:00`;
      const res = await fetch(`/api/showroom-appointments/${rescheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt }),
      });
      if (!res.ok) throw new Error();
      await refresh();
      setRescheduleId(null);
      setRescheduleDate("");
      setRescheduleTime("");
      toast.success("Reprogramată");
    } catch {
      toast.error("Nu s-a putut salva");
    } finally {
      setRescheduleSaving(false);
    }
  };

  const goToLead = async (a: Appointment) => {
    if (a.leadId) router.push(`/sales?leadId=${a.leadId}`);
    else toast.warning("Nu există lead asociat acestei întâlniri");
  };

  // Close status menu on outside click
  useEffect(() => {
    if (!statusMenuId) return;
    const handler = () => setStatusMenuId(null);
    setTimeout(() => document.addEventListener("click", handler, { once: true }), 0);
    return () => document.removeEventListener("click", handler);
  }, [statusMenuId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-base font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Întâlniri Showroom
          </h1>
          <p className="text-sm text-gray-500">{appointments.length} întâlniri</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Caută client, telefon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border px-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-900"
        >
          <option value="ALL">Toate statusurile</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-900"
        >
          <option value="ALL">Toți agenții</option>
          <option value="none">Fără agent</option>
          {agentsFromAppointments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.firstName} {a.lastName}
            </option>
          ))}
        </select>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as "none" | "brand" | "agent")}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-900"
        >
          <option value="none">Fără grupare</option>
          <option value="brand">Grupează: brand</option>
          <option value="agent">Grupează: agent</option>
        </select>
        {(search || filterStatus !== "ALL" || filterAgent !== "ALL" || groupBy !== "none") && (
          <Button variant="ghost" size="sm" onClick={() => {
            setSearch(""); setFilterStatus("ALL"); setFilterAgent("ALL"); setGroupBy("none");
          }}>
            Resetează
          </Button>
        )}
      </div>

      {/* Unconfirmed section */}
      {unconfirmed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-5 w-5 text-orange-500" />
            <h2 className="text-base font-semibold">Necesită confirmare</h2>
            <Badge className="bg-orange-100 text-orange-700">{unconfirmed.length}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unconfirmed.map((a) => (
              <Card key={a.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedCustomerId(a.customerId)}
                      className="flex items-center gap-1.5 text-sm font-medium text-gray-900 hover:underline"
                    >
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      {a.contactName || `${a.customer.firstName} ${a.customer.lastName}`}
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-sm font-medium bg-orange-100 text-orange-700">
                        Neconfirmat
                      </span>
                      <span className="inline-flex rounded-full border border-gray-900 px-2 py-0.5 text-sm font-medium text-gray-900">
                        {a.brand}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-2">
                    {(a.contactPhone || a.customer.phone) && (
                      <a href={`tel:${a.contactPhone || a.customer.phone}`} className="text-sm text-gray-500 hover:underline">
                        {a.contactPhone || a.customer.phone}
                      </a>
                    )}
                    {a.leadId && (
                      <button
                        onClick={() => goToLead(a)}
                        className="text-sm text-gray-500 hover:text-gray-900 hover:underline shrink-0"
                      >
                        Vezi lead →
                      </button>
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-500 px-3 py-2">
                      <span className="text-sm font-medium text-white">
                        {new Date(a.scheduledAt).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })} —{" "}
                        {new Date(a.scheduledAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                        {" "}· {a.duration} min
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {canApprove && (
                          <button
                            onClick={() => handleStatusChange(a.id, "CONFIRMED")}
                            className="rounded-md bg-white hover:bg-amber-50 text-amber-600 px-3 py-1 transition-colors flex items-center gap-1"
                            title="Confirmă"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span className="text-sm font-medium hidden sm:inline">Confirmă</span>
                          </button>
                        )}
                        <button
                          onClick={() => openReschedule(a)}
                          className="rounded-md bg-amber-700 hover:bg-amber-800 text-white p-1 transition-colors"
                          title="Reprogramează"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(a.id, "CANCELLED")}
                          className="rounded-md bg-red-600 hover:bg-red-700 text-white p-1 transition-colors"
                          title="Anulează"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {a.notes && <p className="mt-2 text-sm text-gray-500 italic">{a.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Calendar + Selected Day */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Calendar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4 gap-2">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => {
                  if (calView === "week") {
                    const base = new Date((selectedDate || todayStr) + "T12:00:00");
                    base.setDate(base.getDate() - 7);
                    setSelectedDate(toLocalDateStr(base));
                  } else if (calMonth === 0) {
                    setCalMonth(11); setCalYear((y) => y - 1);
                  } else setCalMonth((m) => m - 1);
                }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const now = new Date();
                  setCalMonth(now.getMonth());
                  setCalYear(now.getFullYear());
                  setSelectedDate(todayStr);
                }}>
                  Azi
                </Button>
              </div>
              <h3 className="text-sm font-semibold">{MONTHS_RO[calMonth]} {calYear}</h3>
              <div className="flex items-center gap-1">
                <div className="flex rounded-md border overflow-hidden">
                  <button onClick={() => setCalView("month")}
                    className={`px-2 py-1 text-sm ${calView === "month" ? "bg-gray-900 text-white" : "bg-white text-gray-900"}`}>
                    Lună
                  </button>
                  <button onClick={() => setCalView("week")}
                    className={`px-2 py-1 text-sm ${calView === "week" ? "bg-gray-900 text-white" : "bg-white text-gray-900"}`}>
                    Săptămână
                  </button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
                  if (calView === "week") {
                    const base = new Date((selectedDate || todayStr) + "T12:00:00");
                    base.setDate(base.getDate() + 7);
                    setSelectedDate(toLocalDateStr(base));
                  } else if (calMonth === 11) {
                    setCalMonth(0); setCalYear((y) => y + 1);
                  } else setCalMonth((m) => m + 1);
                }}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {calView === "month" ? (
              <>
                <div className="grid grid-cols-7 mb-1">
                  {DAYS_RO.map((d) => (
                    <div key={d} className="text-center text-sm font-medium text-gray-500 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {calendarDays.map(({ date, day, isCurrentMonth }) => {
                    const count = countsByDate[date] || 0;
                    const isToday = date === todayStr;
                    const isSelected = date === selectedDate;
                    return (
                      <button
                        key={date}
                        onClick={() => setSelectedDate(date === selectedDate ? null : date)}
                        className={`relative flex flex-col items-center justify-center py-2 text-sm rounded-md transition-colors
                          ${!isCurrentMonth ? "text-gray-500/40" : ""}
                          ${isToday && !isSelected ? "bg-amber-50 font-bold text-amber-700" : ""}
                          ${isSelected ? "bg-amber-500 text-white" : "hover:bg-accent"}`}
                      >
                        <span>{day}</span>
                        {count > 0 && (
                          <span className={`mt-0.5 text-sm font-bold leading-none rounded-full px-1.5 py-0.5
                            ${isSelected ? "bg-white/30 text-white" : "bg-amber-100 text-amber-700"}`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="space-y-1">
                {weekDays.map(({ date, items }) => {
                  const isToday = date === todayStr;
                  const isSelected = date === selectedDate;
                  const d = new Date(date + "T12:00:00");
                  return (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date === selectedDate ? null : date)}
                      className={`flex items-center justify-between w-full p-3 rounded-md transition-colors
                        ${isSelected ? "bg-amber-500 text-white" : isToday ? "bg-amber-50 text-amber-700" : "hover:bg-accent"}`}
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium">
                          {d.toLocaleDateString("ro-RO", { weekday: "long" })}
                        </div>
                        <div className="text-sm">
                          {d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-sm font-bold ${
                        isSelected ? "bg-white/30 text-white" : items.length > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {items.length} {items.length === 1 ? "întâlnire" : "întâlniri"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
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
                        weekday: "long", day: "numeric", month: "long",
                      })}
                  <Badge variant="secondary">{selectedDayAppointments.length} întâlniri</Badge>
                </h3>

                {selectedDayAppointments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                    <Calendar className="h-8 w-8 mb-2" />
                    <p className="text-sm">Nicio întâlnire în această zi</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                    {Object.entries(groupedDayAppointments).map(([groupName, groupItems]) => (
                      <div key={groupName || "all"} className="space-y-3">
                        {groupName && (
                          <div className="sticky top-0 bg-white/95 backdrop-blur-sm py-1 flex items-center gap-2 border-b">
                            <span className="text-sm font-semibold text-gray-900">{groupName}</span>
                            <span className="text-sm text-gray-500">({groupItems.length})</span>
                          </div>
                        )}
                        {groupItems.map((a) => {
                          const statusInfo = STATUS_CONFIG[a.status] ?? { label: a.status, color: "" };
                          const transitions = STATUS_TRANSITIONS[a.status] ?? [];
                          const isActive = a.status === "SCHEDULED" || a.status === "CONFIRMED";

                          return (
                            <Card key={a.id} className="hover:shadow-md transition-shadow">
                              <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                  <button
                                    onClick={() => setSelectedCustomerId(a.customerId)}
                                    className="flex items-center gap-1.5 text-sm font-medium text-gray-900 hover:underline"
                                  >
                                    <User className="h-3.5 w-3.5 text-gray-400" />
                                    {a.contactName || `${a.customer.firstName} ${a.customer.lastName}`}
                                  </button>
                                  <div className="flex items-center gap-1">
                                    <div className="relative">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setStatusMenuId(statusMenuId === a.id ? null : a.id);
                                        }}
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium ${statusInfo.color}`}
                                      >
                                        {statusInfo.label}
                                        {transitions.length > 0 && <ChevronDown className="h-3 w-3" />}
                                      </button>
                                      {statusMenuId === a.id && transitions.length > 0 && (
                                        <div className="absolute right-0 top-full mt-1 z-10 w-40 rounded-md border bg-white py-1 shadow-lg">
                                          {transitions.map((status) => {
                                            const s = STATUS_CONFIG[status];
                                            return (
                                              <button
                                                key={status}
                                                onClick={() => handleStatusChange(a.id, status)}
                                                className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
                                              >
                                                <span className={`inline-block h-2 w-2 rounded-full ${
                                                  status === "CANCELLED" || status === "NO_SHOW" ? "bg-red-500"
                                                  : status === "COMPLETED" ? "bg-gray-500"
                                                  : status === "CONFIRMED" ? "bg-green-500"
                                                  : status === "IN_PROGRESS" ? "bg-yellow-500"
                                                  : "bg-blue-500"
                                                }`} />
                                                {s?.label ?? status}
                                              </button>
                                            );
                                          })}
                                          <div className="border-t my-1" />
                                          <button
                                            onClick={() => handleDelete(a.id)}
                                            className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                                          >
                                            Șterge
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <span className="inline-flex rounded-full border border-gray-900 px-2 py-0.5 text-sm font-medium text-gray-900">
                                      {a.brand}
                                    </span>
                                  </div>
                                </div>

                                {(a.contactPhone || a.customer.phone) && (
                                  <div className="mt-0.5 text-sm text-gray-500">
                                    <a href={`tel:${a.contactPhone || a.customer.phone}`} className="hover:underline">
                                      {a.contactPhone || a.customer.phone}
                                    </a>
                                    {a.agent && ` · Agent: ${a.agent.firstName} ${a.agent.lastName}`}
                                  </div>
                                )}

                                {isActive && (
                                  <div className="mt-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-500 px-3 py-2">
                                      <span className="text-sm font-medium text-white">
                                        {new Date(a.scheduledAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                                        {" "}· {a.duration} min
                                      </span>
                                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                        {a.status === "SCHEDULED" && canApprove && (
                                          <button
                                            onClick={() => handleStatusChange(a.id, "CONFIRMED")}
                                            className="rounded-md bg-white hover:bg-amber-50 text-amber-600 px-3 py-1 transition-colors flex items-center gap-1"
                                            title="Confirmă"
                                          >
                                            <Check className="h-3.5 w-3.5" />
                                            <span className="text-sm font-medium">Confirmă</span>
                                          </button>
                                        )}
                                        <button
                                          onClick={() => openReschedule(a)}
                                          className="rounded-md bg-amber-700 hover:bg-amber-800 text-white p-1 transition-colors"
                                          title="Reprogramează"
                                        >
                                          <Calendar className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleStatusChange(a.id, "CANCELLED")}
                                          className="rounded-md bg-red-600 hover:bg-red-700 text-white p-1 transition-colors"
                                          title="Anulează"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {a.notes && (
                                  <p className="mt-2 text-sm text-gray-500 italic">{a.notes}</p>
                                )}

                                {a.leadId && (
                                  <div className="mt-2 text-right">
                                    <button
                                      onClick={() => goToLead(a)}
                                      className="text-sm text-gray-500 hover:text-gray-900 hover:underline"
                                    >
                                      Vezi lead →
                                    </button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Calendar className="h-8 w-8 mb-2" />
                <p className="text-sm">Selectează o zi pentru a vedea întâlnirile</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reschedule modal */}
      {rescheduleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="text-sm font-bold">Reprogramează întâlnire</h3>
              <button onClick={() => setRescheduleId(null)} className="rounded-md p-1 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ora</label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setRescheduleId(null)}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Anulează
                </button>
                <button
                  onClick={saveReschedule}
                  disabled={rescheduleSaving || !rescheduleDate || !rescheduleTime}
                  className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {rescheduleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvează"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer overlay */}
      {selectedCustomerId && (
        <CustomerOverlay
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}
    </div>
  );
}
