"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@autoerebus/ui/components/badge";
import {
  X,
  User,
  Phone,
  Mail,
  Clock,
  Car,
  TrendingUp,
  Calendar,
  Wrench,
  Loader2,
  MapPin,
  Building,
} from "lucide-react";

interface CustomerData {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    source: string | null;
    type: string;
    company: string | null;
    city: string | null;
    county: string | null;
    createdAt: string;
  };
  leads: {
    id: string;
    status: string;
    source: string;
    brand: string;
    notes: string | null;
    createdAt: string;
    vehicle: {
      title: string | null;
      make: { name: string };
      model: { name: string };
      year: number;
    } | null;
    deals: {
      stage: { name: string; color: string };
      value: number | null;
      currency: string;
    }[];
  }[];
  testDrives: {
    id: string;
    scheduledAt: string;
    status: string;
    brand: string;
    feedback: string | null;
    notes: string | null;
    vehicle: {
      title: string | null;
      make: { name: string };
      model: { name: string };
      year: number;
    } | null;
  }[];
  serviceOrders: {
    id: string;
    status: string;
    type: string;
    createdAt: string;
    description: string | null;
  }[];
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nou", CONTACTED: "Contactat", QUALIFIED: "Calificat",
  NEGOTIATION: "Negociere", WON: "Câștigat", LOST: "Pierdut",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800", CONTACTED: "bg-violet-100 text-violet-800",
  QUALIFIED: "bg-amber-100 text-amber-800", NEGOTIATION: "bg-orange-100 text-orange-800",
  WON: "bg-emerald-100 text-emerald-800", LOST: "bg-gray-100 text-gray-800",
};

const TD_STATUS: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Programat", color: "bg-blue-100 text-blue-800" },
  CONFIRMED: { label: "Confirmat", color: "bg-green-100 text-green-800" },
  IN_PROGRESS: { label: "În desfășurare", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "Finalizat", color: "bg-gray-100 text-gray-700" },
  CANCELLED: { label: "Anulat", color: "bg-red-100 text-red-800" },
  NO_SHOW: { label: "Neprezentare", color: "bg-red-100 text-red-800" },
};

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE_NISSAN: "Website Nissan", WEBSITE_RENAULT: "Website Renault",
  WEBSITE_AUTORULATE: "Website Rulate", PHONE: "Telefon",
  WALK_IN: "Walk-in", REFERRAL: "Recomandare", AUTOVIT: "Autovit",
  FACEBOOK: "Facebook", GOOGLE_ADS: "Google Ads", OTHER: "Altele",
};

