"use client";

import { useState } from "react";
import { Button } from "@autoerebus/ui/components/button";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

export default function RevalidateButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  const handleClick = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/service-offers/revalidate", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Revalidare eșuată");
        setStatus("error");
        setTimeout(() => setStatus("idle"), 4000);
        return;
      }
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setErrorMsg("Eroare de conexiune");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={status === "loading"}
      >
        {status === "loading" ? (
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
        ) : status === "success" ? (
          <Check className="h-4 w-4 mr-2 text-green-600" />
        ) : status === "error" ? (
          <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        {status === "loading"
          ? "Se actualizează..."
          : status === "success"
            ? "Actualizat!"
            : "Actualizează cache site"}
      </Button>
      {status === "error" && errorMsg && (
        <span className="text-xs text-red-600">{errorMsg}</span>
      )}
    </div>
  );
}
