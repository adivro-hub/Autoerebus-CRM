"use client";

import { Button } from "@autoerebus/ui";
import { useRouter } from "next/navigation";

export default function GoogleConnectButton({ connected }: { connected: boolean }) {
  const router = useRouter();

  async function disconnect() {
    await fetch("/api/google/disconnect", { method: "POST" });
    router.refresh();
  }

  if (connected) {
    return (
      <Button variant="outline" size="sm" onClick={disconnect}>
        Deconectează
      </Button>
    );
  }

  return (
    <Button onClick={() => (window.location.href = "/api/google/connect")}>
      Conectează Google Calendar
    </Button>
  );
}
