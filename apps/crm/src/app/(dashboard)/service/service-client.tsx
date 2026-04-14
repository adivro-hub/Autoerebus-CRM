"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { SERVICE_PIPELINE_STAGES } from "@autoerebus/types";
import {
  Plus,
  X,
  Wrench,
  ChevronDown,
  Check,
  Phone,
  Mail,
  Clock,
  Search,
  Calendar,
  MessageSquare,
  User,
  Car,
  Loader2,
  Trash2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
}

interface ServiceOrderVehicle {
  id: string;
  make: { name: string };
  model: { name: string };
  year: number;
  title?: string;
  images?: { url: string }[];
}

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
}

interface ActivityItem {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  user?: { firstName: string; lastName: string } | null;
}

interface ServiceOrder {
  id: string;
  orderNumber: string;
  status: string;
  type: string | null;
  description: string | null;
  scheduledDate: string | null;
  receivedDate: string | null;
  completedDate: string | null;
  deliveredDate: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  currency: string;
  notes: string | null;
  createdAt: string;
  customer: Customer;
  vehicle: ServiceOrderVehicle | null;
  assignedTo: Agent | null;
  activities?: ActivityItem[];
}

interface ServiceOrderDetail extends ServiceOrder {
  activities: ActivityItem[];
}

const STATUS_MAP: Record<string, string> = {
  Programat: "SCHEDULED",
  "Recepționat": "RECEIVED",
  "În Lucru": "IN_PROGRESS",
  "Așteptare Piese": "WAITING_PARTS",
  Finalizat: "COMPLETED",
  Livrat: "DELIVERED",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Programat",
  RECEIVED: "Recepționat",
  IN_PROGRESS: "În Lucru",
  WAITING_PARTS: "Așteptare Piese",
  COMPLETED: "Finalizat",
  DELIVERED: "Livrat",
  CANCELLED: "Anulat",
};

const SERVICE_TYPES = [
  "ITP",
  "Revizie",
  "Reparație",
  "Climatizare",
  "Geometrie",
  "Anvelope",
  "Diagnoză",
  "Altele",
];

// ─── Helpers ────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCost(v: number | null, currency: string) {
  if (v == null) return "—";
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

