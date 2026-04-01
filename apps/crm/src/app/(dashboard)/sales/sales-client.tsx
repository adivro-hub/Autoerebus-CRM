"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
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
  brand: string;
  priority: number;
  notes: string | null;
  createdAt: string;
  customer: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null };
  vehicle: { id: string; title: string | null; make: { name: string }; model: { name: string }; year: number } | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  _count: { deals: number };
}

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
  vehicleId: string;
  scheduledAt: string;
  status: string;
  brand: string;
}

// ─── Constants ─────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  CONTACTED: "bg-violet-100 text-violet-800",
  QUALIFIED: "bg-amber-100 text-amber-800",
  NEGOTIATION: "bg-orange-100 text-orange-800",
  WON: "bg-emerald-100 text-emerald-800",
  LOST: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nou",
  CONTACTED: "Contactat",
  QUALIFIED: "Calificat",
  NEGOTIATION: "Negociere",
  WON: "Câștigat",
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
  NISSAN: "bg-red-100 text-red-800",
  RENAULT: "bg-yellow-100 text-yellow-800",
  AUTORULATE: "bg-blue-100 text-blue-800",
  SERVICE: "bg-green-100 text-green-800",
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
  "Test Drive Programat": "border-l-cyan-500",
  "Test Drive Efectuat": "border-l-cyan-700",
  Calificat: "border-l-amber-500",
  "Ofertă Trimisă": "border-l-orange-500",
  Negociere: "border-l-red-500",
  "Câștigat": "border-l-emerald-500",
  Pierdut: "border-l-gray-500",
};

