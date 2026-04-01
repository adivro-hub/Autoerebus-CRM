"use client";

import { useState, useEffect, useCallback } from "react";
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
  Check,
  Phone,
  Mail,
  AlertCircle,
} from "lucide-react";

interface TestDrive {
  id: string;
  scheduledAt: string;
  duration: number;
  status: string;
  brand: string;
  notes: string | null;
  feedback: string | null;
  customer: { firstName: string; lastName: string; phone: string | null; email: string | null };
  vehicle: { make: { name: string }; model: { name: string }; year: number };
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
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }
> = {
  SCHEDULED: { label: "Programat", variant: "outline", color: "border-blue-300 bg-blue-50 text-blue-700" },
  CONFIRMED: { label: "Confirmat", variant: "default", color: "bg-green-100 text-green-800" },
  IN_PROGRESS: { label: "In Desfasurare", variant: "default", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "Finalizat", variant: "secondary", color: "bg-gray-100 text-gray-700" },
  CANCELLED: { label: "Anulat", variant: "destructive", color: "bg-red-100 text-red-700" },
  NO_SHOW: { label: "Neprezentare", variant: "destructive", color: "bg-red-100 text-red-700" },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: ["SCHEDULED"],
  NO_SHOW: ["SCHEDULED"],
};

export default function TestDrivesClient({
  initialTestDrives,
}: {
  initialTestDrives: TestDrive[];
}) {
  const [testDrives, setTestDrives] = useState<TestDrive[]>(initialTestDrives);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<{ date: string; status: string }>({
    date: "",
    status: "",
  });
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);

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

  // New customer inline form
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });

  // Load form data
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

  // Search customers with debounce
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

  // Filter test drives
  const filtered = testDrives.filter((td) => {
    if (filter.status && td.status !== filter.status) return false;
    if (filter.date) {
      const tdDate = new Date(td.scheduledAt).toISOString().split("T")[0];
      if (tdDate !== filter.date) return false;
    }
    return true;
  });

  // Group by date
  const grouped = filtered.reduce<Record<string, TestDrive[]>>((acc, td) => {
    const key = new Date(td.scheduledAt).toISOString().split("T")[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(td);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const today = new Date().toISOString().split("T")[0];

  // Create customer
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

  // Submit test drive
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
      // Refetch to get full data
      const refetch = await fetch(
        `/api/test-drives?type=vehicles`
      );
      if (refetch.ok) setVehicles(await refetch.json());

      setTestDrives((prev) => [
        {
          ...created,
          scheduledAt: created.scheduledAt,
        },
        ...prev,
      ]);
      setShowForm(false);
      setFormData({
        vehicleId: "",
        customerId: "",
        scheduledAt: "",
        duration: 30,
        agentId: "",
        notes: "",
      });
      setSuccess("Test drive programat cu succes!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Eroare la programare");
    } finally {
      setSaving(false);
    }
  }

  // Update status
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

  // Delete test drive
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

  const selectedCustomer = customers.find((c) => c.id === formData.customerId);

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
          <h1 className="font-heading text-2xl font-bold tracking-tight">Test Drive</h1>
          <p className="text-sm text-muted-foreground">{testDrives.length} programari</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Programeaza Test Drive
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="date"
          value={filter.date}
          onChange={(e) => setFilter((f) => ({ ...f, date: e.target.value }))}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Toate statusurile</option>
          {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {(filter.date || filter.status) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter({ date: "", status: "" })}
          >
            <X className="h-3 w-3 mr-1" />
            Reseteaza
          </Button>
        )}
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

      {/* Schedule Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Programeaza Test Drive</h2>
              <button onClick={() => setShowForm(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Vehicle Selection */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Vehicul <span className="text-red-500">*</span>
                </label>
                {vehicles.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Niciun vehicul disponibil pentru test drive. Activati optiunea pe vehicule din inventar.
                  </p>
                ) : (
                  <select
                    value={formData.vehicleId}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, vehicleId: e.target.value }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Selectati vehiculul</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.make.name} {v.model.name} ({v.year})
                        {v.title ? ` - ${v.title}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Customer Selection */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Client <span className="text-red-500">*</span>
                </label>

                {!showNewCustomer ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Cauta client dupa nume, telefon, email..."
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
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((f) => ({ ...f, customerId: "" }))
                          }
                        >
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
                            onClick={() =>
                              setFormData((f) => ({ ...f, customerId: c.id }))
                            }
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent text-left border-b last:border-0"
                          >
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <div className="font-medium">
                                {c.firstName} {c.lastName}
                              </div>
                              <div className="text-xs text-muted-foreground flex gap-3">
                                {c.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {c.phone}
                                  </span>
                                )}
                                {c.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {c.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowNewCustomer(true)}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      + Adauga client nou
                    </button>
                  </>
                ) : (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder="Prenume *"
                        value={newCustomer.firstName}
                        onChange={(e) =>
                          setNewCustomer((c) => ({
                            ...c,
                            firstName: e.target.value,
                          }))
                        }
                        className="rounded-md border border-input px-3 py-2 text-sm"
                        required
                      />
                      <input
                        placeholder="Nume *"
                        value={newCustomer.lastName}
                        onChange={(e) =>
                          setNewCustomer((c) => ({
                            ...c,
                            lastName: e.target.value,
                          }))
                        }
                        className="rounded-md border border-input px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder="Telefon"
                        value={newCustomer.phone}
                        onChange={(e) =>
                          setNewCustomer((c) => ({
                            ...c,
                            phone: e.target.value,
                          }))
                        }
                        className="rounded-md border border-input px-3 py-2 text-sm"
                      />
                      <input
                        placeholder="Email"
                        type="email"
                        value={newCustomer.email}
                        onChange={(e) =>
                          setNewCustomer((c) => ({
                            ...c,
                            email: e.target.value,
                          }))
                        }
                        className="rounded-md border border-input px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateCustomer}
                      >
                        Salveaza Client
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowNewCustomer(false)}
                      >
                        Anuleaza
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Data si ora <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, scheduledAt: e.target.value }))
                    }
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Durata (minute)
                  </label>
                  <select
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        duration: parseInt(e.target.value),
                      }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 ora</option>
                    <option value={90}>1.5 ore</option>
                    <option value={120}>2 ore</option>
                  </select>
                </div>
              </div>

              {/* Agent */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Agent</label>
                <select
                  value={formData.agentId}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, agentId: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Fara agent</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.firstName} {a.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Note</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={3}
                  placeholder="Observatii, preferinte client..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Anuleaza
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Se programeaza..." : "Programeaza"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="mb-3 h-10 w-10" />
            <p className="font-medium">Nicio programare gasita</p>
            <p className="text-sm">Programati un test drive nou</p>
          </CardContent>
        </Card>
      ) : (
        sortedDates.map((date) => (
          <div key={date} className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Calendar className="h-4 w-4" />
              {date === today
                ? "Azi"
                : new Date(date + "T12:00:00").toLocaleDateString("ro-RO", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
              <Badge variant="secondary">{grouped[date].length}</Badge>
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grouped[date].map((td) => {
                const statusInfo = STATUS_CONFIG[td.status] ?? {
                  label: td.status,
                  variant: "outline" as const,
                  color: "",
                };
                const transitions = STATUS_TRANSITIONS[td.status] ?? [];

                return (
                  <Card key={td.id} className="relative group">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {new Date(td.scheduledAt).toLocaleTimeString(
                              "ro-RO",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </span>
                        </div>

                        {/* Status with dropdown */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setStatusMenuId(
                                statusMenuId === td.id ? null : td.id
                              )
                            }
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                            {transitions.length > 0 && (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>

                          {statusMenuId === td.id && transitions.length > 0 && (
                            <div className="absolute right-0 top-full mt-1 z-10 w-40 rounded-md border bg-white py-1 shadow-lg">
                              {transitions.map((status) => {
                                const s = STATUS_CONFIG[status];
                                return (
                                  <button
                                    key={status}
                                    onClick={() =>
                                      handleStatusChange(td.id, status)
                                    }
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

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {td.customer.firstName} {td.customer.lastName}
                          </span>
                          {td.customer.phone && (
                            <a
                              href={`tel:${td.customer.phone}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {td.customer.phone}
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Car className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {td.vehicle.make.name} {td.vehicle.model.name} (
                            {td.vehicle.year})
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{td.duration} min</span>
                        {td.agent && (
                          <span>
                            Agent: {td.agent.firstName} {td.agent.lastName}
                          </span>
                        )}
                      </div>

                      {td.notes && (
                        <p className="mt-2 text-xs text-muted-foreground border-t pt-2 italic">
                          {td.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Click outside to close status menu */}
      {statusMenuId && (
        <div
          className="fixed inset-0 z-[5]"
          onClick={() => setStatusMenuId(null)}
        />
      )}
    </div>
  );
}