function relativeTime(d: string) {
  const now = Date.now();
  const t = new Date(d).getTime();
  const diff = now - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}z`;
}

function stageColor(status: string) {
  const stage = SERVICE_PIPELINE_STAGES.find(
    (s) => STATUS_MAP[s.name] === status
  );
  return stage?.color || "#6B7280";
}

// ─── MoveModal ──────────────────────────────────────────

function MoveModal({
  order,
  targetStatus,
  onConfirm,
  onCancel,
}: {
  order: ServiceOrder;
  targetStatus: string;
  onConfirm: (comment: string, cancelReason?: string) => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const isCancelling = targetStatus === "CANCELLED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-sm font-bold">
          Mută comanda #{order.orderNumber.slice(-8)}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {order.customer.firstName} {order.customer.lastName} →{" "}
          <span className="font-medium" style={{ color: stageColor(targetStatus) }}>
            {STATUS_LABELS[targetStatus]}
          </span>
        </p>

        {isCancelling && (
          <div className="mt-3">
            <label className="text-sm font-medium">Motiv anulare</label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Selectează...</option>
              <option>Client a renunțat</option>
              <option>Nu s-a prezentat</option>
              <option>Eroare la programare</option>
              <option>Altul</option>
            </select>
          </div>
        )}

        <div className="mt-3">
          <label className="text-sm font-medium">Comentariu</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            rows={3}
            placeholder="Adaugă un comentariu..."
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Anulează
          </button>
          <button
            onClick={() => onConfirm(comment, cancelReason)}
            disabled={isCancelling && !cancelReason}
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Confirmă
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MoveDropdown ───────────────────────────────────────

function MoveDropdown({
  order,
  onRefresh,
}: {
  order: ServiceOrder;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [done, setDone] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allStatuses = [
    "SCHEDULED",
    "RECEIVED",
    "IN_PROGRESS",
    "WAITING_PARTS",
    "COMPLETED",
    "DELIVERED",
    "CANCELLED",
  ].filter((s) => s !== order.status);

  const doMove = async (status: string, comment: string, cancelReason?: string) => {
    setMoving(true);
    try {
      await fetch(`/api/service-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment, cancelReason }),
      });
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        onRefresh();
      }, 800);
    } catch {
      // ignore
    }
    setMoving(false);
  };

  const handleSelect = (status: string) => {
    if (status === "CANCELLED") {
      setModal(status);
      setOpen(false);
    } else {
      setModal(status);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
      >
        {moving ? <Loader2 className="h-3 w-3 animate-spin" /> : done ? <Check className="h-3 w-3 text-green-600" /> : <ChevronDown className="h-3 w-3" />}
        Mută
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 rounded-md border bg-white py-1 shadow-lg">
          {allStatuses.map((s) => (
            <button
              key={s}
              onClick={() => handleSelect(s)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: stageColor(s) }}
              />
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
      {modal && (
        <MoveModal
          order={order}
          targetStatus={modal}
          onConfirm={(comment, cancelReason) => {
            doMove(modal, comment, cancelReason);
            setModal(null);
          }}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ─── OrderCard (Pipeline) ───────────────────────────────

function OrderCard({
  order,
  onClick,
  onRefresh,
  onDragStart,
}: {
  order: ServiceOrder;
  onClick: () => void;
  onRefresh: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <p className="font-mono text-xs text-gray-400">
          #{order.orderNumber.slice(-8)}
        </p>
        <MoveDropdown order={order} onRefresh={onRefresh} />
      </div>
      <p className="mt-1 text-sm font-medium">
        {order.customer.firstName} {order.customer.lastName}
      </p>
      {order.vehicle && (
        <p className="text-xs text-gray-500">
          {order.vehicle.make.name} {order.vehicle.model.name} ({order.vehicle.year})
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {order.type && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
            {order.type}
          </span>
        )}
        {order.scheduledDate && (
          <span className="flex items-center gap-0.5 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            {formatDate(order.scheduledDate)}
          </span>
        )}
      </div>
      {(order.estimatedCost != null || order.actualCost != null) && (
        <p className="mt-1 text-xs font-medium">
          {order.actualCost != null
            ? formatCost(order.actualCost, order.currency)
            : `~${formatCost(order.estimatedCost, order.currency)}`}
        </p>
      )}
      {order.assignedTo && (
        <p className="mt-1 text-xs text-gray-400">
          {order.assignedTo.firstName} {order.assignedTo.lastName}
        </p>
      )}
    </div>
  );
}

// ─── ServiceDetailOverlay ───────────────────────────────

function ServiceDetailOverlay({
  orderId,
  agents,
  onClose,
  onRefresh,
}: {
  orderId: string;
  agents: Agent[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [order, setOrder] = useState<ServiceOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [commentType, setCommentType] = useState("NOTE");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleResults, setVehicleResults] = useState<ServiceOrderVehicle[]>([]);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/service-orders/${orderId}`);
      const data = await res.json();
      if (data.success) setOrder(data.data);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const addComment = async () => {
    if (!commentText.trim()) return;
    setSaving(true);
    await fetch(`/api/service-orders/${orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: commentText, type: commentType }),
    });
    setCommentText("");
    setSaving(false);
    fetchOrder();
  };

  const updateField = async (field: string, value: unknown) => {
    await fetch(`/api/service-orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    fetchOrder();
    onRefresh();
  };

  const searchVehicles = async (q: string) => {
    setVehicleSearch(q);
    if (q.length < 2) {
      setVehicleResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/vehicles?search=${encodeURIComponent(q)}&limit=5`);
      const data = await res.json();
      setVehicleResults(data.data || []);
    } catch {
      setVehicleResults([]);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }
  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-sm font-bold">Comanda #{order.orderNumber.slice(-8)}</h2>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: stageColor(order.status) }}
              >
                {STATUS_LABELS[order.status] || order.status}
              </span>
              {order.type && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                  {order.type}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Client */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4" /> Client
            </h3>
            <div className="mt-2 rounded-md border p-3 text-sm">
              <p className="font-medium">
                {order.customer.firstName} {order.customer.lastName}
              </p>
              {order.customer.phone && (
                <p className="flex items-center gap-1 text-gray-600">
                  <Phone className="h-3 w-3" /> {order.customer.phone}
                </p>
              )}
              {order.customer.email && (
                <p className="flex items-center gap-1 text-gray-600">
                  <Mail className="h-3 w-3" /> {order.customer.email}
                </p>
              )}
            </div>
          </section>

          {/* Vehicle */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Car className="h-4 w-4" /> Vehicul
            </h3>
            {order.vehicle ? (
              <div className="mt-2 rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {order.vehicle.make.name} {order.vehicle.model.name} ({order.vehicle.year})
                </p>
                <button
                  onClick={() => updateField("vehicleId", null)}
                  className="mt-1 text-xs text-red-500 hover:underline"
                >
                  Dezasociază
                </button>
              </div>
            ) : (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Caută vehicul..."
                  value={vehicleSearch}
                  onChange={(e) => searchVehicles(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
                {vehicleResults.length > 0 && (
                  <div className="mt-1 rounded-md border bg-white shadow-sm">
                    {vehicleResults.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          updateField("vehicleId", v.id);
                          setVehicleSearch("");
                          setVehicleResults([]);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {v.make?.name} {v.model?.name} ({v.year})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Service Details */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Wrench className="h-4 w-4" /> Detalii Service
            </h3>
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Tip:</span>
                {editing ? (
                  <select
                    value={editFields.type ?? order.type ?? ""}
                    onChange={(e) => setEditFields({ ...editFields, type: e.target.value })}
                    className="rounded-md border px-2 py-1 text-sm"
                  >
                    <option value="">—</option>
                    {SERVICE_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                ) : (
                  <span>{order.type || "—"}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Agent:</span>
                <select
                  value={order.assignedTo?.id || ""}
                  onChange={(e) => updateField("assignedToId", e.target.value)}
                  className="rounded-md border px-2 py-1 text-sm"
                >
                  <option value="">Neasignat</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.firstName} {a.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Dates */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4" /> Date
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Programat:</span>
                <p>{formatDateTime(order.scheduledDate)}</p>
              </div>
              <div>
                <span className="text-gray-500">Recepționat:</span>
                <p>{formatDateTime(order.receivedDate)}</p>
              </div>
              <div>
                <span className="text-gray-500">Finalizat:</span>
                <p>{formatDateTime(order.completedDate)}</p>
              </div>
              <div>
                <span className="text-gray-500">Livrat:</span>
                <p>{formatDateTime(order.deliveredDate)}</p>
              </div>
            </div>
          </section>

          {/* Costs */}
          <section>
            <h3 className="text-sm font-semibold">Costuri</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Estimat:</span>
                <p className="font-medium">{formatCost(order.estimatedCost, order.currency)}</p>
              </div>
              <div>
                <span className="text-gray-500">Final:</span>
                <p className="font-medium">{formatCost(order.actualCost, order.currency)}</p>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                placeholder="Cost estimat"
                defaultValue={order.estimatedCost ?? ""}
                onBlur={(e) => updateField("estimatedCost", e.target.value)}
                className="w-full rounded-md border px-2 py-1 text-sm"
              />
              <input
                type="number"
                placeholder="Cost final"
                defaultValue={order.actualCost ?? ""}
                onBlur={(e) => updateField("actualCost", e.target.value)}
                className="w-full rounded-md border px-2 py-1 text-sm"
              />
            </div>
          </section>

          {/* Description / Notes */}
          {order.description && (
            <section>
              <h3 className="text-sm font-semibold">Descriere</h3>
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm">
                {order.description}
              </p>
            </section>
          )}
          {order.notes && (
            <section>
              <h3 className="text-sm font-semibold">Note</h3>
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm">
                {order.notes}
              </p>
            </section>
          )}

          {/* Activities */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" /> Activitate
            </h3>
            <div className="mt-2 space-y-1">
              <div className="flex gap-2">
                <select
                  value={commentType}
                  onChange={(e) => setCommentType(e.target.value)}
                  className="rounded-md border px-2 py-1 text-xs"
                >
                  <option value="NOTE">Notă</option>
                  <option value="CALL">Apel</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                </select>
                <input
                  type="text"
                  placeholder="Adaugă comentariu..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addComment()}
                  className="flex-1 rounded-md border px-3 py-1 text-sm"
                />
                <button
                  onClick={addComment}
                  disabled={saving || !commentText.trim()}
                  className="rounded-md bg-black px-3 py-1 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Trimite"}
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {order.activities.map((a) => (
                  <div
                    key={a.id}
                    className="flex gap-3 rounded-md border-l-2 bg-gray-50 p-2 text-sm"
                    style={{
                      borderColor:
                        a.type === "STAGE_CHANGE"
                          ? "#3B82F6"
                          : a.type === "CREATED"
                            ? "#10B981"
                            : "#D1D5DB",
                    }}
                  >
                    <div className="flex-1">
                      <p>{a.content}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {a.user
                          ? `${a.user.firstName} ${a.user.lastName}`
                          : "Sistem"}{" "}
                        — {formatDateTime(a.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── NewServiceOrderForm ────────────────────────────────

function NewServiceOrderForm({
  agents,
  onClose,
  onCreated,
}: {
  agents: Agent[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [searchedCustomer, setSearchedCustomer] = useState<Customer | null>(null);
  const [searched, setSearched] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleResults, setVehicleResults] = useState<ServiceOrderVehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [saving, setSaving] = useState(false);

  const searchCustomer = async () => {
    if (!phone || phone.length < 4) return;
    setSearched(true);
    try {
      const res = await fetch(`/api/customers?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (data.data?.length > 0) {
        const c = data.data[0];
        setSearchedCustomer(c);
        setFirstName(c.firstName);
        setLastName(c.lastName);
        setEmail(c.email || "");
      } else {
        setSearchedCustomer(null);
      }
    } catch {
      setSearchedCustomer(null);
    }
  };

  const searchVehicle = async (q: string) => {
    setVehicleSearch(q);
    if (q.length < 2) {
      setVehicleResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/vehicles?search=${encodeURIComponent(q)}&limit=5`);
      const data = await res.json();
      setVehicleResults(data.data || []);
    } catch {
      setVehicleResults([]);
    }
  };

  const handleSubmit = async () => {
    if (!firstName || !lastName) return;
    setSaving(true);
    try {
      const res = await fetch("/api/service-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phone: phone || undefined,
          email: email || undefined,
          customerId: searchedCustomer?.id,
          vehicleId: vehicleId || undefined,
          type: type || undefined,
          description: description || undefined,
          scheduledDate: scheduledDate || undefined,
          assignedToId: assignedToId || undefined,
          estimatedCost: estimatedCost || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onCreated();
        onClose();
      }
    } catch {
      // ignore
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-sm font-bold">Comandă Service Nouă</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* Phone search */}
          <div>
            <label className="text-sm font-medium">Telefon client</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setSearched(false);
                  setSearchedCustomer(null);
                }}
                placeholder="07xxxxxxxx"
                className="flex-1 rounded-md border px-3 py-2 text-sm"
              />
              <button
                onClick={searchCustomer}
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
            {searched && searchedCustomer && (
              <p className="mt-1 text-xs text-green-600">
                Client existent: {searchedCustomer.firstName} {searchedCustomer.lastName}
              </p>
            )}
            {searched && !searchedCustomer && (
              <p className="mt-1 text-xs text-amber-600">Client nou</p>
            )}
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Prenume *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nume *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          {/* Vehicle search */}
          <div>
            <label className="text-sm font-medium">Vehicul</label>
            {vehicleId ? (
              <div className="mt-1 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{vehicleLabel}</span>
                <button
                  onClick={() => {
                    setVehicleId("");
                    setVehicleLabel("");
                  }}
                  className="text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="mt-1">
                <input
                  type="text"
                  placeholder="Caută vehicul (marcă, model)..."
                  value={vehicleSearch}
                  onChange={(e) => searchVehicle(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
                {vehicleResults.length > 0 && (
                  <div className="mt-1 max-h-32 overflow-y-auto rounded-md border bg-white shadow-sm">
                    {vehicleResults.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setVehicleId(v.id);
                          setVehicleLabel(
                            `${v.make?.name || ""} ${v.model?.name || ""} (${v.year})`
                          );
                          setVehicleSearch("");
                          setVehicleResults([]);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {v.make?.name} {v.model?.name} ({v.year})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Service type */}
          <div>
            <label className="text-sm font-medium">Tip service</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Selectează...</option>
              {SERVICE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Scheduled date */}
          <div>
            <label className="text-sm font-medium">Data programare</label>
            <input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          {/* Agent */}
          <div>
            <label className="text-sm font-medium">Agent</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Neasignat</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.firstName} {a.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium">Descriere / Notă</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Problemă semnalată, observații..."
            />
          </div>

          {/* Estimated cost */}
          <div>
            <label className="text-sm font-medium">Cost estimat (EUR)</label>
            <input
              type="number"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving || !firstName || !lastName}
            className="w-full rounded-md bg-black py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              "Creează Comanda"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export default function ServiceClient({
  initialOrders,
  agents,
}: {
  initialOrders: ServiceOrder[];
  agents: Agent[];
}) {
  const [orders, setOrders] = useState<ServiceOrder[]>(initialOrders);
  const [activeTab, setActiveTab] = useState<"list" | "pipeline">("pipeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterType, setFilterType] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  // Drag & drop state
  const [dragOrderId, setDragOrderId] = useState<string | null>(null);
  const [dragDropTarget, setDragDropTarget] = useState<string | null>(null);
  const [moveModal, setMoveModal] = useState<{
    orderId: string;
    targetStatus: string;
  } | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch("/api/service-orders");
      const data = await res.json();
      if (data.success) setOrders(data.data);
    } catch {
      // ignore
    }
  }, []);

  // Filter orders
  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filterStatus && o.status !== filterStatus) return false;
      if (filterAgent && o.assignedTo?.id !== filterAgent) return false;
      if (filterType && o.type !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.firstName.toLowerCase().includes(q) ||
          o.customer.lastName.toLowerCase().includes(q) ||
          o.customer.phone?.includes(q) ||
          o.vehicle?.make.name.toLowerCase().includes(q) ||
          o.vehicle?.model.name.toLowerCase().includes(q) ||
          o.type?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [orders, filterStatus, filterAgent, filterType, searchQuery]);

  // New orders (SCHEDULED only)
  const newOrders = useMemo(
    () => filtered.filter((o) => o.status === "SCHEDULED"),
    [filtered]
  );

  // Pipeline stages
  const pipelineStages = useMemo(() => {
    return SERVICE_PIPELINE_STAGES.map((stage) => {
      const statusKey = STATUS_MAP[stage.name];
      return {
        ...stage,
        statusKey,
        orders: filtered.filter((o) => o.status === statusKey),
      };
    });
  }, [filtered]);

  // D&D handlers
  const handleDragStart = (orderId: string) => {
    setDragOrderId(orderId);
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragDropTarget(status);
  };

  const handleDragLeave = () => {
    setDragDropTarget(null);
  };

  const handleDrop = (status: string) => {
    if (!dragOrderId) return;
    const order = orders.find((o) => o.id === dragOrderId);
    if (!order || order.status === status) {
      setDragOrderId(null);
      setDragDropTarget(null);
      return;
    }
    setMoveModal({ orderId: dragOrderId, targetStatus: status });
    setDragOrderId(null);
    setDragDropTarget(null);
  };

  const confirmDragDrop = async (
    comment: string,
    cancelReason?: string
  ) => {
    if (!moveModal) return;
    await fetch(`/api/service-orders/${moveModal.orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: moveModal.targetStatus,
        comment,
        cancelReason,
      }),
    });
    setMoveModal(null);
    refreshData();
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Sigur vrei să ștergi această comandă?")) return;
    await fetch(`/api/service-orders/${id}`, { method: "DELETE" });
    refreshData();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-base font-bold tracking-tight">
            Service
          </h1>
          <p className="text-sm text-gray-500">
            {orders.length} comenzi
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-1 rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          Comandă Nouă
        </button>
      </div>

      {/* Tabs + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-3 py-1.5 text-sm ${activeTab === "list" ? "bg-black text-white" : "hover:bg-gray-50"}`}
          >
            Comenzi noi ({newOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`px-3 py-1.5 text-sm ${activeTab === "pipeline" ? "bg-black text-white" : "hover:bg-gray-50"}`}
          >
            Pipeline
          </button>
        </div>

        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Caută..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-48 rounded-md border pl-8 pr-2 text-sm"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-8 rounded-md border px-2 text-sm"
        >
          <option value="">Tip: Toate</option>
          {SERVICE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          className="h-8 rounded-md border px-2 text-sm"
        >
          <option value="">Agent: Toți</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.firstName} {a.lastName}
            </option>
          ))}
        </select>
      </div>

      {/* List View */}
      {activeTab === "list" && (
        <div className="space-y-2">
          {newOrders.length === 0 && (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-gray-500">
              Nicio comandă nouă
            </div>
          )}
          {newOrders.map((order) => (
            <div
              key={order.id}
              className="flex items-center gap-4 rounded-lg border bg-white p-4 hover:shadow-sm"
            >
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: stageColor(order.status) }}
              >
                {order.customer.firstName[0]}
                {order.customer.lastName[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {order.customer.firstName} {order.customer.lastName}
                </p>
                <p className="text-xs text-gray-500">
                  {order.vehicle
                    ? `${order.vehicle.make.name} ${order.vehicle.model.name}`
                    : "Fără vehicul"}{" "}
                  {order.type && `— ${order.type}`}
                </p>
              </div>
              {order.scheduledDate && (
                <div className="text-xs text-gray-500">
                  <Calendar className="mr-1 inline h-3 w-3" />
                  {formatDate(order.scheduledDate)}
                </div>
              )}
              <span className="font-mono text-xs text-gray-400">
                #{order.orderNumber.slice(-8)}
              </span>
              <MoveDropdown order={order} onRefresh={refreshData} />
              <button
                onClick={() => setSelectedOrderId(order.id)}
                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
              >
                Detalii
              </button>
              <button
                onClick={() => deleteOrder(order.id)}
                className="rounded-md p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline View */}
      {activeTab === "pipeline" && (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {pipelineStages.map((stage) => (
            <div
              key={stage.name}
              className={`flex w-72 shrink-0 flex-col rounded-lg transition-all ${
                dragDropTarget === stage.statusKey
                  ? "ring-2 ring-blue-400 bg-blue-50/50"
                  : "bg-muted/50"
              }`}
              onDragOver={(e) => handleDragOver(e, stage.statusKey)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(stage.statusKey)}
            >
              {/* Stage header */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <h3 className="text-sm font-semibold">{stage.name}</h3>
                </div>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium">
                  {stage.orders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2 p-2">
                {stage.orders.length === 0 ? (
                  <div className="flex items-center justify-center rounded-md border border-dashed p-4 text-sm text-gray-400">
                    Nicio comandă
                  </div>
                ) : (
                  stage.orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onClick={() => setSelectedOrderId(order.id)}
                      onRefresh={refreshData}
                      onDragStart={() => handleDragStart(order.id)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail overlay */}
      {selectedOrderId && (
        <ServiceDetailOverlay
          orderId={selectedOrderId}
          agents={agents}
          onClose={() => setSelectedOrderId(null)}
          onRefresh={refreshData}
        />
      )}

      {/* New form */}
      {showNewForm && (
        <NewServiceOrderForm
          agents={agents}
          onClose={() => setShowNewForm(false)}
          onCreated={refreshData}
        />
      )}

      {/* Move modal from D&D */}
      {moveModal && (
        <MoveModal
          order={orders.find((o) => o.id === moveModal.orderId)!}
          targetStatus={moveModal.targetStatus}
          onConfirm={confirmDragDrop}
          onCancel={() => setMoveModal(null)}
        />
      )}
    </div>
  );
}