const STATUS_MAP: Record<string, string> = {
  "Lead Nou": "NEW",
  "Contactat": "CONTACTED",
  "Test Drive Programat": "QUALIFIED",
  "Test Drive Efectuat": "QUALIFIED",
  "Calificat": "QUALIFIED",
  "Ofertă Trimisă": "NEGOTIATION",
  "Oferta Trimisa": "NEGOTIATION",
  "Negociere": "NEGOTIATION",
  "Câștigat": "WON",
  "Castigat": "WON",
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

const STALE_DAYS = 7; // Lead is stale after 7 days in same stage

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysSince(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
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
              <label className="text-xs font-medium text-muted-foreground">Motivul pierderii *</label>
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
          <label className="text-xs font-medium text-muted-foreground">Comentariu *</label>
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
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted transition-colors"
      >
        {currentStageName ? "Mută" : "Mută în pipeline"}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 z-50 w-48 rounded-md border bg-white shadow-lg py-1">
            {filteredStages.map((s) => (
              <button
                key={s.id}
                onClick={() => { setPendingStage({ id: s.id, name: s.name }); setOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors"
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
  onMoved,
  onSelect,
}: {
  lead: Lead;
  stages: PipelineStage[];
  testDrive?: ActiveTestDrive | null;
  onMoved: (leadId: string) => void;
  onSelect: (leadId: string) => void;
}) {
  const stale = daysSince(lead.createdAt) >= STALE_DAYS;
  const [tdAction, setTdAction] = useState<"confirm" | "cancel" | "reschedule" | null>(null);
  const [tdLoading, setTdLoading] = useState(false);
  const [tdFeedback, setTdFeedback] = useState("");
  const [tdNewDate, setTdNewDate] = useState("");

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
      className={`border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-shadow ${stale ? "ring-2 ring-amber-400" : ""}`}
      onClick={() => onSelect(lead.id)}
    >
      <CardContent className="p-4">
        {stale && (
          <div className="flex items-center gap-1 text-amber-600 text-xs mb-2">
            <AlertTriangle className="h-3 w-3" />
            Lead vechi ({daysSince(lead.createdAt)} zile)
          </div>
        )}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">
              {lead.customer.firstName} {lead.customer.lastName}
            </span>
          </div>
          <Badge className="text-xs px-1.5" variant="outline">
            {SOURCE_LABELS[lead.source] || lead.source}
          </Badge>
        </div>

        {lead.vehicle && (
          <Link
            href={`/inventory/${lead.vehicle.id}/edit`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 mt-2 text-sm text-blue-600 hover:underline"
          >
            <Car className="h-3.5 w-3.5" />
            {lead.vehicle.title || `${lead.vehicle.make.name} ${lead.vehicle.model.name} ${lead.vehicle.year}`}
          </Link>
        )}

        {lead.notes && (
          <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{lead.notes}</span>
          </div>
        )}

        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
          {lead.customer.phone && (
            <a href={`tel:${lead.customer.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
              <Phone className="h-3 w-3" />
              {lead.customer.phone}
            </a>
          )}
          {lead.assignedTo && (
            <span>Agent: {lead.assignedTo.firstName} {lead.assignedTo.lastName}</span>
          )}
        </div>

        {/* Test Drive section */}
        {testDrive && (
          <div className="mt-3 pt-2 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-cyan-600" />
              <span className="text-xs font-medium text-cyan-700">
                Test Drive — {new Date(testDrive.scheduledAt).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
              <Badge className={`text-xs ${testDrive.status === "CONFIRMED" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>
                {testDrive.status === "CONFIRMED" ? "Confirmat" : "Programat"}
              </Badge>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setTdAction("confirm")}
                className="flex-1 flex items-center justify-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 text-xs font-medium transition-colors"
              >
                <Check className="h-3 w-3" /> Confirmă
              </button>
              <button
                onClick={() => { setTdAction("reschedule"); setTdNewDate(""); setTdFeedback(""); }}
                className="flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                <Clock className="h-3 w-3" /> Modifică data
              </button>
              <button
                onClick={() => setTdAction("cancel")}
                className="flex items-center gap-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 px-2 py-1.5 text-xs font-medium transition-colors"
              >
                <X className="h-3 w-3" /> Anulează
              </button>
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
                      <label className="text-xs font-medium text-muted-foreground">Data și ora nouă *</label>
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
                    <label className="text-xs font-medium text-muted-foreground">
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

        <div className="flex items-center justify-between mt-3 pt-2 border-t">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDate(lead.createdAt)}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Sigur dorești să ștergi acest lead?")) {
                  fetch(`/api/leads/${lead.id}`, { method: "DELETE" }).then(() => onMoved(lead.id));
                }
              }}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
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
  stale,
  onSelect,
  onMoved,
}: {
  deal: PipelineStage["deals"][0];
  stageName: string;
  stages: PipelineStage[];
  showBrandBadge: boolean;
  dealBrand: string | null;
  stale: boolean;
  onSelect: (leadId: string) => void;
  onMoved: () => void;
}) {
  return (
    <Card
      className={`border-l-4 ${STAGE_BORDER_COLORS[stageName] ?? "border-l-gray-300"} cursor-pointer hover:shadow-md transition-shadow ${stale ? "ring-2 ring-amber-400" : ""}`}
      onClick={() => onSelect(deal.lead.id)}
    >
      <CardContent className="p-3">
        {stale && (
          <div className="flex items-center gap-1 text-amber-600 text-xs mb-1">
            <AlertTriangle className="h-3 w-3" />
            &gt;{STALE_DAYS} zile
          </div>
        )}
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium">
            {deal.lead.customer.firstName} {deal.lead.customer.lastName}
          </p>
          {showBrandBadge && dealBrand && (
            <Badge className={`text-xs px-1.5 ${BRAND_BADGE_COLORS[dealBrand] || ""}`}>
              {BRAND_SHORT_LABELS[dealBrand] || dealBrand}
            </Badge>
          )}
        </div>
        {deal.lead.vehicle && (
          <p className="text-xs text-muted-foreground">
            {deal.lead.vehicle.make.name} {deal.lead.vehicle.model.name}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold">
            {deal.value ? formatCurrency(deal.value, deal.currency) : "-"}
          </span>
          <span className="text-xs text-muted-foreground">{deal.probability}%</span>
        </div>
        {deal.assignedTo && (
          <p className="mt-1 text-xs text-muted-foreground">
            Agent: {deal.assignedTo.firstName} {deal.assignedTo.lastName}
          </p>
        )}
        <div className="mt-2 pt-2 border-t flex justify-end">
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

  const fetchLead = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      const data = await res.json();
      if (data.success) setLead(data.data);
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `📅 Follow-up programat: ${followUpDate} — ${followUpNote.trim()}`,
          type: "NOTE",
        }),
      });
      await fetchLead();
      setShowFollowUp(false);
      setFollowUpDate("");
      setFollowUpNote("");
    } catch { /* ignore */ }
    finally { setSavingFollowUp(false); }
  }

  const currentStageName = lead?.deals?.[0]?.stage?.name;
  const availableStages = lead ? stages.filter((s) => !s.brand || s.brand === lead.brand) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl animate-in slide-in-from-right">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4">
          <h2 className="text-lg font-semibold">Detalii Lead</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !lead ? (
          <div className="p-6 text-center text-muted-foreground">Lead-ul nu a fost găsit.</div>
        ) : (
          <div className="p-4 space-y-5">
            {/* Customer */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</h3>
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <button
                    onClick={() => onCustomerClick?.(lead.customer.id)}
                    className="font-medium text-sm text-blue-600 hover:underline"
                  >
                    {lead.customer.firstName} {lead.customer.lastName}
                  </button>
                </div>
                {lead.customer.phone && (
                  <a href={`tel:${lead.customer.phone}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    <Phone className="h-3.5 w-3.5" />{lead.customer.phone}
                  </a>
                )}
                {lead.customer.email && (
                  <a href={`mailto:${lead.customer.email}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    <Mail className="h-3.5 w-3.5" />{lead.customer.email}
                  </a>
                )}
              </div>
            </div>

            {/* Vehicle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Interesat de</h3>
                {lead.vehicle && !editingVehicle && (
                  <div className="flex gap-2">
                    <button onClick={() => setEditingVehicle(true)} className="text-xs text-blue-600 hover:underline">Schimbă</button>
                    <button onClick={() => updateVehicle(null)} className="text-xs text-red-600 hover:underline">
                      {savingVehicle ? "..." : "Șterge"}
                    </button>
                  </div>
                )}
                {!lead.vehicle && !editingVehicle && (
                  <button onClick={() => setEditingVehicle(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Adaugă mașină
                  </button>
                )}
              </div>

              {lead.vehicle && !editingVehicle && (
                <Link href={`/inventory/${lead.vehicle.id}/edit`} className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {lead.vehicle.images?.[0] && <img src={lead.vehicle.images[0].url} alt="" className="h-16 w-24 rounded-md object-cover" />}
                    <div>
                      <p className="font-medium text-sm text-blue-600">{lead.vehicle.title || `${lead.vehicle.make.name} ${lead.vehicle.model.name}`}</p>
                      <p className="text-xs text-muted-foreground">An: {lead.vehicle.year}</p>
                    </div>
                  </div>
                </Link>
              )}

              {editingVehicle && (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
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
                        <button key={v.id} onClick={() => updateVehicle(v.id)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between border-b last:border-0">
                          <span>{v.make.name} {v.model.name} {v.year}</span>
                          {(v.discountPrice || v.price) && (
                            <span className="text-xs text-muted-foreground">{(v.discountPrice || v.price)!.toLocaleString("ro-RO")} {v.currency}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setEditingVehicle(false); setVSearch(""); setVResults([]); }}
                    className="text-xs text-muted-foreground hover:underline">Anulează</button>
                </div>
              )}

              {!lead.vehicle && !editingVehicle && (
                <p className="text-xs text-muted-foreground italic">Nicio mașină selectată.</p>
              )}
            </div>

            {/* Schedule Test Drive from overlay */}
            {lead.vehicle && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Test Drive</h3>
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-cyan-600" />
                    <input
                      type="datetime-local"
                      min={new Date().toISOString().slice(0, 16)}
                      className="flex-1 rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      id={`td-date-${leadId}`}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById(`td-date-${leadId}`) as HTMLInputElement;
                        if (input?.value) scheduleTestDriveFromOverlay(input.value);
                      }}
                      disabled={savingVehicle}
                      className="rounded-md bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {savingVehicle ? <Loader2 className="h-4 w-4 animate-spin" /> : "Programează"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lead info */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead</h3>
              <div className="rounded-lg border p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Status:</span> <Badge className={STATUS_COLORS[lead.status]}>{STATUS_LABELS[lead.status]}</Badge></div>
                  <div><span className="text-muted-foreground">Brand:</span> <Badge className={BRAND_BADGE_COLORS[lead.brand] || ""}>{BRAND_SHORT_LABELS[lead.brand] || lead.brand}</Badge></div>
                  <div><span className="text-muted-foreground">Sursa:</span> <span className="text-xs">{SOURCE_LABELS[lead.source] || lead.source}</span></div>
                  <div><span className="text-muted-foreground">Creat:</span> <span className="text-xs">{formatDate(lead.createdAt)}</span></div>
                </div>

                {/* Agent assignment */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Agent:</span>
                  <select
                    value={lead.assignedTo?.id || ""}
                    onChange={(e) => assignAgent(e.target.value || null)}
                    disabled={assigningAgent}
                    className="flex-1 rounded-md border px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Neasignat</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                    ))}
                  </select>
                  {assigningAgent && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </div>

                {lead.notes && (
                  <div className="text-sm mt-1">
                    <span className="text-muted-foreground">Note:</span>
                    <p className="mt-0.5 whitespace-pre-wrap text-xs bg-muted/50 rounded p-2">{lead.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pipeline + Move */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pipeline</h3>
              <div className="rounded-lg border p-3 space-y-3">
                {lead.deals.length > 0 ? lead.deals.map((deal) => (
                  <div key={deal.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: deal.stage.color }} />
                      <span className="text-sm font-medium">{deal.stage.name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {deal.value ? formatCurrency(deal.value, deal.currency) : "-"} &middot; {deal.probability}%
                    </div>
                  </div>
                )) : <p className="text-xs text-muted-foreground">Nu este în pipeline.</p>}

                <div className="pt-2 border-t">
                  <MoveDropdown
                    leadId={leadId}
                    stages={availableStages}
                    currentStageName={currentStageName}
                    brand={lead.brand}
                    onMoved={fetchLead}
                  />
                </div>
              </div>
            </div>

            {/* Follow-up */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Follow-up</h3>
                <button onClick={() => setShowFollowUp(!showFollowUp)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <Bell className="h-3 w-3" /> Programează
                </button>
              </div>
              {showFollowUp && (
                <div className="rounded-lg border p-3 space-y-2">
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
                    <button onClick={() => setShowFollowUp(false)} className="px-3 py-1 text-xs rounded-md border hover:bg-muted">Anulează</button>
                    <button
                      onClick={saveFollowUp}
                      disabled={!followUpDate || !followUpNote.trim() || savingFollowUp}
                      className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-1"
                    >
                      {savingFollowUp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                      Salvează
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Customer History */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <History className="h-3.5 w-3.5" /> Istoric Client
              </h3>
              {loadingHistory ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2"><Loader2 className="h-3 w-3 animate-spin" /> Se încarcă...</div>
              ) : customerHistory ? (
                <div className="rounded-lg border p-3 space-y-2 text-xs">
                  {(customerHistory.leads as { id: string; status: string; source: string; createdAt: string; notes: string | null }[]).length > 0 && (
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Alte lead-uri ({(customerHistory.leads as unknown[]).length})</p>
                      {(customerHistory.leads as { id: string; status: string; source: string; createdAt: string; notes: string | null }[]).map((ol) => (
                        <div key={ol.id} className="flex items-center justify-between py-1 border-b last:border-0">
                          <span><Badge className={`${STATUS_COLORS[ol.status]} text-xs`}>{STATUS_LABELS[ol.status]}</Badge> {SOURCE_LABELS[ol.source] || ol.source}</span>
                          <span className="text-muted-foreground">{formatDate(ol.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(customerHistory.testDrives as { id: string; scheduledAt: string; status: string; vehicle: { make: { name: string }; model: { name: string } } | null }[]).length > 0 && (
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Test Drive-uri ({(customerHistory.testDrives as unknown[]).length})</p>
                      {(customerHistory.testDrives as { id: string; scheduledAt: string; status: string; vehicle: { make: { name: string }; model: { name: string } } | null }[]).map((td) => (
                        <div key={td.id} className="flex items-center justify-between py-1 border-b last:border-0">
                          <span>{td.vehicle ? `${td.vehicle.make.name} ${td.vehicle.model.name}` : "—"}</span>
                          <span className="text-muted-foreground">{formatDate(td.scheduledAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(customerHistory.leads as unknown[]).length === 0 && (customerHistory.testDrives as unknown[]).length === 0 && (
                    <p className="text-muted-foreground">Prima interacțiune cu acest client.</p>
                  )}
                </div>
              ) : null}
            </div>

            {/* Activity Timeline */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activitate</h3>
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
                  <p className="text-xs text-muted-foreground text-center py-4">Nicio activitate încă.</p>
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
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isCreated ? "bg-emerald-100 text-emerald-600" : isStageChange ? "bg-violet-100 text-violet-600" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-medium">{activity.user ? `${activity.user.firstName} ${activity.user.lastName}` : "Sistem"}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{formatDate(activity.createdAt)}</span>
                        </div>
                        <p className={`text-xs mt-0.5 ${isStageChange ? "text-violet-700 font-medium" : ""}`}>
                          {isStageChange && "→ "}{activity.content}
                        </p>
                        <span className="text-xs text-muted-foreground">{ACTIVITY_LABELS[activity.type] || activity.type}</span>
                      </div>
                    </div>
                  );
                })}
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
    notes: "",
    assignedToId: "",
    vehicleId: "",
    customerId: "",
    scheduleTestDrive: false,
    testDriveDate: "",
    sendBrochure: false,
  });
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
          <h2 className="text-lg font-semibold">Lead Nou</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Phone — primary field, triggers customer search */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Telefon *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
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
                <p className="text-xs font-medium text-blue-700 px-2 py-1">Client existent găsit:</p>
                {customerResults.map((c) => (
                  <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                    className="w-full px-2 py-1.5 text-left text-sm hover:bg-blue-100 rounded flex items-center justify-between">
                    <span className="font-medium">{c.firstName} {c.lastName}</span>
                    <span className="text-xs text-muted-foreground">{c.email || ""}</span>
                  </button>
                ))}
              </div>
            )}

            {/* No customer found hint */}
            {!selectedCustomer && customerSearchDone && customerResults.length === 0 && form.phone.length >= 4 && (
              <p className="text-xs text-muted-foreground mt-1">Client nou — completează datele de mai jos.</p>
            )}
          </div>

          {/* Selected customer card */}
          {selectedCustomer && (
            <div className="flex items-center justify-between rounded-md border p-3 bg-emerald-50 border-emerald-200">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" />
                <div>
                  <span className="text-sm font-medium">{selectedCustomer.firstName} {selectedCustomer.lastName}</span>
                  {selectedCustomer.email && <span className="text-xs text-muted-foreground ml-2">{selectedCustomer.email}</span>}
                </div>
              </div>
              <button type="button" onClick={clearCustomer} className="text-xs text-red-600 hover:underline">Schimbă</button>
            </div>
          )}

          {/* Name + Email fields — only for new customers */}
          {!selectedCustomer && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Prenume *</label>
                  <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Ion" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nume *</label>
                  <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Popescu" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="email@exemplu.ro" />
              </div>
            </>
          )}

          {/* Brand + Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Brand *</label>
              <select
                value={form.brand}
                onChange={(e) => { setForm((f) => ({ ...f, brand: e.target.value, vehicleId: "" })); setSelectedVehicle(null); }}
                className="w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {brands.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sursa *</label>
              <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className="w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring">
                {MANUAL_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Vehicle search */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Interesat de</label>
            {selectedVehicle ? (
              <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {selectedVehicle.make.name} {selectedVehicle.model.name} {selectedVehicle.year}
                  </span>
                  {(selectedVehicle.discountPrice || selectedVehicle.price) && (
                    <span className="text-xs text-muted-foreground">
                      {(selectedVehicle.discountPrice || selectedVehicle.price)!.toLocaleString("ro-RO")} {selectedVehicle.currency}
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => { setSelectedVehicle(null); setForm((f) => ({ ...f, vehicleId: "" })); }} className="text-xs text-red-600 hover:underline">Schimbă</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
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
                            <span className="text-xs font-medium text-muted-foreground">{displayPrice.toLocaleString("ro-RO")} {v.currency}</span>
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
            <label className="text-xs font-medium text-muted-foreground">Agent asignat</label>
            <select value={form.assignedToId} onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Eu</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Note</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={3}
              placeholder="Detalii despre conversație, ce mașină dorește, buget..." />
          </div>

          {/* Options */}
          <div className="space-y-3 rounded-lg border p-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opțiuni</h4>

            {/* Test Drive */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.scheduleTestDrive}
                onChange={(e) => setForm((f) => ({ ...f, scheduleTestDrive: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <Calendar className="h-4 w-4 text-cyan-600" />
              <span className="text-sm">Programează test drive</span>
            </label>

            {form.scheduleTestDrive && (
              <div className="ml-6 space-y-1">
                <input type="datetime-local" value={form.testDriveDate}
                  onChange={(e) => setForm((f) => ({ ...f, testDriveDate: e.target.value }))}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                {!form.vehicleId && <p className="text-xs text-amber-600">⚠ Selectează o mașină pentru test drive.</p>}
              </div>
            )}

            {/* Brochure */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.sendBrochure}
                onChange={(e) => setForm((f) => ({ ...f, sendBrochure: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <Mail className="h-4 w-4 text-blue-600" />
              <span className="text-sm">Trimite broșură pe email</span>
            </label>
            {form.sendBrochure && !form.email && !selectedCustomer?.email && (
              <p className="ml-6 text-xs text-amber-600">⚠ Adaugă adresa de email.</p>
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
    </div>
  );
}

// ─── Main Sales Client ─────────────────────────────────

export default function SalesClient({
  initialLeads,
  initialStages,
  agents,
  activeTestDrives = [],
}: {
  initialLeads: Lead[];
  initialStages: PipelineStage[];
  agents: Agent[];
  activeTestDrives?: ActiveTestDrive[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showNewLeadForm, setShowNewLeadForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"leads" | "pipeline">("leads");
  const { selectedBrand } = useBrand();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState("");
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
    if (filterAgent === "__none") filtered = filtered.filter((l) => !l.assignedTo);
    else if (filterAgent) filtered = filtered.filter((l) => l.assignedTo?.id === filterAgent);

    if (sortBy === "priority") filtered.sort((a, b) => b.priority - a.priority || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return filtered;
  }, [leads, searchQuery, filterSource, filterAgent, sortBy]);

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
    if (searchQuery || filterSource || filterAgent) {
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
          if (filterAgent === "__none" && d.assignedTo) return false;
          if (filterAgent && filterAgent !== "__none" && d.assignedTo?.id !== filterAgent) return false;
          return true;
        }),
      }));
    }

    return stages;
  }, [initialStages, selectedBrand, searchQuery, filterSource, filterAgent]);

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
          <h1 className="font-heading text-2xl font-bold tracking-tight">Vânzări</h1>
          <p className="text-sm text-muted-foreground">
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
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "leads" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <AlertCircle className="h-4 w-4" />
          Lead-uri Noi
          {newLeads.length > 0 && <Badge variant={activeTab === "leads" ? "default" : "secondary"} className="text-xs">{newLeads.length}</Badge>}
        </button>
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "pipeline" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <ArrowRight className="h-4 w-4" />
          Pipeline
          <Badge variant={activeTab === "pipeline" ? "default" : "secondary"} className="text-xs">
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Caută după nume sau mașină..."
                className="w-full rounded-md border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors ${showFilters || filterSource || filterAgent ? "bg-primary/10 border-primary" : ""}`}
            >
              <Filter className="h-4 w-4" /> Filtre
              {(filterSource || filterAgent) && <span className="h-2 w-2 rounded-full bg-primary" />}
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
              <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="rounded-md border px-3 py-1.5 text-sm bg-white">
                <option value="">Toți agenții</option>
                <option value="__none">Neasignat</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
              </select>
              {(filterSource || filterAgent) && (
                <button onClick={() => { setFilterSource(""); setFilterAgent(""); }} className="text-xs text-red-600 hover:underline">Resetează</button>
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
                  testDrive={activeTestDrives.find((td) => td.customerId === lead.customer.id && (!lead.vehicle?.id || td.vehicleId === lead.vehicle.id))}
                  onMoved={handleMoved}
                  onSelect={setSelectedLeadId}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Niciun lead nou.</p>
              <p className="text-xs mt-1">Lead-urile noi din website sau adăugate manual apar aici.</p>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Caută în pipeline..."
                className="w-full rounded-md border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors ${showFilters || filterSource || filterAgent ? "bg-primary/10 border-primary" : ""}`}
            >
              <Filter className="h-4 w-4" /> Filtre
              {(filterSource || filterAgent) && <span className="h-2 w-2 rounded-full bg-primary" />}
            </button>
          </div>

          {showFilters && (
            <div className="flex gap-3 p-3 rounded-lg border bg-muted/30">
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="rounded-md border px-3 py-1.5 text-sm bg-white">
                <option value="">Toate sursele</option>
                {availableSources.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>)}
              </select>
              <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="rounded-md border px-3 py-1.5 text-sm bg-white">
                <option value="">Toți agenții</option>
                <option value="__none">Neasignat</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
              </select>
              {(filterSource || filterAgent) && (
                <button onClick={() => { setFilterSource(""); setFilterAgent(""); }} className="text-xs text-red-600 hover:underline">Resetează</button>
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
                      {stageValue > 0 && <span className="text-xs text-muted-foreground">{formatCurrency(stageValue)}</span>}
                      <Badge variant="secondary" className="text-xs">{stage.deals.length}</Badge>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-2">
                    {stage.deals.length === 0 ? (
                      <div className="flex items-center justify-center rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                        Niciun deal
                      </div>
                    ) : (
                      stage.deals.map((deal) => {
                        const dealBrand = (deal as Record<string, unknown>)._brand as string | null;
                        const showBrandBadge = !selectedBrand || selectedBrand === "ALL";
                        const stale = deal.createdAt ? daysSince(deal.createdAt) >= STALE_DAYS : false;
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
                              stale={stale}
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
          onLeadUpdated={() => window.location.reload()}
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
