"use client";

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { BRAND_LABELS, type BrandType } from "@autoerebus/types";

type BrandFilter = BrandType | "ALL";

interface BrandContextValue {
  selectedBrand: BrandFilter;
  setSelectedBrand: (brand: BrandFilter) => void;
  allowedBrands: string[]; // empty array = all brands allowed
}

const BrandContext = createContext<BrandContextValue>({
  selectedBrand: "ALL",
  setSelectedBrand: () => {},
  allowedBrands: [],
});

export function useBrand() {
  return useContext(BrandContext);
}

const BRAND_OPTIONS: { value: BrandFilter; label: string; color: string }[] = [
  { value: "ALL", label: "Toate brandurile", color: "" },
  { value: "NISSAN", label: "Nissan", color: "#C3002F" },
  { value: "RENAULT", label: "Renault", color: "#FFCC00" },
  { value: "AUTORULATE", label: "Autorulate", color: "#1F4E79" },
  { value: "SERVICE", label: "Service", color: "#2E7D32" },
];

const STORAGE_KEY = "autoerebus_brand";

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  // Get user's allowed brands from session (empty = all allowed)
  const userBrands = ((session?.user as any)?.brands as string[]) || [];
  const userRole = (session?.user as any)?.role;
  // Super admin sees all brands; others restricted by their brands array
  const allowedBrands = userRole === "SUPER_ADMIN" ? [] : userBrands;
  const isRestricted = allowedBrands.length > 0;

  // Initialize from URL param, then localStorage, then "ALL"
  const urlBrand = searchParams.get("brand") as BrandFilter | null;
  const [storedBrand, setStoredBrand] = useState<BrandFilter>("ALL");
  const [initialized, setInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as BrandFilter | null;
    if (saved && BRAND_OPTIONS.some((o) => o.value === saved)) {
      setStoredBrand(saved);
    }
    setInitialized(true);
  }, []);

  // If user is restricted to a single brand, force-select it
  let selectedBrand: BrandFilter = urlBrand || storedBrand;
  if (isRestricted) {
    if (allowedBrands.length === 1) {
      selectedBrand = allowedBrands[0] as BrandFilter;
    } else if (selectedBrand !== "ALL" && !allowedBrands.includes(selectedBrand)) {
      // User picked a brand they don't have access to → reset
      selectedBrand = allowedBrands[0] as BrandFilter;
    } else if (selectedBrand === "ALL") {
      selectedBrand = allowedBrands[0] as BrandFilter;
    }
  }

  // On first load, if no URL brand but stored brand exists, update URL
  useEffect(() => {
    if (initialized && !urlBrand && storedBrand !== "ALL") {
      const params = new URLSearchParams(searchParams.toString());
      params.set("brand", storedBrand);
      params.delete("page");
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`);
    }
  }, [initialized, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSelectedBrand = useCallback(
    (brand: BrandFilter) => {
      // Save to localStorage
      if (brand === "ALL") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, brand);
      }
      setStoredBrand(brand);

      // Update URL
      const params = new URLSearchParams(searchParams.toString());
      if (brand === "ALL") {
        params.delete("brand");
      } else {
        params.set("brand", brand);
      }
      params.delete("page");
      const query = params.toString();
      router.push(`${pathname}${query ? `?${query}` : ""}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <BrandContext.Provider value={{ selectedBrand, setSelectedBrand, allowedBrands }}>
      {children}
    </BrandContext.Provider>
  );
}

export function BrandSwitcher() {
  const { selectedBrand, setSelectedBrand, allowedBrands } = useBrand();
  const current = BRAND_OPTIONS.find((o) => o.value === selectedBrand);
  const isRestricted = allowedBrands.length > 0;
  const visibleOptions = isRestricted
    ? BRAND_OPTIONS.filter((o) => o.value !== "ALL" && allowedBrands.includes(o.value))
    : BRAND_OPTIONS;
  const isLocked = isRestricted && allowedBrands.length === 1;

  return (
    <div className="relative">
      <select
        value={selectedBrand}
        onChange={(e) => setSelectedBrand(e.target.value as BrandFilter)}
        disabled={isLocked}
        className="h-9 appearance-none rounded-md border border-input bg-background pl-8 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70"
      >
        {visibleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {/* Color dot indicator */}
      <span
        className="pointer-events-none absolute left-2.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
        style={{
          backgroundColor: current?.color || "#6B7280",
        }}
      />
      {/* Chevron */}
      <svg
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
