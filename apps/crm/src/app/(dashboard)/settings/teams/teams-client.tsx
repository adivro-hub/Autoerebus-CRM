"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui";
import { Button } from "@autoerebus/ui";
import { Badge } from "@autoerebus/ui";
import { UserPlus, X, Crown, User as UserIcon } from "lucide-react";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  active?: boolean;
}

interface Member {
  userId: string;
  teamId: string;
  role: string;
  joinedAt: string;
  user: User;
}

interface Team {
  id: string;
  name: string;
  brand: string;
  members: Member[];
}

interface Props {
  initialTeams: Team[];
  allUsers: User[];
}

export default function TeamsClient({ initialTeams, allUsers }: Props) {
  const [teams, setTeams] = useState(initialTeams);
  const [addingToTeam, setAddingToTeam] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState<"MEMBER" | "SUPERVISOR">("MEMBER");

  async function addMember(teamId: string) {
    if (!selectedUser) return;
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUser, role: selectedRole }),
    });
    const data = await res.json();
    if (data.success) {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId
            ? { ...t, members: [...t.members, { ...data.member, teamId, joinedAt: new Date().toISOString() }] }
            : t
        )
      );
      setAddingToTeam(null);
      setSelectedUser("");
      setSelectedRole("MEMBER");
    } else {
      alert("Eroare: " + data.error);
    }
  }

  async function toggleRole(teamId: string, userId: string, currentRole: string) {
    const newRole = currentRole === "SUPERVISOR" ? "MEMBER" : "SUPERVISOR";
    const res = await fetch(`/api/teams/${teamId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const data = await res.json();
    if (data.success) {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId
            ? {
                ...t,
                members: t.members.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)),
              }
            : t
        )
      );
    }
  }

  async function removeMember(teamId: string, userId: string) {
    if (!confirm("Scoate utilizatorul din echipă?")) return;
    const res = await fetch(`/api/teams/${teamId}/members/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId ? { ...t, members: t.members.filter((m) => m.userId !== userId) } : t
        )
      );
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Echipe</h1>
        <p className="text-sm text-muted-foreground">
          Gestionează membrii echipelor per brand. Supervizorii pot aproba rezervările demo ale echipei.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => {
          const availableUsers = allUsers.filter(
            (u) => !team.members.some((m) => m.userId === u.id)
          );
          return (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{team.name}</CardTitle>
                  <Badge variant="outline" className="border-gray-900 text-gray-900">
                    {team.brand}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{team.members.length} membri</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {team.members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between rounded-md border p-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {m.role === "SUPERVISOR" ? (
                        <Crown className="h-4 w-4 text-amber-500" />
                      ) : (
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">
                          {m.user.firstName} {m.user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleRole(team.id, m.userId, m.role)}
                        title={m.role === "SUPERVISOR" ? "Retrogradează la membru" : "Promovează la supervizor"}
                        className="rounded p-1 hover:bg-gray-100"
                      >
                        <Crown
                          className={`h-4 w-4 ${m.role === "SUPERVISOR" ? "text-amber-500" : "text-gray-300"}`}
                        />
                      </button>
                      <button
                        onClick={() => removeMember(team.id, m.userId)}
                        className="rounded p-1 text-red-600 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {team.members.length === 0 && (
                  <p className="text-xs italic text-muted-foreground">Niciun membru.</p>
                )}

                {addingToTeam === team.id ? (
                  <div className="space-y-2 rounded-md border bg-gray-50 p-2">
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="w-full rounded-md border px-2 py-1 text-sm"
                    >
                      <option value="">— alege utilizator —</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as any)}
                      className="w-full rounded-md border px-2 py-1 text-sm"
                    >
                      <option value="MEMBER">Membru</option>
                      <option value="SUPERVISOR">Supervizor</option>
                    </select>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => addMember(team.id)} className="flex-1">
                        Adaugă
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setAddingToTeam(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setAddingToTeam(team.id)}
                    disabled={availableUsers.length === 0}
                  >
                    <UserPlus className="mr-1 h-3 w-3" /> Adaugă membru
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
