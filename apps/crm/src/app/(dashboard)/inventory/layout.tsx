import { Suspense } from "react";
import { InventoryNav } from "./inventory-nav";

export const metadata = {
  title: "Inventar",
};

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <Suspense>
        <InventoryNav />
      </Suspense>
      {children}
    </div>
  );
}
