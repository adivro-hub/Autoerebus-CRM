import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SyncLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  const brands = ((session?.user as { brands?: string[] })?.brands as string[]) || [];
  const isRestricted = role !== "SUPER_ADMIN" && brands.length > 0;
  const canAutorulate = !isRestricted || brands.includes("AUTORULATE");
  if (!canAutorulate) {
    redirect("/inventory");
  }
  return <>{children}</>;
}