const BRAND_LABELS: Record<string, string> = {
  NISSAN: "Nissan", RENAULT: "Renault", AUTORULATE: "Rulate", SERVICE: "Service",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ro-RO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString("ro-RO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function CustomerOverlay({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}/history`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl animate-in slide-in-from-right">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4">
          <h2 className="text-base font-semibold">Istoric Client</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : !data ? (
          <div className="p-6 text-center text-gray-500">Clientul nu a fost găsit.</div>
        ) : (
          <div className="p-4 space-y-5">
            {/* Customer Info */}
            <div className="space-y-2">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">
                      {data.customer.firstName} {data.customer.lastName}
                    </h3>
                    {data.customer.company && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Building className="h-3 w-3" /> {data.customer.company}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1.5 text-sm">
                  {data.customer.phone && (
                    <a href={`tel:${data.customer.phone}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                      <Phone className="h-3.5 w-3.5" /> {data.customer.phone}
                    </a>
                  )}
                  {data.customer.email && (
                    <a href={`mailto:${data.customer.email}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                      <Mail className="h-3.5 w-3.5" /> {data.customer.email}
                    </a>
                  )}
                  {(data.customer.city || data.customer.county) && (
                    <span className="flex items-center gap-2 text-gray-500">
                      <MapPin className="h-3.5 w-3.5" /> {[data.customer.city, data.customer.county].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-sm text-gray-500 pt-2 border-t">
                  {data.customer.source && (
                    <span>Sursa: {SOURCE_LABELS[data.customer.source] || data.customer.source}</span>
                  )}
                  <span>Client din: {formatDate(data.customer.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <TrendingUp className="h-4 w-4 mx-auto text-blue-600 mb-1" />
                <p className="text-base font-bold">{data.leads.length}</p>
                <p className="text-sm text-gray-500">Lead-uri</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Calendar className="h-4 w-4 mx-auto text-cyan-600 mb-1" />
                <p className="text-base font-bold">{data.testDrives.length}</p>
                <p className="text-sm text-gray-500">Test Drive</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Wrench className="h-4 w-4 mx-auto text-green-600 mb-1" />
                <p className="text-base font-bold">{data.serviceOrders.length}</p>
                <p className="text-sm text-gray-500">Service</p>
              </div>
            </div>

            {/* Leads */}
            {data.leads.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Lead-uri ({data.leads.length})
                </h3>
                <div className="space-y-2">
                  {data.leads.map((lead) => (
                    <div key={lead.id} className="rounded-lg border p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={STATUS_COLORS[lead.status] + " text-sm"}>
                            {STATUS_LABELS[lead.status] || lead.status}
                          </Badge>
                          <Badge variant="outline" className="text-sm">
                            {BRAND_LABELS[lead.brand] || lead.brand}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-500">{formatDate(lead.createdAt)}</span>
                      </div>

                      {lead.vehicle && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Car className="h-3.5 w-3.5 text-gray-500" />
                          {lead.vehicle.title || `${lead.vehicle.make.name} ${lead.vehicle.model.name} ${lead.vehicle.year}`}
                        </div>
                      )}

                      {lead.deals[0] && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: lead.deals[0].stage.color }} />
                          <span>{lead.deals[0].stage.name}</span>
                          {lead.deals[0].value && (
                            <span className="text-gray-500">
                              {lead.deals[0].value.toLocaleString("ro-RO")} {lead.deals[0].currency}
                            </span>
                          )}
                        </div>
                      )}

                      {lead.notes && (
                        <p className="text-sm text-gray-500 line-clamp-2">{lead.notes}</p>
                      )}

                      <div className="text-sm text-gray-500">
                        Sursa: {SOURCE_LABELS[lead.source] || lead.source}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Test Drives */}
            {data.testDrives.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Test Drive-uri ({data.testDrives.length})
                </h3>
                <div className="space-y-2">
                  {data.testDrives.map((td) => {
                    const st = TD_STATUS[td.status] || { label: td.status, color: "bg-gray-100 text-gray-800" };
                    return (
                      <div key={td.id} className="rounded-lg border p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Badge className={st.color + " text-sm"}>{st.label}</Badge>
                          <span className="text-sm text-gray-500">{formatDateTime(td.scheduledAt)}</span>
                        </div>
                        {td.vehicle && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Car className="h-3.5 w-3.5 text-gray-500" />
                            {td.vehicle.title || `${td.vehicle.make.name} ${td.vehicle.model.name} ${td.vehicle.year}`}
                          </div>
                        )}
                        {td.feedback && (
                          <p className="text-sm"><span className="font-medium">Feedback:</span> {td.feedback}</p>
                        )}
                        {td.notes && (
                          <p className="text-sm text-gray-500 line-clamp-2">{td.notes}</p>
                        )}
                        <div className="text-sm text-gray-500">
                          Brand: {BRAND_LABELS[td.brand] || td.brand}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Service Orders */}
            {data.serviceOrders.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5" /> Comenzi Service ({data.serviceOrders.length})
                </h3>
                <div className="space-y-2">
                  {data.serviceOrders.map((so) => (
                    <div key={so.id} className="rounded-lg border p-3 flex items-center justify-between">
                      <div>
                        <Badge variant="outline" className="text-sm">{so.type}</Badge>
                        <span className="text-sm text-gray-500 ml-2">{so.status}</span>
                        {so.description && <p className="text-sm text-gray-500 mt-1 line-clamp-1">{so.description}</p>}
                      </div>
                      <span className="text-sm text-gray-500">{formatDate(so.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {data.leads.length === 0 && data.testDrives.length === 0 && data.serviceOrders.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nicio interacțiune anterioară cu acest client.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
