// ─── Brand Constants ────────────────────────────────────

export const BRANDS = ["NISSAN", "RENAULT", "AUTORULATE", "SERVICE"] as const;
export type BrandType = (typeof BRANDS)[number];

export const BRAND_LABELS: Record<BrandType, string> = {
  NISSAN: "Nissan",
  RENAULT: "Renault",
  AUTORULATE: "Autorulate",
  SERVICE: "Service",
};

export const BRAND_COLORS: Record<BrandType, { primary: string; secondary: string }> = {
  NISSAN: { primary: "#C3002F", secondary: "#1A1A1A" },
  RENAULT: { primary: "#FFCC00", secondary: "#1A1A1A" },
  AUTORULATE: { primary: "#1F4E79", secondary: "#2E75B6" },
  SERVICE: { primary: "#2E7D32", secondary: "#4CAF50" },
};

// ─── Pipeline Stage Defaults ────────────────────────────

export const SALES_PIPELINE_STAGES = [
  { name: "Lead Nou", order: 0, color: "#3B82F6" },
  { name: "Contactat", order: 1, color: "#8B5CF6" },
  { name: "Calificat", order: 2, color: "#F59E0B" },
  { name: "Ofertă Trimisă", order: 3, color: "#F97316" },
  { name: "Negociere", order: 4, color: "#EF4444" },
  { name: "Câștigat", order: 5, color: "#10B981" },
  { name: "Pierdut", order: 6, color: "#6B7280" },
] as const;

export const SERVICE_PIPELINE_STAGES = [
  { name: "Programat", order: 0, color: "#3B82F6" },
  { name: "Recepționat", order: 1, color: "#8B5CF6" },
  { name: "În Lucru", order: 2, color: "#F59E0B" },
  { name: "Așteptare Piese", order: 3, color: "#F97316" },
  { name: "Finalizat", order: 4, color: "#10B981" },
  { name: "Livrat", order: 5, color: "#6B7280" },
] as const;

export const CLAIMS_PIPELINE_STAGES = [
  { name: "Deschis", order: 0, color: "#3B82F6" },
  { name: "Documente Necesare", order: 1, color: "#8B5CF6" },
  { name: "În Analiză", order: 2, color: "#F59E0B" },
  { name: "Aprobat", order: 3, color: "#10B981" },
  { name: "În Reparație", order: 4, color: "#F97316" },
  { name: "Finalizat", order: 5, color: "#22C55E" },
  { name: "Respins", order: 6, color: "#EF4444" },
] as const;

// ─── Fuel Type Labels ───────────────────────────────────

export const FUEL_TYPE_LABELS: Record<string, string> = {
  BENZINA: "Benzină",
  DIESEL: "Diesel",
  HYBRID: "Hybrid",
  ELECTRIC: "Electric",
  GPL: "GPL",
  PHEV: "Plug-in Hybrid",
};

// ─── Transmission Labels ────────────────────────────────

export const TRANSMISSION_LABELS: Record<string, string> = {
  MANUALA: "Manuală",
  AUTOMATA: "Automată",
};

// ─── Lead Source Labels ─────────────────────────────────

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  WEBSITE_NISSAN: "Site Nissan",
  WEBSITE_RENAULT: "Site Renault",
  WEBSITE_AUTORULATE: "Site Autorulate",
  WEBSITE_SERVICE: "Site Service",
  PHONE: "Telefon",
  WALK_IN: "Walk-in",
  REFERRAL: "Recomandare",
  AUTOVIT: "Autovit",
  FACEBOOK: "Facebook",
  GOOGLE_ADS: "Google Ads",
  OTHER: "Altele",
};

// ─── User Permissions ───────────────────────────────────

export const PERMISSIONS = [
  "dashboard",
  "inventory.view",
  "inventory.create",
  "inventory.edit",
  "inventory.delete",
  "inventory.import",
  "inventory.autovit",
  "sales.view",
  "sales.create",
  "sales.edit",
  "sales.delete",
  "service.view",
  "service.create",
  "service.edit",
  "service.delete",
  "claims.view",
  "claims.create",
  "claims.edit",
  "claims.delete",
  "testdrive.view",
  "testdrive.create",
  "testdrive.edit",
  "testdrive.delete",
  "customers.view",
  "customers.create",
  "customers.edit",
  "customers.delete",
  "users.view",
  "users.create",
  "users.edit",
  "users.delete",
  "settings.view",
  "settings.edit",
  "reports.view",
  "notifications.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// ─── API Types ──────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardStats {
  totalLeads: number;
  activeDeals: number;
  totalRevenue: number;
  serviceOrders: number;
  activeClaims: number;
  scheduledTestDrives: number;
  vehiclesInStock: number;
  conversionRate: number;
}
