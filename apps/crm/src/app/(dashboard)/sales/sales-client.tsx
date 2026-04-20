"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@autoerebus/ui/components/card";
import { Badge } from "@autoerebus/ui/components/badge";
import { Button } from "@autoerebus/ui/components/button";
import { formatCurrency } from "@autoerebus/ui/lib/utils";
import {
  User,
  Car,
  Phone,
  Mail,
  Clock,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  Check,
  Loader2,
  X,
  Send,
  ArrowRight,
  FileText,
  PhoneCall,
  MailIcon,
  Calendar,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Bell,
  History,
  GripVertical,
  AlertTriangle,
  UserPlus,
} from "lucide-react";
import { useBrand } from "@/components/brand-switcher";
import { CustomerOverlay } from "@/components/customer-overlay";

// ─── Types ─────────────────────────────────────────────

interface Lead {
  id: string;
  status: string;
  source: string;
  type: string;
  brand: string;
  priority: number;
  notes: string | null;
  createdAt: string;
  customer: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null };
  vehicle: { id: string; title: string | null; make: { name: string }; model: { name: string }; year: number; price: number | null; discountPrice: number | null } | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  _count: { deals: number };
}

const LEAD_TYPE_CONFIG: Record<string, { label: string; style: string }> = {
  TEST_DRIVE: { label: "Test Drive", style: "bg-green-600 text-white" },
  PRICE_OFFER: { label: "Ofertă Preț", style: "bg-amber-500 text-white" },
  CAR_INQUIRY: { label: "Cerere Info", style: "bg-blue-600 text-white" },
  PRICE_ALERT: { label: "Alertă Preț", style: "bg-purple-600 text-white" },
  CALLBACK: { label: "Callback", style: "bg-gray-700 text-white" },
  GENERAL: { label: "General", style: "bg-gray-200 text-gray-700" },
};

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
  brand: string | null;
  deals: Array<{
    id: string;
    value: number | null;
    currency: string;
    probability: number;
    createdAt?: string;
    lead: {
      id: string;
      source: string;
      customer: { firstName: string; lastName: string };
      vehicle: { make: { name: string }; model: { name: string } } | null;
    };
    assignedTo: { id: string; firstName: string; lastName: string } | null;
  }>;
}

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
}

interface ActiveTestDrive {
  id: string;
  customerId: string;
  leadId?: string | null;
  vehicleId: string;
  scheduledAt: string;
  status: string;
  brand: string;
}

interface ActiveShowroom {
  id: string;
  customerId: string;
  leadId?: string | null;
  scheduledAt: string;
  duration: number;
  status: string;
  brand: string;
}

// ─── Constants ─────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  NEW: "border border-blue-400 text-gray-800 bg-white",
  CONTACTED: "border border-violet-400 text-gray-800 bg-white",
  QUALIFIED: "border border-amber-400 text-gray-800 bg-white",
  NEGOTIATION: "border border-orange-400 text-gray-800 bg-white",
  WON: "border border-emerald-400 text-gray-800 bg-white",
  LOST: "border border-gray-300 text-gray-500 bg-white",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nou",
  CONTACTED: "Contactat",
  NEGOTIATION: "Negociere",
  WON: "Vândut",
  LOST: "Pierdut",
};

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE_NISSAN: "Website Nissan",
  WEBSITE_RENAULT: "Website Renault",
  WEBSITE_AUTORULATE: "Website Rulate",
  WEBSITE_SERVICE: "Website Service",
  PHONE: "Telefon",
  WALK_IN: "Walk-in",
  REFERRAL: "Recomandare",
  AUTOVIT: "Autovit",
  FACEBOOK: "Facebook",
  GOOGLE_ADS: "Google Ads",
  OTHER: "Altele",
};

const BRAND_BADGE_COLORS: Record<string, string> = {
  NISSAN: "border border-gray-900 text-gray-900 bg-transparent",
  RENAULT: "border border-gray-900 text-gray-900 bg-transparent",
  AUTORULATE: "border border-gray-900 text-gray-900 bg-transparent",
  SERVICE: "border border-gray-900 text-gray-900 bg-transparent",
};

const BRAND_SHORT_LABELS: Record<string, string> = {
  NISSAN: "Nissan",
  RENAULT: "Renault",
  AUTORULATE: "Rulate",
  SERVICE: "Service",
};

const STAGE_BORDER_COLORS: Record<string, string> = {
  "Lead Nou": "border-l-blue-500",
  Contactat: "border-l-violet-500",
  "Întâlnire Showroom": "border-l-amber-500",
  "Intalnire Showroom": "border-l-amber-500",
  "Test Drive Programat": "border-l-cyan-500",
  "Test Drive Efectuat": "border-l-cyan-700",
  "Ofertă Trimisă": "border-l-orange-500",
  Negociere: "border-l-red-500",
  "Vândut": "border-l-emerald-500",
  Pierdut: "border-l-gray-500",
};

const STATUS_MAP: Record<string, string> = {
  "Lead Nou": "NEW",
  "Contactat": "CONTACTED",
  "Întâlnire Showroom": "CONTACTED",
  "Intalnire Showroom": "CONTACTED",
  "Test Drive Programat": "CONTACTED",
  "Test Drive Efectuat": "CONTACTED",
  "Ofertă Trimisă": "NEGOTIATION",
  "Oferta Trimisa": "NEGOTIATION",
  "Negociere": "NEGOTIATION",
  "Vândut": "WON",
  "Vandut": "WON",
  "Pierdut": "LOST",
};

const ACTIVITY_LABELS: Record<string, string> = {
  CREATED: "Lead creat",
  NOTE: "Notă",
  CALL: "Apel",
  EMAIL: "Email",
  SMS: "SMS",
  MEETING: "Întâlnire",
  STAGE_CHANGE: "Mutare pipeline",
  TEST_DRIVE: "Test Drive",
  DOCUMENT: "Document",
};

// Inactivity thresholds (minutes)
const INACTIVITY_GREEN = 60;    // < 60 min = green
const INACTIVITY_YELLOW = 240;  // 60 min - 4h = yellow
// > 4h = red

function getInactivityLevel(createdAt: string): "green" | "yellow" | "red" {
  const mins = (Date.now() - new Date(createdAt).getTime()) / 60000;
  if (mins < INACTIVITY_GREEN) return "green";
  if (mins < INACTIVITY_YELLOW) return "yellow";
  return "red";
}

function getInactivityRing(level: "green" | "yellow" | "red") {
  switch (level) {
    case "green": return "ring-2 ring-green-400";
    case "yellow": return "ring-2 ring-amber-400";
    case "red": return "ring-2 ring-red-500";
  }
}

