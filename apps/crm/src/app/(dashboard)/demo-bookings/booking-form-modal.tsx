"use client";

import { useEffect, useState } from "react";
import { Button } from "@autoerebus/ui";
import { Input } from "@autoerebus/ui";
import { X, Search } from "lucide-react";

interface Vehicle {
  id: string;
  title: string | null;
  brand: string;
  year: number | null;
  make?: { name: string };
  model?: { name: string };
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

interface Props {
  currentUserId: string;
  teamMembers: TeamMember[];
  userBrands: string[];
  preselectedVehicle: Vehicle | null;
  onClose: () => void;
  onSuccess: () => void;
}

type RecipientMode = "self" | "employee" | "customer-existing" | "customer-new";

export default function BookingFormModal({
  currentUserId,
  teamMembers,
  userBrands,
  preselectedVehicle,
  onClose,
  onSuccess,
}: Props) {
  // Vehicle
  const [vehicleId, setVehicleId] = useState<string>(preselectedVehicle?.id || "");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleResults, setVehicleResults] = useState<Vehicle[]>([]);
  const [showVehicleSearch, setShowVehicleSearch] = useState(!preselectedVehicle);

  // Recipient
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("self");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [newCustomer, setNewCustomer] = useState({ firstName: "", lastName: "", email: "", phone: "" });

  // Dates
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("17:00");

  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vehicle search
  useEffect(() => {
    if (!showVehicleSearch) return;
    if (!vehicleSearch.trim()) {
      setVehicleResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/demo-bookings/available-vehicles");
        const data = await res.json();
        const q = vehicleSearch.toLowerCase();
        const filtered = (data.vehicles || []).filter((v: Vehicle) =>
          [v.title, v.make?.name, v.model?.name, v.brand].some((s) =>
            s?.toLowerCase().includes(q)
          )
        );
        setVehicleResults(filtered.slice(0, 10));
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [vehicleSearch, showVehicleSearch]);

  // Customer search
  useEffect(() => {
    if (recipientMode !== "customer-existing") return;
    if (!customerSearch.trim()) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}`);
        const data = await res.json();
        setCustomerResults(data.customers || data || []);
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, recipientMode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!vehicleId) return setError("Selectează o mașină");
    if (!startDate || !endDate) return setError("Completează datele");
    if (!purpose.trim()) return setError("Scopul este obligatoriu");

    const start = new Date(`${startDate}T${startTime}:00`);
    const end = new Date(`${endDate}T${endTime}:00`);
    if (start >= end) return setError("Data sfârșit trebuie să fie după start");

    const payload: any = {
      vehicleId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      purpose: purpose.trim(),
      notes: notes.trim() || undefined,
    };

    if (recipientMode === "self") {
      payload.recipientType = "USER";
      payload.userId = currentUserId;
    } else if (recipientMode === "employee") {
      if (!selectedEmployeeId) return setError("Selectează angajatul");
      payload.recipientType = "USER";
      payload.userId = selectedEmployeeId;
    } else if (recipientMode === "customer-existing") {
      if (!selectedCustomerId) return setError("Selectează clientul");
      payload.recipientType = "CUSTOMER";
      payload.customerId = selectedCustomerId;
    } else if (recipientMode === "customer-new") {
      if (!newCustomer.firstName || !newCustomer.lastName || !newCustomer.phone) {
        return setError("Nume, prenume și telefon sunt obligatorii");
      }
      payload.recipientType = "CUSTOMER";
      payload.newCustomer = newCustomer;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/demo-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Eroare la salvare");
        return;
      }
      onSuccess();
    } catch (e) {
      setError("Eroare de rețea");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-3">
          <h2 className="text-lg font-semibold">Rezervare mașină demo</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {/* Vehicle */}
          <section>
            <label className="mb-2 block text-sm font-medium">Mașina</label>
            {!showVehicleSearch && preselectedVehicle ? (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{preselectedVehicle.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {preselectedVehicle.make?.name} {preselectedVehicle.model?.name} · {preselectedVehicle.year}
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowVehicleSearch(true)}>
                  Schimbă
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  placeholder="Caută mașină..."
                  className="pl-9"
                />
                {vehicleResults.length > 0 && (
                  <div className="mt-1 max-h-48 overflow-auto rounded-md border bg-white shadow-sm">
                    {vehicleResults.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setVehicleId(v.id);
                          setVehicleSearch(v.title || "");
                          setVehicleResults([]);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {v.title} <span className="text-xs text-muted-foreground">· {v.brand}</span>
                      </button>
                    ))}
                  </div>
                )}
                {vehicleId && !vehicleSearch && (
                  <p className="mt-1 text-xs text-green-600">Selectat</p>
                )}
              </div>
            )}
          </section>

          {/* Recipient */}
          <section>
            <label className="mb-2 block text-sm font-medium">Pentru cine rezerv?</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { id: "self", label: "Pentru mine" },
                { id: "employee", label: "Alt angajat" },
                { id: "customer-existing", label: "Client existent" },
                { id: "customer-new", label: "Client nou" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`cursor-pointer rounded-md border p-2 text-sm ${
                    recipientMode === opt.id ? "border-primary bg-primary/5" : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="recipientMode"
                    value={opt.id}
                    checked={recipientMode === opt.id}
                    onChange={(e) => setRecipientMode(e.target.value as RecipientMode)}
                    className="mr-2"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {recipientMode === "employee" && (
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="mt-2 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">— alege angajat —</option>
                {teamMembers
                  .filter((m) => m.id !== currentUserId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} ({m.email})
                    </option>
                  ))}
              </select>
            )}

            {recipientMode === "customer-existing" && (
              <div className="mt-2">
                <Input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Caută client după nume, email sau telefon..."
                />
                {customerResults.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-auto rounded-md border bg-white shadow-sm">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setCustomerSearch(`${c.firstName} ${c.lastName}`);
                          setCustomerResults([]);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {c.firstName} {c.lastName}{" "}
                        <span className="text-xs text-muted-foreground">
                          {c.phone} {c.email}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {recipientMode === "customer-new" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  placeholder="Prenume"
                  value={newCustomer.firstName}
                  onChange={(e) => setNewCustomer({ ...newCustomer, firstName: e.target.value })}
                />
                <Input
                  placeholder="Nume"
                  value={newCustomer.lastName}
                  onChange={(e) => setNewCustomer({ ...newCustomer, lastName: e.target.value })}
                />
                <Input
                  placeholder="Telefon *"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                />
              </div>
            )}
          </section>

          {/* Dates */}
          <section>
            <label className="mb-2 block text-sm font-medium">Perioadă</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">De la</p>
                <div className="flex gap-2">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-28" />
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Până la</p>
                <div className="flex gap-2">
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-28" />
                </div>
              </div>
            </div>
          </section>

          {/* Purpose + notes */}
          <section>
            <label className="mb-2 block text-sm font-medium">Scop</label>
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Ex: prezentare client, eveniment, uz intern..."
            />
          </section>

          <section>
            <label className="mb-2 block text-sm font-medium">Note (opțional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </section>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Anulează
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Se salvează..." : "Rezervă"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
