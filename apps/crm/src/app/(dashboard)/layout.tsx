import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { BrandProvider } from "@/components/brand-switcher";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <BrandProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
              {children}
            </main>
          </div>
        </div>
      </BrandProvider>
    </Suspense>
  );
}
