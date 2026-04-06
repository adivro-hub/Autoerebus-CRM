"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@autoerebus/ui/components/button";
import { Input } from "@autoerebus/ui/components/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email sau parola incorecta");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("A aparut o eroare. Incercati din nou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel - Branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div>
          <h1 className="font-heading text-base font-bold">Autoerebus</h1>
          <p className="mt-1 text-primary-foreground/70">CRM Platform</p>
        </div>
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="font-heading text-base font-semibold">
              Gestioneaza-ti afacerea eficient
            </h2>
            <p className="text-primary-foreground/70">
              Nissan &middot; Renault &middot; Autorulate &middot; Service
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-primary-foreground/10 p-4">
              <p className="text-base font-bold">4</p>
              <p className="text-sm text-primary-foreground/70">Branduri</p>
            </div>
            <div className="rounded-lg bg-primary-foreground/10 p-4">
              <p className="text-base font-bold">360&deg;</p>
              <p className="text-sm text-primary-foreground/70">Vizibilitate</p>
            </div>
          </div>
        </div>
        <p className="text-sm text-primary-foreground/50">
          &copy; {new Date().getFullYear()} Autoerebus. Toate drepturile rezervate.
        </p>
      </div>

      {/* Right panel - Login Form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden">
            <h1 className="font-heading text-base font-bold">Autoerebus</h1>
            <p className="text-gray-500">CRM Platform</p>
          </div>

          <div className="space-y-2">
            <h2 className="font-heading text-base font-semibold tracking-tight">
              Autentificare
            </h2>
            <p className="text-sm text-gray-500">
              Introduceti datele de conectare pentru a accesa platforma
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              placeholder="exemplu@autoerebus.ro"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              label="Parola"
              type="password"
              placeholder="Introduceti parola"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Se autentifica..." : "Autentificare"}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Contactati administratorul pentru resetarea parolei
          </p>
        </div>
      </div>
    </div>
  );
}
