"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { Button } from "@autoerebus/ui/components/button";
import { BRAND_LABELS } from "@autoerebus/types";
import { Search, X } from "lucide-react";
import { useBrand } from "@/components/brand-switcher";

const STATUS_OPTIONS = [
  { value: "", label: "Toate statusurile" },
  { value: "IN_TRANSIT", label: "In Tranzit" },
  { value: "IN_STOCK", label: "In Stoc" },
  { value: "RESERVED", label: "Rezervat" },
  { value: "SOLD", label: "Vandut" },
];

const BRAND_OPTIONS = [
  { value: "", label: "Toate brandurile" },
  ...Object.entries(BRAND_LABELS).map(([value, label]) => ({ value, label })),
];

export function InventoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { allowedBrands } = useBrand();
  const isRestricted = allowedBrands.length > 0;
  const isLockedToOne = isRestricted && allowedBrands.length === 1;
  const visibleBrandOptions = isRestricted
    ? BRAND_OPTIONS.filter((o) => o.value === "" || allowedBrands.includes(o.value))
    : BRAND_OPTIONS;
  const [searchValue, setSearchValue] = useState(
    searchParams.get("search") ?? ""
  );
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  // Debounced search — triggers 300ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const current = searchParams.get("search") ?? "";
      if (searchValue !== current) {
        setFilter("search", searchValue);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchValue, searchParams, setFilter]);

  const clearFilters = useCallback(() => {
    setSearchValue("");
    router.push(pathname);
  }, [router, pathname]);

  const hasFilters =
    searchParams.has("brand") ||
    searchParams.has("status") ||
    searchParams.has("condition") ||
    searchParams.has("search");

  const activeBrand = searchParams.get("brand") ?? "";
  const activeStatus = searchParams.get("status") ?? "";
  const activeCondition = searchParams.get("condition") ?? "";
  const activeClass = "border-primary bg-primary/5 ring-1 ring-primary/20";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!isLockedToOne && (
        <select
          value={activeBrand}
          onChange={(e) => setFilter("brand", e.target.value)}
          className={`h-9 rounded-md border bg-background px-3 text-sm ${activeBrand ? activeClass : "border-input"}`}
        >
          {visibleBrandOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      <select
        value={activeStatus}
        onChange={(e) => setFilter("status", e.target.value)}
        className={`h-9 rounded-md border bg-background px-3 text-sm ${activeStatus ? activeClass : "border-input"}`}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        value={activeCondition}
        onChange={(e) => setFilter("condition", e.target.value)}
        className={`h-9 rounded-md border bg-background px-3 text-sm ${activeCondition ? activeClass : "border-input"}`}
      >
        <option value="">Toate starile</option>
        <option value="NEW">Nou</option>
        <option value="USED">Second-hand</option>
        <option value="DEMO">Demo</option>
      </select>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Cauta dupa VIN, marca, model..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className={`h-9 w-64 rounded-md border bg-background pl-8 pr-8 text-sm placeholder:text-gray-500 ${searchValue ? activeClass : "border-input"}`}
        />
        {searchValue && (
          <button
            type="button"
            onClick={() => setSearchValue("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Sterge filtre
        </Button>
      )}
    </div>
  );
}