function getInactivityLabel(level: "green" | "yellow" | "red") {
  switch (level) {
    case "green": return { text: "Activ", cls: "text-green-600" };
    case "yellow": return { text: "Atenție", cls: "text-amber-500" };
    case "red": return { text: "Inactiv >4h", cls: "text-red-600" };
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hoursSince(d: string) {
  return (Date.now() - new Date(d).getTime()) / 3600000;
}

// ─── Move Pipeline Dropdown (shared) ───────────────────

const LOST_REASONS = [
  "Preț prea mare",
  "A ales concurența",
  "Nu mai este interesat",
  "Timing nepotrivit",
  "Mașina dorită nu este disponibilă",
  "Probleme cu finanțarea",
  "Alt motiv",
];

// ─── Centered Modal ────────────────────────────────────

function MoveModal({
  stageName,
  isLost,
  onConfirm,
  onCancel,
}: {
  stageName: string;
  isLost: boolean;
  onConfirm: (comment: string, lostReason?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [lostReasonCustom, setLostReasonCustom] = useState("");
  const [loading, setLoading] = useState(false);

  const finalReason = lostReason === "Alt motiv" ? lostReasonCustom.trim() : lostReason;
  const canConfirm = comment.trim() && (!isLost || finalReason);

  async function handleConfirm() {
    if (!canConfirm) return;
    setLoading(true);
    try {
      await onConfirm(comment.trim(), isLost ? finalReason : undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className={`relative w-full max-w-md rounded-lg shadow-xl p-5 space-y-4 ${isLost ? "bg-red-50 border border-red-200" : "bg-white"}`}>
        <h3 className="text-sm font-semibold">
          Mută în <span className={isLost ? "text-red-700" : "text-violet-700"}>{stageName}</span>
        </h3>

        {isLost && (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-500">Motivul pierderii *</label>
              <select
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              >
                <option value="">Selectează motivul...</option>
                {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {lostReason === "Alt motiv" && (
              <input
                value={lostReasonCustom}
                onChange={(e) => setLostReasonCustom(e.target.value)}
                placeholder="Specifică motivul..."
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
          </>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-500">Comentariu *</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Adaugă un comentariu..."
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            rows={3}
            autoFocus={!isLost}
          />
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors">
            Anulează
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className={`px-4 py-2 text-sm rounded-md text-white disabled:opacity-50 flex items-center gap-1.5 transition-colors ${isLost ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"}`}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Confirmă
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Move Pipeline Dropdown (shared) ───────────────────

function MoveDropdown({
  leadId,
  stages,
  currentStageName,
  brand,
  onMoved,
}: {
  leadId: string;
  stages: PipelineStage[];
  currentStageName?: string;
  brand: string;
  onMoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<{ id: string; name: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; dropUp: boolean } | null>(null);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 300;
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
      setDropdownPos({
        top: dropUp ? rect.top - 4 : rect.bottom + 4,
        left: Math.max(8, rect.right - 192), // 192px = w-48
        dropUp,
      });
    } else {
      setDropdownPos(null);
    }
  }, [open]);

  const filteredStages = stages
    .filter((s) => !s.brand || s.brand === brand)
    .filter((s) => s.name !== currentStageName);

  async function handleMoveConfirm(comment: string, lostReason?: string) {
    if (!pendingStage) return;
    const isLost = pendingStage.name === "Pierdut";
    const noteContent = isLost && lostReason
      ? `${comment}\n❌ Motiv pierdere: ${lostReason}`
      : comment;

    await fetch(`/api/leads/${leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteContent, type: "NOTE" }),
    });
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: STATUS_MAP[pendingStage.name] || "CONTACTED",
        pipelineStageId: pendingStage.id,
        ...(isLost && lostReason ? { lostReason } : {}),
      }),
    });
    setSuccess(true);
    setPendingStage(null);
    setTimeout(onMoved, 600);
  }

  if (success) {
    return (
      <div className="flex items-center gap-1 text-emerald-600 text-sm">
        <Check className="h-3.5 w-3.5" /> Mutat
      </div>
    );
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm font-medium hover:bg-muted transition-colors"
      >
        {currentStageName ? "Mută" : "Mută în pipeline"}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && dropdownPos && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[70] w-48 rounded-md border bg-white shadow-lg py-1 max-h-[300px] overflow-y-auto"
            style={{
              top: dropdownPos.dropUp ? "auto" : dropdownPos.top,
              bottom: dropdownPos.dropUp ? window.innerHeight - dropdownPos.top : "auto",
              left: dropdownPos.left,
            }}
          >
            {filteredStages.map((s) => (
              <button
                key={s.id}
                onClick={() => { setPendingStage({ id: s.id, name: s.name }); setOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                {s.name}
              </button>
            ))}
          </div>
        </>
      )}

      {pendingStage && (
        <MoveModal
          stageName={pendingStage.name}
          isLost={pendingStage.name === "Pierdut"}
          onConfirm={handleMoveConfirm}
          onCancel={() => setPendingStage(null)}
        />
      )}
    </div>
  );
}

// ─── Lead Card ─────────────────────────────────────────

function LeadCard({
  lead,
  stages,
  testDrive,
  showroom,
  onMoved,
  onSelect,
  showBrand,
}: {
  lead: Lead;
  stages: PipelineStage[];
  testDrive?: ActiveTestDrive | null;
  showroom?: ActiveShowroom | null;
  onMoved: (leadId: string) => void;
  onSelect: (leadId: string) => void;
  showBrand?: boolean;
}) {
  const inactivityLevel = getInactivityLevel(lead.createdAt);
  const inactivityRing = getInactivityRing(inactivityLevel);
  const inactivityLabel = getInactivityLabel(inactivityLevel);
  const [tdAction, setTdAction] = useState<"confirm" | "cancel" | "reschedule" | null>(null);
  const [tdLoading, setTdLoading] = useState(false);
  const [tdFeedback, setTdFeedback] = useState("");
  const [tdNewDate, setTdNewDate] = useState("");
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "AGENT";
  const userPermissions: string[] = ((session?.user as any)?.permissions as string[]) || [];
  const canApproveTD =
    userRole === "SUPER_ADMIN" ||
    userRole === "ADMIN" ||
    userRole === "MANAGER" ||
    (userRole === "AGENT" && userPermissions.includes("TEST_DRIVE_APPROVE"));

  async function handleTdAction() {
    if (!testDrive) return;
    if (tdAction === "cancel" && !tdFeedback.trim()) return;
    if (tdAction === "reschedule" && !tdNewDate) return;
    setTdLoading(true);
    try {
      if (tdAction === "confirm") {
        await fetch(`/api/test-drives/${testDrive.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CONFIRMED" }),
        });
        await fetch(`/api/leads/${lead.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `✅ Test drive confirmat.${tdFeedback ? ` ${tdFeedback}` : ""}`, type: "NOTE" }),
        });
        const tdStage = stages.find((s) => s.brand === lead.brand && s.name === "Test Drive Programat");
        if (tdStage) {
          await fetch(`/api/leads/${lead.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "QUALIFIED", pipelineStageId: tdStage.id }),
          });
        }
      } else if (tdAction === "reschedule") {
        await fetch(`/api/test-drives/${testDrive.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduledAt: tdNewDate }),
        });
        await fetch(`/api/leads/${lead.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `📅 Test drive reprogramat: ${new Date(tdNewDate).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}${tdFeedback ? `. ${tdFeedback}` : ""}`,
            type: "NOTE",
          }),
        });
      } else {
        await fetch(`/api/test-drives/${testDrive.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        });
        await fetch(`/api/leads/${lead.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `❌ Test drive anulat. ${tdFeedback}`, type: "NOTE" }),
        });
      }
      window.location.reload();
    } catch { /* ignore */ }
    finally { setTdLoading(false); }
  }

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${inactivityRing}`}
      onClick={() => onSelect(lead.id)}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium text-sm text-gray-900">
            <User className="h-3.5 w-3.5 text-gray-400" />
            {lead.customer.firstName} {lead.customer.lastName}
          </span>
          <div className="flex items-center gap-1">
            {LEAD_TYPE_CONFIG[lead.type] && (
              <span className={`inline-flex rounded-full px-2 py-0.5 text-sm font-medium ${LEAD_TYPE_CONFIG[lead.type].style}`}>
                {LEAD_TYPE_CONFIG[lead.type].label}
              </span>
            )}
            <span className={`inline-flex rounded-full px-2 py-0.5 text-sm font-medium ${BRAND_BADGE_COLORS[lead.brand] || "border border-gray-300 text-gray-700"}`}>
              {BRAND_SHORT_LABELS[lead.brand] || lead.brand}
            </span>
          </div>
        </div>

        {lead.vehicle && (
          <p className="mt-1 flex items-center gap-1.5 text-sm truncate" style={{ color: "#333" }}>
            <Car className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            {lead.vehicle.make.name} {lead.vehicle.model.name} {lead.vehicle.year}
            {(lead.vehicle.discountPrice || lead.vehicle.price) ? ` · ${(lead.vehicle.discountPrice || lead.vehicle.price)!.toLocaleString("ro-RO")} €` : ""}
          </p>
        )}

        {/* Test Drive section */}
        {testDrive && (
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between rounded-md bg-green-600 px-3 py-2">
              <span className="text-sm font-medium text-white">
                {new Date(testDrive.scheduledAt).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })} — {new Date(testDrive.scheduledAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {canApproveTD && (
                  <button
                    onClick={() => setTdAction("confirm")}
                    className="rounded-md bg-white hover:bg-green-50 text-green-600 px-3 py-1 transition-colors flex items-center gap-1"
                    title="Confirmă programarea"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span className="text-sm font-medium">Confirmă</span>
                  </button>
                )}
                <button
                  onClick={() => { setTdAction("reschedule"); setTdNewDate(""); setTdFeedback(""); }}
                  className="rounded-md bg-green-800 hover:bg-green-900 text-white p-1 transition-colors"
                  title="Modifică data"
                >
                  <Calendar className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setTdAction("cancel")}
                  className="rounded-md bg-red-600 hover:bg-red-700 text-white p-1 transition-colors"
                  title="Anulează"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {tdAction && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <div className="absolute inset-0 bg-black/50" onClick={() => { setTdAction(null); setTdFeedback(""); setTdNewDate(""); }} />
                <div className={`relative w-full max-w-md rounded-lg shadow-xl p-5 space-y-4 ${tdAction === "cancel" ? "bg-red-50 border border-red-200" : "bg-white"}`}>
                  <h3 className="text-sm font-semibold">
                    {tdAction === "confirm" ? "Confirmă programarea test drive"
                      : tdAction === "reschedule" ? "Modifică data test drive"
                      : "Anulează test drive"}
                  </h3>

                  {tdAction === "reschedule" && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Data și ora nouă *</label>
                      <input
                        type="datetime-local"
                        value={tdNewDate}
                        onChange={(e) => setTdNewDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        autoFocus
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-500">
                      {tdAction === "confirm" ? "Observații (opțional)"
                        : tdAction === "reschedule" ? "Motiv reprogramare (opțional)"
                        : "Motiv anulare *"}
                    </label>
                    <textarea
                      value={tdFeedback}
                      onChange={(e) => setTdFeedback(e.target.value)}
                      placeholder={tdAction === "confirm" ? "Observații..." : tdAction === "reschedule" ? "De ce se reprogramează..." : "Motiv anulare..."}
                      className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      rows={2}
                      autoFocus={tdAction !== "reschedule"}
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-1">
                    <button onClick={() => { setTdAction(null); setTdFeedback(""); setTdNewDate(""); }} className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors">
                      Înapoi
                    </button>
                    <button
                      onClick={handleTdAction}
                      disabled={tdLoading || (tdAction === "cancel" && !tdFeedback.trim()) || (tdAction === "reschedule" && !tdNewDate)}
                      className={`px-4 py-2 text-sm rounded-md text-white disabled:opacity-50 flex items-center gap-1.5 transition-colors ${
                        tdAction === "cancel" ? "bg-red-600 hover:bg-red-700"
                          : tdAction === "reschedule" ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {tdLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {tdAction === "confirm" ? "Confirmă" : tdAction === "reschedule" ? "Salvează" : "Anulează TD"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Showroom Appointment section */}
        {showroom && (
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between rounded-md bg-amber-500 px-3 py-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                <User className="h-3.5 w-3.5" />
                Showroom:{" "}
                {new Date(showroom.scheduledAt).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })} — {new Date(showroom.scheduledAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end mt-3 pt-2 border-t">
          <span
            className={`flex items-center gap-1 cursor-default mr-auto text-sm ${inactivityLabel.cls}`}
            title={`${inactivityLabel.text} — Adăugat pe ${formatDate(lead.createdAt)}`}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {(() => {
              const diff = Date.now() - new Date(lead.createdAt).getTime();
              const mins = Math.floor(diff / 60000);
              const hrs = Math.floor(mins / 60);
              const days = Math.floor(hrs / 24);
              const remHrs = hrs % 24;
              const remMins = mins % 60;
              if (days > 0) return `${days}z ${remHrs}h ${remMins}m`;
              if (hrs > 0) return `${hrs}h ${remMins}m`;
              return `${mins}m`;
            })()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Sigur dorești să ștergi acest lead?")) {
                  fetch(`/api/leads/${lead.id}`, { method: "DELETE" }).then(() => onMoved(lead.id));
                }
              }}
              className="text-sm text-red-500 hover:text-red-700 transition-colors"
            >
              Șterge
            </button>
            <MoveDropdown
              leadId={lead.id}
              stages={stages}
              brand={lead.brand}
              onMoved={() => onMoved(lead.id)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Pipeline Deal Card ────────────────────────────────

function PipelineDealCard({
  deal,
  stageName,
  stages,
  showBrandBadge,
  dealBrand,
  inactivityLevel,
  onSelect,
  onMoved,
}: {
  deal: PipelineStage["deals"][0];
  stageName: string;
  stages: PipelineStage[];
  showBrandBadge: boolean;
  dealBrand: string | null;
  inactivityLevel: "green" | "yellow" | "red";
  onSelect: (leadId: string) => void;
  onMoved: () => void;
}) {
  const ring = getInactivityRing(inactivityLevel);
  const label = getInactivityLabel(inactivityLevel);
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${ring}`}
      onClick={() => onSelect(deal.lead.id)}
    >
      <CardContent className="p-5">
        {inactivityLevel === "red" && (
          <div className={`flex items-center gap-1 text-sm mb-1 ${label.cls}`}>
            <AlertTriangle className="h-3 w-3" />
            {label.text}
          </div>
        )}
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium">
            {deal.lead.customer.firstName} {deal.lead.customer.lastName}
          </p>
          {showBrandBadge && dealBrand && (
            <Badge className={`text-sm px-1.5 ${BRAND_BADGE_COLORS[dealBrand] || ""}`}>
              {BRAND_SHORT_LABELS[dealBrand] || dealBrand}
            </Badge>
          )}
        </div>
        {deal.lead.vehicle && (
          <p className="text-sm text-gray-500 truncate">
            {deal.lead.vehicle.make.name} {deal.lead.vehicle.model.name}
            {(deal.lead.vehicle.discountPrice || deal.lead.vehicle.price) ? ` — ${((deal.lead.vehicle.discountPrice || deal.lead.vehicle.price) as number).toLocaleString("ro-RO")} €` : ""}
          </p>
        )}
        {(deal.lead as Record<string, unknown>).additionalVehicles && ((deal.lead as Record<string, unknown>).additionalVehicles as { make: { name: string }; model: { name: string }; price: number | null; discountPrice: number | null }[]).map((v, i) => (
          <p key={i} className="text-sm text-gray-500 truncate">
            {v.make.name} {v.model.name}
            {(v.discountPrice || v.price) ? ` — ${(v.discountPrice || v.price)!.toLocaleString("ro-RO")} €` : ""}
          </p>
        ))}
        {deal.assignedTo && (
          <p className="mt-1 text-sm text-gray-500">
            Agent: {deal.assignedTo.firstName} {deal.assignedTo.lastName}
          </p>
        )}
        <div className="mt-2 pt-2 border-t flex items-center justify-between">
          {LEAD_TYPE_CONFIG[deal.lead.type] ? (
            <span className={`inline-flex rounded-full px-2 py-0.5 text-sm font-medium ${LEAD_TYPE_CONFIG[deal.lead.type].style}`}>
              {LEAD_TYPE_CONFIG[deal.lead.type].label}
            </span>
          ) : <span />}
          <MoveDropdown
            leadId={deal.lead.id}
            stages={stages}
            currentStageName={stageName}
            brand={dealBrand || ""}
            onMoved={onMoved}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Lead Detail Overlay ───────────────────────────────

interface LeadDetail {
  id: string;
  status: string;
  source: string;
  brand: string;
  priority: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    source: string | null;
  };
  vehicle: {
    id: string;
    title: string | null;
    year: number;
    make: { name: string };
    model: { name: string };
    images: { url: string }[];
  } | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  deals: {
    id: string;
    value: number | null;
    currency: string;
    probability: number;
    stage: { name: string; color: string };
  }[];
  activities: {
    id: string;
    type: string;
    content: string;
    createdAt: string;
    user: { firstName: string; lastName: string } | null;
  }[];
  additionalVehicleIds: string[];
  testDrives: {
    id: string;
    status: string;
    scheduledAt: string;
    duration: number;
    contactName: string | null;
    contactPhone: string | null;
    feedback: string | null;
    notes: string | null;
    vehicle: { id: string; title: string | null; make: { name: string }; model: { name: string } } | null;
  }[];
  additionalVehicles: {
    id: string;
    title: string | null;
    year: number;
    make: { name: string };
    model: { name: string };
    images: { url: string }[];
  }[];
}

function LeadDetailOverlay({
  leadId,
  stages,
  agents,
  onClose,
  onCustomerClick,
  onLeadUpdated,
}: {
  leadId: string;
  stages: PipelineStage[];
  agents: Agent[];
  onClose: () => void;
  onCustomerClick?: (customerId: string) => void;
  onLeadUpdated?: () => void;
}) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [assigningAgent, setAssigningAgent] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<{ testDrives: unknown[]; leads: unknown[] } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [vSearch, setVSearch] = useState("");
  const [vResults, setVResults] = useState<{ id: string; title: string | null; make: { name: string }; model: { name: string }; year: number; price: number | null; discountPrice: number | null; currency: string }[]>([]);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [custForm, setCustForm] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [savingAdminNote, setSavingAdminNote] = useState(false);
  // TD confirm with agent
  const [tdConfirmingId, setTdConfirmingId] = useState<string | null>(null);
  const [tdConfirmAgent, setTdConfirmAgent] = useState("");
  // TD scheduler
  const [tdScheduling, setTdScheduling] = useState(false);
  const [tdReschedulingId, setTdReschedulingId] = useState<string | null>(null); // TD id being rescheduled
  const [tdRescheduleVehicleId, setTdRescheduleVehicleId] = useState<string | null>(null);
  const [tdSelectedVehicle, setTdSelectedVehicle] = useState<string | null>(null);
  const [tdSelectedDate, setTdSelectedDate] = useState<Date | null>(null);
  const [tdCalendarMonth, setTdCalendarMonth] = useState(new Date());
  const [tdSlots, setTdSlots] = useState<string[]>([]);
  const [tdLoadingSlots, setTdLoadingSlots] = useState(false);
  const [tdSelectedTime, setTdSelectedTime] = useState<string | null>(null);
  const [tdSaving, setTdSaving] = useState(false);

  const fetchLead = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      const data = await res.json();
      if (data.success) {
        setLead(data.data);
        setAdminNote(data.data.adminNotes || "");
        if (data.data.followUpAt) {
          setFollowUpDate(data.data.followUpAt.split("T")[0]);
          setFollowUpNote(data.data.followUpNote || "");
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [leadId]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

  // Fetch customer history when lead loads
  useEffect(() => {
    if (!lead?.customer?.id) return;
    setLoadingHistory(true);
    fetch(`/api/customers/${lead.customer.id}/history`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setCustomerHistory(d.data); })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [lead?.customer?.id]);

  async function addComment() {
    if (!comment.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment, type: "NOTE" }),
      });
      const data = await res.json();
      if (data.success) {
        setLead((prev) => prev ? { ...prev, activities: [data.data, ...prev.activities] } : prev);
        setComment("");
      }
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  // Vehicle search in overlay
  useEffect(() => {
    if (vSearch.length < 2) { setVResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const brand = lead?.brand || "";
        const res = await fetch(`/api/vehicles?search=${encodeURIComponent(vSearch)}&brand=${brand}&limit=8`);
        const data = await res.json();
        setVResults(data.vehicles || []);
      } catch { setVResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [vSearch, lead?.brand]);

  async function updateVehicle(vehicleId: string | null) {
    setSavingVehicle(true);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId }),
      });
      await fetchLead();
      setEditingVehicle(false);
      setVSearch("");
      setVResults([]);
      onLeadUpdated?.();
    } catch { /* ignore */ }
    finally { setSavingVehicle(false); }
  }

  async function scheduleTestDriveFromOverlay(date: string) {
    if (!lead || !lead.vehicle) return;
    setSavingVehicle(true);
    try {
      await fetch("/api/test-drives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: lead.vehicle.id,
          customerId: lead.customer.id,
          scheduledAt: date,
          duration: 30,
          brand: lead.brand,
          contactName: `${lead.customer.firstName} ${lead.customer.lastName}`,
          contactPhone: lead.customer.phone,
          contactEmail: lead.customer.email,
          notes: `[CRM] Programat din lead overlay`,
        }),
      });
      // Log activity
      await fetch(`/api/leads/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `📅 Test drive programat: ${new Date(date).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
          type: "TEST_DRIVE",
        }),
      });
      await fetchLead();
    } catch { /* ignore */ }
    finally { setSavingVehicle(false); }
  }

  async function assignAgent(agentId: string | null) {
    setAssigningAgent(true);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: agentId }),
      });
      await fetchLead();
      onLeadUpdated?.();
    } catch { /* ignore */ }
    finally { setAssigningAgent(false); }
  }

  async function saveFollowUp() {
    if (!followUpDate || !followUpNote.trim()) return;
    setSavingFollowUp(true);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followUpAt: new Date(followUpDate).toISOString(),
          followUpNote: followUpNote.trim(),
        }),
      });
      // Also log activity
      await fetch(`/api/leads/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `Follow-up programat: ${followUpDate} — ${followUpNote.trim()}`,
          type: "NOTE",
        }),
      });
      await fetchLead();
      setShowFollowUp(false);
    } catch { /* ignore */ }
    finally { setSavingFollowUp(false); }
  }

  async function saveAdminNote() {
    setSavingAdminNote(true);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: adminNote.trim() || null }),
      });
      await fetchLead();
    } catch { /* ignore */ }
    finally { setSavingAdminNote(false); }
  }

  const currentStageName = lead?.deals?.[0]?.stage?.name;
  const availableStages = lead ? stages.filter((s) => !s.brand || s.brand === lead.brand) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4 rounded-t-xl">
          <h2 className="text-base font-semibold">Detalii Lead</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-gray-500" /></div>
        ) : !lead ? (
          <div className="p-6 text-center text-gray-500">Lead-ul nu a fost găsit.</div>
        ) : (
          <div className="p-4 space-y-5">
            {/* Customer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Client</h3>
                {!editingCustomer && (
                  <button
                    onClick={() => {
                      setCustForm({
                        firstName: lead.customer.firstName,
                        lastName: lead.customer.lastName,
                        phone: lead.customer.phone || "",
                        email: lead.customer.email || "",
                      });
                      setEditingCustomer(true);
                    }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Schimbă
                  </button>
                )}
              </div>
              {editingCustomer ? (
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm text-gray-500">Prenume</label>
                      <input
                        className="w-full rounded-md border px-2 py-1.5 text-sm"
                        value={custForm.firstName}
                        onChange={(e) => setCustForm((p) => ({ ...p, firstName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Nume</label>
                      <input
                        className="w-full rounded-md border px-2 py-1.5 text-sm"
                        value={custForm.lastName}
                        onChange={(e) => setCustForm((p) => ({ ...p, lastName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Telefon</label>
                    <input
                      className="w-full rounded-md border px-2 py-1.5 text-sm"
                      value={custForm.phone}
                      onChange={(e) => setCustForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Email</label>
                    <input
                      className="w-full rounded-md border px-2 py-1.5 text-sm"
                      value={custForm.email}
                      onChange={(e) => setCustForm((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={savingCustomer}
                      onClick={async () => {
                        setSavingCustomer(true);
                        try {
                          await fetch(`/api/customers/${lead.customer.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(custForm),
                          });
                          await fetchLead();
                          setEditingCustomer(false);
                          onLeadUpdated?.();
                        } catch {}
                        setSavingCustomer(false);
                      }}
                      className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800"
                    >
                      {savingCustomer ? "..." : "Salvează"}
                    </button>
                    <button
                      onClick={() => setEditingCustomer(false)}
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      Anulează
                    </button>
                  </div>
                </div>
              ) : (
              <div
                className="rounded-lg border p-3 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onCustomerClick?.(lead.customer.id)}
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="font-medium text-sm text-gray-900">
                    {lead.customer.firstName} {lead.customer.lastName}
                  </span>
                </div>
                {lead.customer.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-3.5 w-3.5" />{lead.customer.phone}
                  </div>
                )}
                {lead.customer.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-3.5 w-3.5" />{lead.customer.email}
                  </div>
                )}
                {lead.notes && (() => {
                  // Extract client message from notes
                  const lines = lead.notes!.split("\n");
                  const msgLine = lines.find((l: string) => l.startsWith("Mesaj:"));
                  const msg = msgLine ? msgLine.replace("Mesaj: ", "").trim() : null;
                  if (!msg) return null;
                  return (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-sm text-gray-500 mb-1">Mesajul clientului:</p>
                      <p className="text-sm text-gray-700 italic">&ldquo;{msg}&rdquo;</p>
                    </div>
                  );
                })()}
              </div>
              )}
            </div>

            {/* Vehicles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Interesat de</h3>
                {!editingVehicle && (
                  <button onClick={() => setEditingVehicle(true)} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Adaugă mașină
                  </button>
                )}
              </div>

              {/* Primary vehicle */}
              {lead.vehicle && !editingVehicle && (
                <div className="flex items-center gap-2">
                  <Link href={`/inventory/${lead.vehicle.id}/edit`} className="flex-1 block rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {lead.vehicle.images?.[0] && <img src={lead.vehicle.images[0].url} alt="" className="h-14 w-20 rounded-md object-cover" />}
                      <div>
                        <p className="font-medium text-sm">{lead.vehicle.title || `${lead.vehicle.make.name} ${lead.vehicle.model.name}`}</p>
                        <p className="text-sm text-gray-500">An: {lead.vehicle.year}</p>
                      </div>
                    </div>
                  </Link>
                  <button onClick={() => updateVehicle(null)} className="shrink-0 rounded-md p-1.5 text-red-500 hover:bg-red-50" title="Șterge">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Additional vehicles */}
              {(lead.additionalVehicles as typeof lead.vehicle[])?.map((v: typeof lead.vehicle) => v && (
                <div key={v.id} className="flex items-center gap-2">
                  <Link href={`/inventory/${v.id}/edit`} className="flex-1 block rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {v.images?.[0] && <img src={v.images[0].url} alt="" className="h-14 w-20 rounded-md object-cover" />}
                      <div>
                        <p className="font-medium text-sm">{v.title || `${v.make.name} ${v.model.name}`}</p>
                        <p className="text-sm text-gray-500">An: {v.year}</p>
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={async () => {
                      const newIds = (lead.additionalVehicleIds || []).filter((id: string) => id !== v.id);
                      await fetch(`/api/leads/${lead.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ additionalVehicleIds: newIds }),
                      });
                      fetchLead();
                      onLeadUpdated?.();
                    }}
                    className="shrink-0 rounded-md p-1.5 text-red-500 hover:bg-red-50" title="Șterge"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {editingVehicle && (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                    <input
                      value={vSearch}
                      onChange={(e) => setVSearch(e.target.value)}
                      placeholder="Caută mașină..."
                      className="w-full rounded-md border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      autoFocus
                    />
                  </div>
                  {vResults.length > 0 && (
                    <div className="rounded-md border max-h-48 overflow-y-auto">
                      {vResults.map((v) => (
                        <button key={v.id} onClick={async () => {
                          // If no primary vehicle, set as primary
                          if (!lead.vehicle) {
                            await updateVehicle(v.id);
                          } else {
                            // Add to additional vehicles
                            const currentIds = lead.additionalVehicleIds || [];
                            if (!currentIds.includes(v.id) && v.id !== lead.vehicle?.id) {
                              const res = await fetch(`/api/leads/${lead.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ additionalVehicleIds: [...currentIds, v.id] }),
                              });
                              if (res.ok) {
                                await fetchLead();
                                onLeadUpdated?.();
                              }
                            }
                          }
                          setEditingVehicle(false);
                          setVSearch("");
                          setVResults([]);
                        }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between border-b last:border-0">
                          <span>{v.make.name} {v.model.name} {v.year}</span>
                          {(v.discountPrice || v.price) && (
                            <span className="text-sm text-gray-500">{(v.discountPrice || v.price)!.toLocaleString("ro-RO")} {v.currency}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setEditingVehicle(false); setVSearch(""); setVResults([]); }}
                    className="text-sm text-gray-500 hover:underline">Anulează</button>
                </div>
              )}

              {!lead.vehicle && !editingVehicle && (
                <p className="text-sm text-gray-500 italic">Nicio mașină selectată.</p>
              )}
            </div>

            {/* Test Drive section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Test Drive</h3>

              {/* Existing test drives (hide cancelled/no-show) */}
              {lead.testDrives && lead.testDrives.filter((td) => !["CANCELLED", "NO_SHOW"].includes(td.status)).length > 0 ? (
                <div className="space-y-2">
                  {lead.testDrives.filter((td) => !["CANCELLED", "NO_SHOW"].includes(td.status)).map((td) => {
                    const isActive = ["SCHEDULED", "CONFIRMED"].includes(td.status);
                    const statusLabel: Record<string, string> = {
                      SCHEDULED: "Neconfirmat",
                      CONFIRMED: "Confirmat",
                      COMPLETED: "Efectuat",
                      CANCELLED: "Anulat",
                      NO_SHOW: "Neprezentare",
                    };
                    const statusColor: Record<string, string> = {
                      SCHEDULED: "bg-amber-100 text-amber-700",
                      CONFIRMED: "bg-green-100 text-green-700",
                      COMPLETED: "bg-blue-100 text-blue-700",
                      CANCELLED: "bg-red-100 text-red-700",
                      NO_SHOW: "bg-gray-100 text-gray-700",
                    };
                    return (
                      <div key={td.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Car className="h-4 w-4 text-gray-400 shrink-0" />
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {td.vehicle ? (td.vehicle.title || `${td.vehicle.make.name} ${td.vehicle.model.name}`) : "—"}
                            </span>
                            <span className="text-sm text-gray-500 shrink-0">
                              {new Date(td.scheduledAt).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })} · {new Date(td.scheduledAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {isActive && tdReschedulingId !== td.id && (
                            <div className="flex items-center gap-1 shrink-0">
                              {td.status === "SCHEDULED" && (
                                <button
                                  onClick={() => { setTdConfirmingId(td.id); setTdConfirmAgent(""); }}
                                  className="rounded-md bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm flex items-center gap-1"
                                  title="Confirmă"
                                >
                                  <Check className="h-3 w-3" /> Confirmă
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setTdReschedulingId(td.id);
                                  setTdRescheduleVehicleId(td.vehicle?.id || null);
                                  setTdSelectedDate(null);
                                  setTdSelectedTime(null);
                                  setTdSlots([]);
                                  setTdCalendarMonth(new Date());
                                }}
                                className="rounded-md bg-gray-800 hover:bg-gray-900 text-white p-1 text-sm"
                                title="Modifică data"
                              >
                                <Calendar className="h-3 w-3" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm("Sigur vrei să anulezi acest test drive?")) {
                                    await fetch(`/api/test-drives/${td.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ status: "CANCELLED", feedback: "Anulat de agent" }),
                                    });
                                    await fetchLead();
                                    onLeadUpdated?.();
                                  }
                                }}
                                className="rounded-md bg-red-600 hover:bg-red-700 text-white p-1 text-sm"
                                title="Anulează"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Confirm with agent */}
                        {tdConfirmingId === td.id && (
                          <div className="mt-2 rounded-lg border bg-green-50 p-3 space-y-2">
                            <p className="text-sm font-medium text-green-800">Alege agentul responsabil:</p>
                            <select
                              value={tdConfirmAgent}
                              onChange={(e) => setTdConfirmAgent(e.target.value)}
                              className="w-full rounded-md border px-3 py-1.5 text-sm"
                            >
                              <option value="">— Selectează agent —</option>
                              {agents.map((a) => (
                                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button
                                disabled={!tdConfirmAgent}
                                onClick={async () => {
                                  await fetch(`/api/test-drives/${td.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ status: "CONFIRMED", agentId: tdConfirmAgent }),
                                  });
                                  setTdConfirmingId(null);
                                  await fetchLead();
                                  onLeadUpdated?.();
                                }}
                                className="rounded-md bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                              >
                                Confirmă
                              </button>
                              <button
                                onClick={() => setTdConfirmingId(null)}
                                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                              >
                                Anulează
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Reschedule calendar inline */}
                        {tdReschedulingId === td.id && (() => {
                          const vId = tdRescheduleVehicleId;
                          const fetchRescheduleSlots = async (date: Date) => {
                            if (!vId) return;
                            setTdLoadingSlots(true);
                            setTdSelectedTime(null);
                            try {
                              const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                              const res = await fetch(`/api/test-drives/slots?vehicleId=${vId}&date=${dateStr}`);
                              if (res.ok) { const json = await res.json(); const slots = (json.data?.slots || json.slots || []).filter((s: { available?: boolean }) => s.available !== false).map((s: { time: string }) => s.time); setTdSlots(slots); }
                            } catch { setTdSlots([]); }
                            setTdLoadingSlots(false);
                          };
                          const today2 = new Date(); today2.setHours(0,0,0,0);
                          const maxD = new Date(today2); maxD.setDate(maxD.getDate() + 30);
                          const y2 = tdCalendarMonth.getFullYear(), m2 = tdCalendarMonth.getMonth();
                          const fd = new Date(y2, m2, 1).getDay();
                          const dim = new Date(y2, m2 + 1, 0).getDate();
                          const so = fd === 0 ? 6 : fd - 1;
                          return (
                            <div className="mt-2 rounded-lg border bg-gray-50 p-3 space-y-3">
                              <p className="text-sm font-medium text-gray-700">Modifică data și ora:</p>
                              {/* Calendar */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <button onClick={() => setTdCalendarMonth(new Date(y2, m2 - 1, 1))} className="p-1 rounded hover:bg-muted text-sm">&larr;</button>
                                  <span className="text-sm font-medium capitalize">{tdCalendarMonth.toLocaleDateString("ro-RO", { month: "long", year: "numeric" })}</span>
                                  <button onClick={() => setTdCalendarMonth(new Date(y2, m2 + 1, 1))} className="p-1 rounded hover:bg-muted text-sm">&rarr;</button>
                                </div>
                                <div className="grid grid-cols-7 gap-1 text-center text-sm">
                                  {["Lu","Ma","Mi","Jo","Vi","Sâ","Du"].map((d) => <span key={d} className="text-gray-500 font-medium py-0.5">{d}</span>)}
                                  {Array.from({ length: so }).map((_, i) => <span key={`e-${i}`} />)}
                                  {Array.from({ length: dim }).map((_, i) => {
                                    const day = i + 1;
                                    const dd = new Date(y2, m2, day); dd.setHours(0,0,0,0);
                                    const isPast = dd < today2;
                                    const isFar = dd > maxD;
                                    const isSel = tdSelectedDate?.getDate() === day && tdSelectedDate?.getMonth() === m2 && tdSelectedDate?.getFullYear() === y2;
                                    return (
                                      <button key={day} disabled={isPast || isFar}
                                        onClick={() => { setTdSelectedDate(dd); fetchRescheduleSlots(dd); }}
                                        className={`py-1 rounded text-sm ${isSel ? "bg-gray-900 text-white" : isPast || isFar ? "text-gray-300" : "hover:bg-muted"}`}
                                      >{day}</button>
                                    );
                                  })}
                                </div>
                              </div>
                              {/* Slots */}
                              {tdSelectedDate && (
                                <div>
                                  <p className="text-sm text-gray-500 mb-1">Ore disponibile — {tdSelectedDate.toLocaleDateString("ro-RO", { day: "numeric", month: "long" })}</p>
                                  {tdLoadingSlots ? <Loader2 className="h-4 w-4 animate-spin text-gray-500 mx-auto" /> :
                                    tdSlots.length === 0 ? <p className="text-sm text-red-500 italic">Niciun slot disponibil.</p> : (
                                      <div className="grid grid-cols-4 gap-1">
                                        {tdSlots.map((s) => (
                                          <button key={s} onClick={() => setTdSelectedTime(s)}
                                            className={`py-1 rounded text-sm ${tdSelectedTime === s ? "bg-gray-900 text-white" : "border hover:bg-muted"}`}
                                          >{s}</button>
                                        ))}
                                      </div>
                                    )}
                                </div>
                              )}
                              <div className="flex gap-2">
                                {tdSelectedTime && (
                                  <button onClick={async () => {
                                    const dateStr = `${tdSelectedDate!.getFullYear()}-${String(tdSelectedDate!.getMonth() + 1).padStart(2, "0")}-${String(tdSelectedDate!.getDate()).padStart(2, "0")}`;
                                    await fetch(`/api/test-drives/${td.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ scheduledAt: new Date(`${dateStr}T${tdSelectedTime}:00`).toISOString() }),
                                    });
                                    setTdReschedulingId(null);
                                    await fetchLead();
                                    onLeadUpdated?.();
                                  }} className="rounded-md bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm font-medium">
                                    Salvează
                                  </button>
                                )}
                                <button onClick={() => { setTdReschedulingId(null); setTdSelectedDate(null); setTdSelectedTime(null); setTdSlots([]); }}
                                  className="rounded-md border px-3 py-1 text-sm hover:bg-muted">Anulează</button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">Niciun test drive programat.</p>
              )}

              {/* Schedule new test drive */}
              {(() => {
                // Collect vehicles without active test drives
                const activeTdVehicleIds = new Set(
                  (lead.testDrives || [])
                    .filter((td) => ["SCHEDULED", "CONFIRMED"].includes(td.status))
                    .map((td) => td.vehicle?.id)
                    .filter(Boolean)
                );
                const allVehicles: { id: string; label: string }[] = [];
                if (lead.vehicle && !activeTdVehicleIds.has(lead.vehicle.id)) {
                  allVehicles.push({ id: lead.vehicle.id, label: lead.vehicle.title || `${lead.vehicle.make.name} ${lead.vehicle.model.name}` });
                }
                if (lead.additionalVehicles) {
                  (lead.additionalVehicles as typeof lead.vehicle[]).forEach((v) => {
                    if (v && !allVehicles.find((av) => av.id === v.id) && !activeTdVehicleIds.has(v.id)) {
                      allVehicles.push({ id: v.id, label: v.title || `${v.make.name} ${v.model.name}` });
                    }
                  });
                }
                if (allVehicles.length === 0) return null;

                // Auto-select if only one vehicle
                const effectiveVehicle = allVehicles.length === 1 ? allVehicles[0].id : tdSelectedVehicle;

                const fetchSlots = async (vehicleId: string, date: Date) => {
                  setTdLoadingSlots(true);
                  setTdSelectedTime(null);
                  try {
                    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                    const res = await fetch(`/api/test-drives/slots?vehicleId=${vehicleId}&date=${dateStr}`);
                    if (res.ok) {
                      const data = await res.json();
                      const slots2 = (data.data?.slots || data.slots || []).filter((s: { available?: boolean }) => s.available !== false).map((s: { time: string }) => s.time); setTdSlots(slots2);
                    }
                  } catch { setTdSlots([]); }
                  setTdLoadingSlots(false);
                };

                const handleSave = async () => {
                  if (!effectiveVehicle || !tdSelectedDate || !tdSelectedTime || !lead) return;
                  setTdSaving(true);
                  const dateStr = `${tdSelectedDate.getFullYear()}-${String(tdSelectedDate.getMonth() + 1).padStart(2, "0")}-${String(tdSelectedDate.getDate()).padStart(2, "0")}`;
                  try {
                    await fetch("/api/test-drives", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        vehicleId: effectiveVehicle,
                        customerId: lead.customer.id,
                        scheduledAt: `${dateStr}T${tdSelectedTime}:00`,
                        brand: lead.brand,
                        contactName: `${lead.customer.firstName} ${lead.customer.lastName}`,
                        contactPhone: lead.customer.phone,
                        contactEmail: lead.customer.email,
                        status: "CONFIRMED",
                        adminOverride: true,
                      }),
                    });
                    setTdScheduling(false);
                    setTdSelectedVehicle(null);
                    setTdSelectedDate(null);
                    setTdSelectedTime(null);
                    setTdSlots([]);
                    await fetchLead();
                    onLeadUpdated?.();
                  } catch { /* ignore */ }
                  setTdSaving(false);
                };

                // Calendar helpers
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const maxDate = new Date(today);
                maxDate.setDate(maxDate.getDate() + 30);
                const year = tdCalendarMonth.getFullYear();
                const month = tdCalendarMonth.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Monday first

                return (
                  <>
                    {!tdScheduling ? (
                      <button
                        onClick={() => {
                          setTdScheduling(true);
                          setTdSelectedVehicle(allVehicles.length === 1 ? allVehicles[0].id : null);
                          setTdCalendarMonth(new Date());
                        }}
                        className="w-full rounded-lg border border-dashed p-3 text-sm text-gray-500 hover:bg-muted/50 hover:text-gray-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="h-4 w-4" /> Programează test drive
                      </button>
                    ) : (
                      <div className="rounded-lg border p-4 space-y-3">
                        {/* Step 1: Choose vehicle if multiple */}
                        {allVehicles.length > 1 && (
                          <div>
                            <label className="text-sm text-gray-500 mb-1 block">Alege mașina</label>
                            <div className="space-y-1">
                              {allVehicles.map((v) => (
                                <button
                                  key={v.id}
                                  onClick={() => { setTdSelectedVehicle(v.id); setTdSelectedDate(null); setTdSelectedTime(null); setTdSlots([]); }}
                                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${effectiveVehicle === v.id ? "bg-gray-900 text-white" : "border hover:bg-muted"}`}
                                >
                                  {v.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Step 2: Calendar */}
                        {effectiveVehicle && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <button onClick={() => setTdCalendarMonth(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-muted">&larr;</button>
                              <span className="text-sm font-medium capitalize">
                                {tdCalendarMonth.toLocaleDateString("ro-RO", { month: "long", year: "numeric" })}
                              </span>
                              <button onClick={() => setTdCalendarMonth(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-muted">&rarr;</button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-center text-sm">
                              {["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"].map((d) => (
                                <span key={d} className="text-gray-500 font-medium py-1">{d}</span>
                              ))}
                              {Array.from({ length: startOffset }).map((_, i) => <span key={`e-${i}`} />)}
                              {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const d = new Date(year, month, day);
                                d.setHours(0, 0, 0, 0);
                                const isPast = d < today;
                                const isTooFar = d > maxDate;
                                const isSelected = tdSelectedDate?.getDate() === day && tdSelectedDate?.getMonth() === month && tdSelectedDate?.getFullYear() === year;
                                const isDisabled = isPast || isTooFar;
                                return (
                                  <button
                                    key={day}
                                    disabled={isDisabled}
                                    onClick={() => { setTdSelectedDate(d); fetchSlots(effectiveVehicle!, d); }}
                                    className={`py-1.5 rounded-md text-sm transition-colors ${isSelected ? "bg-gray-900 text-white" : isDisabled ? "text-gray-300" : "hover:bg-muted"}`}
                                  >
                                    {day}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Step 3: Time slots */}
                        {tdSelectedDate && (
                          <div>
                            <p className="text-sm text-gray-500 mb-2">
                              Ore disponibile — {tdSelectedDate.toLocaleDateString("ro-RO", { day: "numeric", month: "long" })}
                            </p>
                            {tdLoadingSlots ? (
                              <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-gray-500" /></div>
                            ) : tdSlots.length === 0 ? (
                              <p className="text-sm text-red-500 italic">Niciun slot disponibil în această zi.</p>
                            ) : (
                              <div className="grid grid-cols-4 gap-1.5">
                                {tdSlots.map((slot) => (
                                  <button
                                    key={slot}
                                    onClick={() => setTdSelectedTime(slot)}
                                    className={`py-1.5 rounded-md text-sm transition-colors ${tdSelectedTime === slot ? "bg-gray-900 text-white" : "border hover:bg-muted"}`}
                                  >
                                    {slot}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                          {tdSelectedTime && (
                            <button
                              onClick={handleSave}
                              disabled={tdSaving}
                              className="rounded-md bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
                            >
                              {tdSaving ? "..." : "Confirmă programarea"}
                            </button>
                          )}
                          <button
                            onClick={() => { setTdScheduling(false); setTdSelectedVehicle(null); setTdSelectedDate(null); setTdSelectedTime(null); setTdSlots([]); }}
                            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                          >
                            Anulează
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Activity Timeline */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Activitate</h3>
              <div className="flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && addComment()}
                  placeholder="Adaugă un comentariu..."
                  className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={sending}
                />
                <Button size="sm" onClick={addComment} disabled={sending || !comment.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>

              <div className="space-y-0 mt-2">
                {lead.activities.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Nicio activitate încă.</p>
                ) : lead.activities.map((activity, idx) => {
                  const isStageChange = activity.type === "STAGE_CHANGE";
                  const isCreated = activity.type === "CREATED";
                  const IconMap: Record<string, typeof FileText> = {
                    CREATED: Plus, NOTE: FileText, CALL: PhoneCall, EMAIL: MailIcon, MEETING: Calendar, STAGE_CHANGE: ArrowRight,
                  };
                  const Icon = IconMap[activity.type] || MessageSquare;
                  return (
                    <div key={activity.id} className="flex gap-3 relative pb-4">
                      {idx < lead.activities.length - 1 && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />}
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isCreated ? "bg-emerald-100 text-emerald-600" : isStageChange ? "bg-violet-100 text-violet-600" : "bg-muted text-gray-500"}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">{activity.user ? `${activity.user.firstName} ${activity.user.lastName}` : "Sistem"}</span>
                          <span className="text-sm text-gray-500 shrink-0">{formatDate(activity.createdAt)}</span>
                        </div>
                        <p className={`text-sm mt-0.5 ${isStageChange ? "text-violet-700 font-medium" : ""}`}>
                          {isStageChange && "→ "}{activity.content}
                        </p>
                        <span className="text-sm text-gray-500">{ACTIVITY_LABELS[activity.type] || activity.type}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lead info */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Lead</h3>
              <div className="rounded-lg border p-3 space-y-2">
                {/* Row 1: Status / Brand / Tip / Sursa / Creat */}
                <div className="flex items-center gap-4 text-sm">
                  <div><span className="text-gray-500 text-sm">Status</span> <span className="block font-medium text-gray-900">{STATUS_LABELS[lead.status]}</span></div>
                  <div><span className="text-gray-500 text-sm">Brand</span> <span className="block font-medium text-gray-900">{BRAND_SHORT_LABELS[lead.brand] || lead.brand}</span></div>
                  <div><span className="text-gray-500 text-sm">Tip</span> <span className="block font-medium text-gray-900">{LEAD_TYPE_CONFIG[lead.type]?.label || lead.type}</span></div>
                  <div><span className="text-gray-500 text-sm">Sursa</span> <span className="block font-medium text-gray-900">{SOURCE_LABELS[lead.source] || lead.source}</span></div>
                  <div><span className="text-gray-500 text-sm">Creat</span> <span className="block font-medium text-gray-900">{formatDate(lead.createdAt)}</span></div>
                </div>

                {/* Row 1b: UTM Tracking (only if present) */}
                {(() => {
                  const notes = lead.notes || "";
                  const trackMatch = notes.match(/📊\s*Tracking:\s*([^\n]+)/);
                  if (!trackMatch) return null;
                  const trackStr = trackMatch[1];
                  const parts: Record<string, string> = {};
                  trackStr.split(",").forEach((p: string) => {
                    const [k, v] = p.split(":").map((s: string) => s.trim());
                    if (k && v) parts[k.toLowerCase()] = v;
                  });
                  if (Object.keys(parts).length === 0) return null;
                  return (
                    <div className="flex items-center gap-4 text-sm pt-2 border-t">
                      {parts.source && (
                        <div><span className="text-gray-500 text-sm">UTM Source</span> <span className="block font-medium text-gray-900">{parts.source}</span></div>
                      )}
                      {parts.medium && (
                        <div><span className="text-gray-500 text-sm">Medium</span> <span className="block font-medium text-gray-900">{parts.medium}</span></div>
                      )}
                      {parts.campaign && (
                        <div><span className="text-gray-500 text-sm">Campaign</span> <span className="block font-medium text-gray-900">{parts.campaign}</span></div>
                      )}
                      {parts.content && (
                        <div><span className="text-gray-500 text-sm">Content</span> <span className="block font-medium text-gray-900">{parts.content}</span></div>
                      )}
                      {parts.term && (
                        <div><span className="text-gray-500 text-sm">Term</span> <span className="block font-medium text-gray-900">{parts.term}</span></div>
                      )}
                    </div>
                  );
                })()}

                {/* Row 2: Pipeline */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <span className="text-sm text-gray-500 whitespace-nowrap">Pipeline:</span>
                  {lead.deals.length > 0 ? (
                    <div className="flex items-center gap-2 flex-1">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: lead.deals[0].stage.color }} />
                      <span className="text-sm font-medium text-gray-900">{lead.deals[0].stage.name}</span>
                      <span className="text-sm text-gray-500">
                        {lead.deals[0].value ? formatCurrency(lead.deals[0].value, lead.deals[0].currency) : ""} {lead.deals[0].probability ? `· ${lead.deals[0].probability}%` : ""}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">Nu este în pipeline</span>
                  )}
                  <MoveDropdown
                    leadId={leadId}
                    stages={availableStages}
                    currentStageName={currentStageName}
                    brand={lead.brand}
                    onMoved={async () => { await fetchLead(); onLeadUpdated?.(); }}
                  />
                </div>

                {/* Row 3: Agent */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <span className="text-sm text-gray-500 whitespace-nowrap">Agent:</span>
                  <select
                    value={lead.assignedTo?.id || ""}
                    onChange={(e) => assignAgent(e.target.value || null)}
                    disabled={assigningAgent}
                    className="flex-1 rounded-md border px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Neasignat</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                    ))}
                  </select>
                  {assigningAgent && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </div>

                {/* Row 4: Follow-up */}
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 whitespace-nowrap">Follow-up:</span>
                    {lead.followUpAt ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Bell className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-sm font-medium text-gray-900">{formatDate(lead.followUpAt)}</span>
                        {lead.followUpNote && <span className="text-sm text-gray-500 truncate">— {lead.followUpNote}</span>}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 flex-1">Nesetat</span>
                    )}
                    <button onClick={() => setShowFollowUp(!showFollowUp)} className="text-sm text-gray-700 hover:text-gray-900 border rounded-md px-2 py-1 flex items-center gap-1">
                      <Bell className="h-3 w-3" /> {lead.followUpAt ? "Modifică" : "Programează"}
                    </button>
                  </div>
                  {showFollowUp && (
                    <div className="mt-2 space-y-2 bg-muted/30 rounded-md p-2">
                      <input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full rounded-md border px-3 py-1.5 text-sm"
                      />
                      <textarea
                        value={followUpNote}
                        onChange={(e) => setFollowUpNote(e.target.value)}
                        placeholder="Ce trebuie făcut? (ex: Sună clientul)"
                        className="w-full rounded-md border px-3 py-1.5 text-sm resize-none"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowFollowUp(false)} className="px-3 py-1 text-sm rounded-md border hover:bg-muted">Anulează</button>
                        <button
                          onClick={saveFollowUp}
                          disabled={!followUpDate || !followUpNote.trim() || savingFollowUp}
                          className="px-3 py-1 text-sm rounded-md bg-gray-900 text-white disabled:opacity-50 flex items-center gap-1"
                        >
                          {savingFollowUp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                          Salvează
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Row 5: Note admin */}
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-gray-500">Note admin:</span>
                  </div>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Adaugă observații interne..."
                    className="w-full rounded-md border px-3 py-1.5 text-sm resize-none"
                    rows={2}
                  />
                  {adminNote !== (lead.adminNotes || "") && (
                    <div className="flex justify-end gap-2 mt-1">
                      <button
                        onClick={() => setAdminNote(lead.adminNotes || "")}
                        className="px-3 py-1 text-sm rounded-md border hover:bg-muted"
                      >
                        Anulează
                      </button>
                      <button
                        onClick={saveAdminNote}
                        disabled={savingAdminNote}
                        className="px-3 py-1 text-sm rounded-md bg-gray-900 text-white disabled:opacity-50"
                      >
                        {savingAdminNote ? "..." : "Salvează"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── New Lead Form ─────────────────────────────────────

const MANUAL_SOURCES = [
  { value: "PHONE", label: "Telefon" },
  { value: "WALK_IN", label: "Walk-in (vizită showroom)" },
  { value: "REFERRAL", label: "Recomandare" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "GOOGLE_ADS", label: "Google Ads" },
  { value: "AUTOVIT", label: "Autovit" },
  { value: "OTHER", label: "Altele" },
];

function NewLeadForm({
  agents,
  selectedBrand,
  onClose,
  onCreated,
}: {
  agents: Agent[];
  selectedBrand: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    source: "PHONE",
    brand: selectedBrand && selectedBrand !== "ALL" ? selectedBrand : "NISSAN",
    type: "GENERAL",
    notes: "",
    assignedToId: "",
    vehicleId: "",
    customerId: "",
    // TD fields (filled by modal)
    scheduleTestDrive: false,
    testDriveDate: "",
    testDriveVehicleId: "",
    // Showroom fields (filled by modal)
    scheduleShowroom: false,
    showroomDate: "",
  });

  // Modal state
  const [showTdModal, setShowTdModal] = useState(false);
  const [showShowroomModal, setShowShowroomModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Customer search via phone
  const [customerResults, setCustomerResults] = useState<{ id: string; firstName: string; lastName: string; phone: string | null; email: string | null }[]>([]);
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; firstName: string; lastName: string; phone: string | null; email: string | null } | null>(null);
  const [customerSearchDone, setCustomerSearchDone] = useState(false);

  // Vehicle search
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleResults, setVehicleResults] = useState<{ id: string; title: string | null; make: { name: string }; model: { name: string }; year: number; price: number | null; discountPrice: number | null; currency: string }[]>([]);
  const [showVehicleResults, setShowVehicleResults] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<{ id: string; title: string | null; make: { name: string }; model: { name: string }; year: number; price: number | null; discountPrice: number | null; currency: string } | null>(null);

  // Search customer when phone changes (min 4 digits)
  useEffect(() => {
    if (selectedCustomer) return;
    const phone = form.phone.replace(/\s/g, "");
    if (phone.length < 4) { setCustomerResults([]); setCustomerSearchDone(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(phone)}`);
        const data = await res.json();
        setCustomerResults(data.data || []);
        setShowCustomerResults((data.data || []).length > 0);
        setCustomerSearchDone(true);
      } catch { setCustomerResults([]); setCustomerSearchDone(true); }
    }, 400);
    return () => clearTimeout(t);
  }, [form.phone, selectedCustomer]);

  // Debounced vehicle search
  useEffect(() => {
    if (vehicleSearch.length < 2) { setVehicleResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vehicles?search=${encodeURIComponent(vehicleSearch)}&brand=${form.brand}&limit=8`);
        const data = await res.json();
        setVehicleResults(data.vehicles || data.data || []);
        setShowVehicleResults(true);
      } catch { setVehicleResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [vehicleSearch, form.brand]);

  function selectCustomer(c: typeof customerResults[0]) {
    setSelectedCustomer(c);
    setForm((f) => ({
      ...f,
      customerId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone || f.phone,
      email: c.email || f.email,
    }));
    setShowCustomerResults(false);
  }

  function clearCustomer() {
    setSelectedCustomer(null);
    setCustomerSearchDone(false);
    setForm((f) => ({ ...f, customerId: "", firstName: "", lastName: "", phone: "", email: "" }));
  }

  function selectVehicle(v: typeof vehicleResults[0]) {
    setSelectedVehicle(v);
    setForm((f) => ({ ...f, vehicleId: v.id }));
    setVehicleSearch("");
    setShowVehicleResults(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Numele și prenumele sunt obligatorii.");
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      setError("Telefon sau email obligatoriu.");
      return;
    }
    if (form.scheduleTestDrive && !form.testDriveDate) {
      setError("Selectează data și ora pentru test drive.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare");
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Eroare la creare");
    } finally {
      setSaving(false);
    }
  }

  const brands = [
    { value: "NISSAN", label: "Nissan" },
    { value: "RENAULT", label: "Renault" },
    { value: "AUTORULATE", label: "Autorulate" },
    { value: "SERVICE", label: "Service" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl animate-in slide-in-from-right">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4">
          <h2 className="text-base font-semibold">Lead Nou</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Phone — primary field, triggers customer search */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500">Telefon *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                onBlur={() => setTimeout(() => setShowCustomerResults(false), 200)}
                className="w-full rounded-md border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="07xx xxx xxx"
                disabled={!!selectedCustomer}
                autoFocus
              />
            </div>

            {/* Customer suggestions */}
            {!selectedCustomer && showCustomerResults && customerResults.length > 0 && (
              <div className="rounded-md border bg-blue-50 border-blue-200 p-1 mt-1">
                <p className="text-sm font-medium text-blue-700 px-2 py-1">Client existent găsit:</p>
                {customerResults.map((c) => (
                  <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                    className="w-full px-2 py-1.5 text-left text-sm hover:bg-blue-100 rounded flex items-center justify-between">
                    <span className="font-medium">{c.firstName} {c.lastName}</span>
                    <span className="text-sm text-gray-500">{c.email || ""}</span>
                  </button>
                ))}
              </div>
            )}

            {/* No customer found hint */}
            {!selectedCustomer && customerSearchDone && customerResults.length === 0 && form.phone.length >= 4 && (
              <p className="text-sm text-gray-500 mt-1">Client nou — completează datele de mai jos.</p>
            )}
          </div>

          {/* Selected customer card */}
          {selectedCustomer && (
            <div className="flex items-center justify-between rounded-md border p-3 bg-emerald-50 border-emerald-200">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" />
                <div>
                  <span className="text-sm font-medium">{selectedCustomer.firstName} {selectedCustomer.lastName}</span>
                  {selectedCustomer.email && <span className="text-sm text-gray-500 ml-2">{selectedCustomer.email}</span>}
                </div>
              </div>
              <button type="button" onClick={clearCustomer} className="text-sm text-red-600 hover:underline">Schimbă</button>
            </div>
          )}

          {/* Name + Email fields — only for new customers */}
          {!selectedCustomer && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-500">Prenume *</label>
                  <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Ion" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-500">Nume *</label>
                  <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Popescu" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="email@exemplu.ro" />
              </div>
            </>
          )}

          {/* Brand + Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-500">Brand *</label>
              <select
                value={form.brand}
                onChange={(e) => { setForm((f) => ({ ...f, brand: e.target.value, vehicleId: "" })); setSelectedVehicle(null); }}
                className="w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {brands.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-500">Sursa *</label>
              <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className="w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring">
                {MANUAL_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Lead type */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500">Tip Lead</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring">
              {Object.entries(LEAD_TYPE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {/* Vehicle search */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500">Interesat de</label>
            {selectedVehicle ? (
              <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">
                    {selectedVehicle.make.name} {selectedVehicle.model.name} {selectedVehicle.year}
                  </span>
                  {(selectedVehicle.discountPrice || selectedVehicle.price) && (
                    <span className="text-sm text-gray-500">
                      {(selectedVehicle.discountPrice || selectedVehicle.price)!.toLocaleString("ro-RO")} {selectedVehicle.currency}
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => { setSelectedVehicle(null); setForm((f) => ({ ...f, vehicleId: "" })); }} className="text-sm text-red-600 hover:underline">Schimbă</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                <input
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  onFocus={() => vehicleResults.length > 0 && setShowVehicleResults(true)}
                  onBlur={() => setTimeout(() => setShowVehicleResults(false), 200)}
                  placeholder="Caută mașină din inventar..."
                  className="w-full rounded-md border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {showVehicleResults && vehicleResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
                    {vehicleResults.map((v) => {
                      const displayPrice = v.discountPrice || v.price;
                      return (
                        <button key={v.id} type="button" onClick={() => selectVehicle(v)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between">
                          <span>{v.make.name} {v.model.name} {v.year}</span>
                          {displayPrice ? (
                            <span className="text-sm font-medium text-gray-500">{displayPrice.toLocaleString("ro-RO")} {v.currency}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Agent */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500">Agent asignat</label>
            <select value={form.assignedToId} onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Eu</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500">Note</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={3}
              placeholder="Detalii despre conversație, ce mașină dorește, buget..." />
          </div>

          {/* Programari */}
          <div className="space-y-2 rounded-lg border p-3">
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Programări (opțional)</h4>

            <div className="grid grid-cols-2 gap-2">
              {/* Test Drive button */}
              <button
                type="button"
                onClick={() => setShowTdModal(true)}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${form.scheduleTestDrive ? "border-cyan-500 bg-cyan-50 text-cyan-800" : "hover:bg-muted"}`}
              >
                <Calendar className="h-4 w-4 text-cyan-600" />
                {form.scheduleTestDrive ? "✓ Test Drive" : "Programează Test Drive"}
              </button>

              {/* Showroom button */}
              <button
                type="button"
                onClick={() => setShowShowroomModal(true)}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${form.scheduleShowroom ? "border-amber-500 bg-amber-50 text-amber-800" : "hover:bg-muted"}`}
              >
                <User className="h-4 w-4 text-amber-600" />
                {form.scheduleShowroom ? "✓ Showroom" : "Programează Showroom"}
              </button>
            </div>

            {/* Summary of scheduled items */}
            {form.scheduleTestDrive && form.testDriveDate && (
              <div className="flex items-center justify-between rounded-md bg-cyan-50 border border-cyan-200 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-cyan-900">Test Drive: </span>
                  <span className="text-cyan-700">
                    {new Date(form.testDriveDate).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <button type="button" onClick={() => setForm((f) => ({ ...f, scheduleTestDrive: false, testDriveDate: "", testDriveVehicleId: "" }))}
                  className="text-cyan-700 hover:text-red-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {form.scheduleShowroom && form.showroomDate && (
              <div className="flex items-center justify-between rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-amber-900">Showroom: </span>
                  <span className="text-amber-700">
                    {new Date(form.showroomDate).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <button type="button" onClick={() => setForm((f) => ({ ...f, scheduleShowroom: false, showroomDate: "" }))}
                  className="text-amber-700 hover:text-red-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
              Anulează
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Creează Lead
            </button>
          </div>
        </form>
      </div>

      {/* Test Drive Scheduler Modal */}
      {showTdModal && (
        <TestDriveScheduler
          brand={form.brand}
          initialVehicleId={form.vehicleId || null}
          onClose={() => setShowTdModal(false)}
          onConfirm={(vehicleId, isoDate) => {
            setForm((f) => ({
              ...f,
              scheduleTestDrive: true,
              testDriveDate: isoDate,
              testDriveVehicleId: vehicleId,
            }));
            setShowTdModal(false);
          }}
        />
      )}

      {/* Showroom Scheduler Modal */}
      {showShowroomModal && (
        <ShowroomScheduler
          onClose={() => setShowShowroomModal(false)}
          onConfirm={(isoDate) => {
            setForm((f) => ({
              ...f,
              scheduleShowroom: true,
              showroomDate: isoDate,
            }));
            setShowShowroomModal(false);
          }}
        />
      )}
    </div>
  );
}

// ─── TestDriveScheduler Modal ──────────────────────────

function TestDriveScheduler({
  brand,
  initialVehicleId,
  onClose,
  onConfirm,
}: {
  brand: string;
  initialVehicleId: string | null;
  onClose: () => void;
  onConfirm: (vehicleId: string, isoDate: string) => void;
}) {
  const [step, setStep] = useState<1 | 2>(initialVehicleId ? 2 : 1);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(initialVehicleId);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleResults, setVehicleResults] = useState<Array<{
    id: string;
    title: string | null;
    make: { name: string };
    model: { name: string };
    year: number;
  }>>([]);
  const [selectedVehicleLabel, setSelectedVehicleLabel] = useState<string>("");
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  // Date + slot state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [slots, setSlots] = useState<Array<{ time: string; available: boolean }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Vehicle search
  useEffect(() => {
    if (step !== 1) return;
    const q = vehicleSearch.trim();
    if (q.length < 2) { setVehicleResults([]); return; }
    const timer = setTimeout(async () => {
      setLoadingVehicles(true);
      try {
        // First try matching brand, then fallback to all brands if none found
        const resBrand = await fetch(`/api/vehicles?search=${encodeURIComponent(q)}&brand=${brand}&availableTestDrive=true&limit=8`);
        const dataBrand = await resBrand.json();
        const brandResults = dataBrand.vehicles || dataBrand.data || [];
        if (brandResults.length > 0) {
          setVehicleResults(brandResults);
        } else {
          // Fallback: search across all brands
          const resAll = await fetch(`/api/vehicles?search=${encodeURIComponent(q)}&availableTestDrive=true&limit=8`);
          const dataAll = await resAll.json();
          setVehicleResults(dataAll.vehicles || dataAll.data || []);
        }
      } catch { setVehicleResults([]); }
      setLoadingVehicles(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [vehicleSearch, brand, step]);

  // Fetch slots when date/vehicle change
  useEffect(() => {
    if (!selectedDate || !selectedVehicleId) return;
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    setLoadingSlots(true);
    setSelectedTime(null);
    fetch(`/api/test-drives/slots?vehicleId=${selectedVehicleId}&date=${dateStr}`)
      .then((r) => r.json())
      .then((data) => {
        const raw = data.data?.slots || data.slots || [];
        setSlots(raw);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, selectedVehicleId]);

  const handleConfirm = () => {
    if (!selectedVehicleId || !selectedDate || !selectedTime) return;
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    onConfirm(selectedVehicleId, `${dateStr}T${selectedTime}:00`);
  };

  const today = new Date(); today.setHours(0,0,0,0);
  const maxD = new Date(today); maxD.setDate(maxD.getDate() + 60);
  const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-sm font-bold">
            Programează Test Drive — Pas {step}/2
          </h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Step 1: Vehicle */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Alege mașina pentru test drive</p>
              {selectedVehicleId && selectedVehicleLabel ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                  <span className="text-sm font-medium">{selectedVehicleLabel}</span>
                  <button onClick={() => { setSelectedVehicleId(null); setSelectedVehicleLabel(""); }}
                    className="text-red-500 hover:text-red-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    autoFocus
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                    placeholder="Caută mașină (marcă, model...)"
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="max-h-60 overflow-y-auto rounded-md border divide-y">
                    {loadingVehicles && (
                      <div className="flex justify-center p-3"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
                    )}
                    {!loadingVehicles && vehicleSearch.length >= 2 && vehicleResults.length === 0 && (
                      <div className="p-3 text-sm text-gray-500">Nicio mașină găsită</div>
                    )}
                    {vehicleResults.map((v) => (
                      <button key={v.id}
                        onClick={() => {
                          setSelectedVehicleId(v.id);
                          setSelectedVehicleLabel(`${v.make.name} ${v.model.name} (${v.year})`);
                        }}
                        className="flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-muted">
                        <Car className="h-4 w-4 text-gray-500" />
                        {v.make.name} {v.model.name} ({v.year})
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                  Anulează
                </button>
                <button onClick={() => setStep(2)} disabled={!selectedVehicleId}
                  className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
                  Următor
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Date + slots */}
          {step === 2 && (
            <div className="space-y-3">
              {selectedVehicleLabel && (
                <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-sm">
                  <Car className="h-4 w-4 text-gray-500" />
                  <span>{selectedVehicleLabel}</span>
                  {!initialVehicleId && (
                    <button onClick={() => setStep(1)} className="ml-auto text-xs text-blue-600 hover:underline">
                      Schimbă
                    </button>
                  )}
                </div>
              )}

              {/* Calendar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => setCalendarMonth(new Date(y, m - 1, 1))}
                    className="rounded p-1 hover:bg-muted">
                    <ChevronDown className="h-4 w-4 rotate-90" />
                  </button>
                  <span className="text-sm font-medium">
                    {calendarMonth.toLocaleDateString("ro-RO", { month: "long", year: "numeric" })}
                  </span>
                  <button onClick={() => setCalendarMonth(new Date(y, m + 1, 1))}
                    className="rounded p-1 hover:bg-muted">
                    <ChevronDown className="h-4 w-4 -rotate-90" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
                  {["L", "Ma", "Mi", "J", "V", "S", "D"].map((d) => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const d = new Date(y, m, day);
                    const isDisabled = d < today || d > maxD;
                    const isSelected = selectedDate && d.toDateString() === selectedDate.toDateString();
                    return (
                      <button key={day} disabled={isDisabled}
                        onClick={() => setSelectedDate(d)}
                        className={`py-1.5 rounded-md text-sm transition-colors ${isSelected ? "bg-gray-900 text-white" : isDisabled ? "text-gray-300" : "hover:bg-muted"}`}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slots */}
              {selectedDate && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">
                    Ore disponibile — {selectedDate.toLocaleDateString("ro-RO", { day: "numeric", month: "long" })}
                  </p>
                  {loadingSlots ? (
                    <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-red-500 italic">Niciun slot disponibil.</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {slots.map((s) => (
                        <button key={s.time} disabled={!s.available}
                          onClick={() => setSelectedTime(s.time)}
                          className={`py-1.5 rounded-md text-sm transition-colors ${selectedTime === s.time ? "bg-gray-900 text-white" : s.available ? "border hover:bg-muted" : "border bg-gray-50 text-gray-300 line-through cursor-not-allowed"}`}>
                          {s.time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between gap-2 pt-2">
                <button onClick={() => initialVehicleId ? onClose() : setStep(1)}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                  {initialVehicleId ? "Anulează" : "Înapoi"}
                </button>
                <button onClick={handleConfirm} disabled={!selectedTime}
                  className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
                  Confirmă
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ShowroomScheduler Modal ───────────────────────────

function ShowroomScheduler({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (isoDate: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [slots, setSlots] = useState<Array<{ time: string; available: boolean }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDate) return;
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    setLoadingSlots(true);
    setSelectedTime(null);
    fetch(`/api/showroom-appointments/slots?date=${dateStr}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.data?.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate]);

  const today = new Date(); today.setHours(0,0,0,0);
  const maxD = new Date(today); maxD.setDate(maxD.getDate() + 60);
  const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return;
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    onConfirm(`${dateStr}T${selectedTime}:00`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-sm font-bold">Programează Întâlnire Showroom (1h)</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {/* Calendar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setCalendarMonth(new Date(y, m - 1, 1))}
                className="rounded p-1 hover:bg-muted">
                <ChevronDown className="h-4 w-4 rotate-90" />
              </button>
              <span className="text-sm font-medium">
                {calendarMonth.toLocaleDateString("ro-RO", { month: "long", year: "numeric" })}
              </span>
              <button onClick={() => setCalendarMonth(new Date(y, m + 1, 1))}
                className="rounded p-1 hover:bg-muted">
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
              {["L", "Ma", "Mi", "J", "V", "S", "D"].map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const d = new Date(y, m, day);
                const isDisabled = d < today || d > maxD;
                const isSelected = selectedDate && d.toDateString() === selectedDate.toDateString();
                return (
                  <button key={day} disabled={isDisabled}
                    onClick={() => setSelectedDate(d)}
                    className={`py-1.5 rounded-md text-sm transition-colors ${isSelected ? "bg-gray-900 text-white" : isDisabled ? "text-gray-300" : "hover:bg-muted"}`}>
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate && (
            <div>
              <p className="text-sm text-gray-500 mb-2">
                Ore disponibile — {selectedDate.toLocaleDateString("ro-RO", { day: "numeric", month: "long" })}
              </p>
              {loadingSlots ? (
                <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-red-500 italic">Niciun slot disponibil.</p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {slots.map((s) => (
                    <button key={s.time} disabled={!s.available}
                      onClick={() => setSelectedTime(s.time)}
                      className={`py-1.5 rounded-md text-sm transition-colors ${selectedTime === s.time ? "bg-gray-900 text-white" : s.available ? "border hover:bg-muted" : "border bg-gray-50 text-gray-300 line-through cursor-not-allowed"}`}>
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
              Anulează
            </button>
            <button onClick={handleConfirm} disabled={!selectedTime}
              className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
              Confirmă
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Sales Client ─────────────────────────────────

export default function SalesClient({
  initialLeads,
  initialStages,
  agents,
  activeTestDrives = [],
  activeShowrooms = [],
}: {
  initialLeads: Lead[];
  initialStages: PipelineStage[];
  agents: Agent[];
  activeTestDrives?: ActiveTestDrive[];
  activeShowrooms?: ActiveShowroom[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);
  const { selectedBrand } = useBrand();
  const router = useRouter();
  const refreshData = useCallback(async () => {
    try {
      const brandParam = selectedBrand && selectedBrand !== "ALL" ? `?brand=${selectedBrand}` : "";
      const res = await fetch(`/api/leads/list${brandParam}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) setLeads(json.data);
      }
    } catch { /* fallback to router refresh */ }
    router.refresh();
  }, [selectedBrand, router]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showNewLeadForm, setShowNewLeadForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"leads" | "pipeline">("leads");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "priority">("date");
  const [showFilters, setShowFilters] = useState(false);

  // Drag state
  const [dragDealId, setDragDealId] = useState<string | null>(null);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [dragDropTarget, setDragDropTarget] = useState<{ stageId: string; stageName: string } | null>(null);

  const newLeads = useMemo(() => {
    let filtered = leads.filter((l) => l.status === "NEW");

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((l) =>
        `${l.customer.firstName} ${l.customer.lastName}`.toLowerCase().includes(q) ||
        l.vehicle?.title?.toLowerCase().includes(q) ||
        l.vehicle?.make.name.toLowerCase().includes(q) ||
        l.vehicle?.model.name.toLowerCase().includes(q)
      );
    }
    if (filterSource) filtered = filtered.filter((l) => l.source === filterSource);
    if (filterType) filtered = filtered.filter((l) => l.type === filterType);
    if (filterAgent === "__none") filtered = filtered.filter((l) => !l.assignedTo);
    else if (filterAgent) filtered = filtered.filter((l) => l.assignedTo?.id === filterAgent);

    if (sortBy === "priority") filtered.sort((a, b) => b.priority - a.priority || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return filtered;
  }, [leads, searchQuery, filterSource, filterType, filterAgent, sortBy]);

  // Build visible stages with filters applied to deals
  const visibleStages = useMemo(() => {
    let stages: PipelineStage[];
    if (selectedBrand && selectedBrand !== "ALL") {
      stages = initialStages.filter((s) => s.brand === selectedBrand);
    } else {
      const merged = new Map<string, PipelineStage>();
      for (const stage of initialStages) {
        const taggedDeals = stage.deals.map((d) => ({ ...d, _brand: stage.brand }));
        const key = `${stage.order}-${stage.name}`;
        if (!merged.has(key)) {
          merged.set(key, { ...stage, deals: taggedDeals as PipelineStage["deals"] });
        } else {
          merged.get(key)!.deals.push(...(taggedDeals as PipelineStage["deals"]));
        }
      }
      stages = Array.from(merged.values()).sort((a, b) => a.order - b.order);
    }

    // Apply filters to deals inside stages
    if (searchQuery || filterSource || filterType || filterAgent) {
      const q = searchQuery.toLowerCase();
      stages = stages.map((stage) => ({
        ...stage,
        deals: stage.deals.filter((d) => {
          if (searchQuery) {
            const name = `${d.lead.customer.firstName} ${d.lead.customer.lastName}`.toLowerCase();
            const vehicle = d.lead.vehicle ? `${d.lead.vehicle.make.name} ${d.lead.vehicle.model.name}`.toLowerCase() : "";
            if (!name.includes(q) && !vehicle.includes(q)) return false;
          }
          if (filterSource && d.lead.source !== filterSource) return false;
          if (filterType && d.lead.type !== filterType) return false;
          if (filterAgent === "__none" && d.assignedTo) return false;
          if (filterAgent && filterAgent !== "__none" && d.assignedTo?.id !== filterAgent) return false;
          return true;
        }),
      }));
    }

    return stages;
  }, [initialStages, selectedBrand, searchQuery, filterSource, filterType, filterAgent]);

  const totalValue = visibleStages.reduce(
    (sum, stage) => sum + stage.deals.reduce((s, d) => s + (d.value ?? 0), 0), 0
  );

  function handleMoved(leadId: string) {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  }

  // ─── Drag & Drop ─────────────────────────────────────
  function handleDragStart(e: React.DragEvent, dealId: string, leadId: string) {
    setDragDealId(dealId);
    setDragLeadId(leadId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, targetStageId: string, targetStageName: string) {
    e.preventDefault();
    if (!dragLeadId) return;
    setDragDropTarget({ stageId: targetStageId, stageName: targetStageName });
  }

  async function confirmDragDrop(comment: string, lostReason?: string) {
    if (!dragLeadId || !dragDropTarget) return;
    const isLost = dragDropTarget.stageName === "Pierdut";
    const noteContent = isLost && lostReason
      ? `${comment}\n❌ Motiv pierdere: ${lostReason}`
      : comment;

    await fetch(`/api/leads/${dragLeadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteContent, type: "NOTE" }),
    });
    await fetch(`/api/leads/${dragLeadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: STATUS_MAP[dragDropTarget.stageName] || "CONTACTED",
        pipelineStageId: dragDropTarget.stageId,
        ...(isLost && lostReason ? { lostReason } : {}),
      }),
    });
    setDragDealId(null);
    setDragLeadId(null);
    setDragDropTarget(null);
    window.location.reload();
  }

  // ─── Export ──────────────────────────────────────────
  function exportCSV() {
    const rows = [["Nume", "Telefon", "Email", "Sursa", "Brand", "Status", "Mașină", "Agent", "Creat"]];
    leads.forEach((l) => {
      rows.push([
        `${l.customer.firstName} ${l.customer.lastName}`,
        l.customer.phone || "",
        l.customer.email || "",
        SOURCE_LABELS[l.source] || l.source,
        l.brand,
        STATUS_LABELS[l.status] || l.status,
        l.vehicle ? (l.vehicle.title || `${l.vehicle.make.name} ${l.vehicle.model.name}`) : "",
        l.assignedTo ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}` : "",
        new Date(l.createdAt).toLocaleDateString("ro-RO"),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raport-vanzari-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Unique sources for filter
  const availableSources = [...new Set(leads.map((l) => l.source))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-base font-bold tracking-tight">Vânzări</h1>
          <p className="text-sm text-gray-500">
            {leads.length} lead-uri &middot; {visibleStages.reduce((sum, s) => sum + s.deals.length, 0)} dealuri &middot; Valoare: {formatCurrency(totalValue)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button onClick={() => setShowNewLeadForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Lead Nou
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("leads")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "leads" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-foreground"}`}
        >
          <AlertCircle className="h-4 w-4" />
          Lead-uri Noi
          {newLeads.length > 0 && <Badge variant={activeTab === "leads" ? "default" : "secondary"} className="text-sm">{newLeads.length}</Badge>}
        </button>
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "pipeline" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-foreground"}`}
        >
          <ArrowRight className="h-4 w-4" />
          Pipeline
          <Badge variant={activeTab === "pipeline" ? "default" : "secondary"} className="text-sm">
            {visibleStages.reduce((sum, s) => sum + s.deals.length, 0)}
          </Badge>
        </button>
      </div>

      {/* ═══ TAB: Lead-uri Noi ═══ */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          {/* Search + Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Caută după nume sau mașină..."
                className="w-full rounded-md border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors ${showFilters || filterSource || filterType || filterAgent ? "bg-primary/10 border-primary" : ""}`}
            >
              <Filter className="h-4 w-4" /> Filtre
              {(filterSource || filterType || filterAgent) && <span className="h-2 w-2 rounded-full bg-primary" />}
            </button>
            <button
              onClick={() => setSortBy(sortBy === "date" ? "priority" : "date")}
              className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              <ArrowUpDown className="h-4 w-4" /> {sortBy === "date" ? "Dată" : "Prioritate"}
            </button>
          </div>

          {showFilters && (
            <div className="flex gap-3 p-3 rounded-lg border bg-muted/30">
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="rounded-md border px-3 py-1.5 text-sm bg-white">
                <option value="">Toate sursele</option>
                {availableSources.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>)}
              </select>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-md border px-3 py-1.5 text-sm bg-white">
                <option value="">Toate tipurile</option>
                {Object.entries(LEAD_TYPE_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.icon} {cfg.label}</option>)}
              </select>
              <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="rounded-md border px-3 py-1.5 text-sm bg-white">
                <option value="">Toți agenții</option>
                <option value="__none">Neasignat</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
              </select>
              {(filterSource || filterType || filterAgent) && (
                <button onClick={() => { setFilterSource(""); setFilterType(""); setFilterAgent(""); }} className="text-sm text-red-600 hover:underline">Resetează</button>
              )}
            </div>
          )}

          {/* Lead cards */}
          {newLeads.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {newLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  stages={initialStages}
                  testDrive={activeTestDrives.find((td) => td.leadId === lead.id)}
                  showroom={activeShowrooms.find((sr) => sr.leadId === lead.id)}
                  onMoved={handleMoved}
                  onSelect={setSelectedLeadId}
                  showBrand={!selectedBrand}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <AlertCircle className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Niciun lead nou.</p>
              <p className="text-sm mt-1">Lead-urile noi din website sau adăugate manual apar aici.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Pipeline ═══ */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          {/* Search for pipeline */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Caută în pipeline..."
                className="w-full rounded-md border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors ${showFilters || filterSource || filterType || filterAgent ? "bg-primary/10 border-primary" : ""}`}
            >
              <Filter className="h-4 w-4" /> Filtre
              {(filterSource || filterType || filterAgent) && <span className="h-2 w-2 rounded-full bg-primary" />}
            </button>
          </div>

          {showFilters && (
            <div className="flex gap-3 p-3 rounded-lg border bg-muted/30">
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="rounded-md border px-3 py-1.5 text-sm bg-white">
                <option value="">Toate sursele</option>
                {availableSources.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>)}
              </select>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-md border px-3 py-1.5 text-sm bg-white">
                <option value="">Toate tipurile</option>
                {Object.entries(LEAD_TYPE_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.icon} {cfg.label}</option>)}
              </select>
              <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="rounded-md border px-3 py-1.5 text-sm bg-white">
                <option value="">Toți agenții</option>
                <option value="__none">Neasignat</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
              </select>
              {(filterSource || filterType || filterAgent) && (
                <button onClick={() => { setFilterSource(""); setFilterType(""); setFilterAgent(""); }} className="text-sm text-red-600 hover:underline">Resetează</button>
              )}
            </div>
          )}

          {/* Pipeline Board */}
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
            {visibleStages.map((stage) => {
              const stageValue = stage.deals.reduce((s, d) => s + (d.value ?? 0), 0);
              return (
                <div
                  key={stage.id}
                  className={`flex w-72 shrink-0 flex-col rounded-lg bg-muted/50 ${dragDealId ? "ring-1 ring-dashed ring-primary/30" : ""}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.id, stage.name)}
                >
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <h3 className="text-sm font-semibold">{stage.name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {stageValue > 0 && <span className="text-sm text-gray-500">{formatCurrency(stageValue)}</span>}
                      <Badge variant="secondary" className="text-sm">{stage.deals.length}</Badge>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-2">
                    {stage.deals.length === 0 ? (
                      <div className="flex items-center justify-center rounded-md border border-dashed p-4 text-sm text-gray-500">
                        Niciun deal
                      </div>
                    ) : (
                      stage.deals.map((deal) => {
                        const dealBrand = (deal as Record<string, unknown>)._brand as string | null;
                        const showBrandBadge = !selectedBrand || selectedBrand === "ALL";
                        const dealInactivity = deal.createdAt ? getInactivityLevel(deal.createdAt) : "green";
                        return (
                          <div
                            key={deal.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, deal.id, deal.lead.id)}
                            onDragEnd={() => { setDragDealId(null); setDragLeadId(null); }}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <PipelineDealCard
                              deal={deal}
                              stageName={stage.name}
                              stages={initialStages}
                              showBrandBadge={showBrandBadge}
                              dealBrand={dealBrand}
                              inactivityLevel={dealInactivity}
                              onSelect={setSelectedLeadId}
                              onMoved={() => window.location.reload()}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lead Detail Overlay */}
      {selectedLeadId && (
        <LeadDetailOverlay
          leadId={selectedLeadId}
          stages={initialStages}
          agents={agents}
          onClose={() => setSelectedLeadId(null)}
          onCustomerClick={setSelectedCustomerId}
          onLeadUpdated={refreshData}
        />
      )}

      {/* Drag & Drop Move Modal */}
      {dragDropTarget && (
        <MoveModal
          stageName={dragDropTarget.stageName}
          isLost={dragDropTarget.stageName === "Pierdut"}
          onConfirm={confirmDragDrop}
          onCancel={() => { setDragDropTarget(null); setDragDealId(null); setDragLeadId(null); }}
        />
      )}

      {/* New Lead Form */}
      {showNewLeadForm && (
        <NewLeadForm
          agents={agents}
          selectedBrand={selectedBrand}
          onClose={() => setShowNewLeadForm(false)}
          onCreated={() => window.location.reload()}
        />
      )}

      {/* Customer History Overlay */}
      {selectedCustomerId && (
        <CustomerOverlay
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}
    </div>
  );
}
