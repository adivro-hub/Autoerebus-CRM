"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui";
import { Button } from "@autoerebus/ui";
import { Input } from "@autoerebus/ui";
import { Badge } from "@autoerebus/ui";
import { Mail, MessageSquare, Bell, Check, Edit2, X } from "lucide-react";

interface Template {
  id: string;
  key: string;
  channel: string;
  subject: string | null;
  body: string;
  enabled: boolean;
}

interface Props {
  initialTemplates: Template[];
}

const KEY_LABELS: Record<string, string> = {
  demo_booking_pending: "Rezervare demo nouă — pentru aprobare",
  demo_booking_approved: "Rezervare demo aprobată",
  demo_booking_rejected: "Rezervare demo respinsă",
  demo_booking_conflicted: "Conflict cu test drive",
  demo_booking_reminder_24h: "Reminder 24h înainte",
  demo_booking_reminder_8h: "Reminder 8h înainte",
  demo_booking_reminder_3h_email: "Reminder URGENT 3h (email)",
  demo_booking_reminder_3h_sms: "Reminder URGENT 3h (SMS)",
};

const PLACEHOLDERS: Record<string, string[]> = {
  demo_booking_pending: ["supervisorName", "creatorName", "recipientName", "vehicleTitle", "startDate", "endDate", "purpose", "link"],
  demo_booking_approved: ["recipientName", "vehicleTitle", "startDate", "endDate", "supervisorName", "link"],
  demo_booking_rejected: ["recipientName", "vehicleTitle", "startDate", "endDate", "reason", "link"],
  demo_booking_conflicted: ["recipientName", "vehicleTitle", "testDriveDate", "endDate", "link"],
  demo_booking_reminder_24h: ["recipientName", "vehicleTitle", "endDate", "link"],
  demo_booking_reminder_8h: ["recipientName", "vehicleTitle", "endDate", "link"],
  demo_booking_reminder_3h_email: ["recipientName", "vehicleTitle", "endDate", "endTime", "link"],
  demo_booking_reminder_3h_sms: ["recipientName", "vehicleTitle", "endTime"],
};

function channelIcon(ch: string) {
  if (ch === "EMAIL") return <Mail className="h-4 w-4" />;
  if (ch === "SMS") return <MessageSquare className="h-4 w-4" />;
  return <Bell className="h-4 w-4" />;
}

export default function TemplatesClient({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(tpl: Template) {
    setEditingId(tpl.id);
    setEditSubject(tpl.subject || "");
    setEditBody(tpl.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditSubject("");
    setEditBody("");
  }

  async function save(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/notification-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editSubject,
          body: editBody,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTemplates((prev) => prev.map((t) => (t.id === id ? data.template : t)));
        cancelEdit();
      } else {
        alert("Eroare: " + data.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(tpl: Template) {
    const res = await fetch(`/api/notification-templates/${tpl.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !tpl.enabled }),
    });
    const data = await res.json();
    if (data.success) {
      setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? data.template : t)));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Template-uri notificări</h1>
        <p className="text-sm text-muted-foreground">
          Editează conținutul mesajelor trimise automat. Folosește placeholders {`{{varName}}`} pentru date dinamice.
        </p>
      </div>

      <div className="space-y-3">
        {templates.map((tpl) => {
          const isEditing = editingId === tpl.id;
          const placeholders = PLACEHOLDERS[tpl.key] || [];
          return (
            <Card key={tpl.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {channelIcon(tpl.channel)}
                    <CardTitle className="text-base">{KEY_LABELS[tpl.key] || tpl.key}</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {tpl.channel}
                    </Badge>
                    {!tpl.enabled && (
                      <Badge variant="outline" className="border-red-300 text-red-700">
                        Dezactivat
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!isEditing && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => toggleEnabled(tpl)}>
                          {tpl.enabled ? "Dezactivează" : "Activează"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startEdit(tpl)}>
                          <Edit2 className="mr-1 h-3 w-3" /> Editează
                        </Button>
                      </>
                    )}
                    {isEditing && (
                      <>
                        <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                          <X className="mr-1 h-3 w-3" /> Anulează
                        </Button>
                        <Button size="sm" onClick={() => save(tpl.id)} disabled={saving}>
                          <Check className="mr-1 h-3 w-3" /> Salvează
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {tpl.channel === "EMAIL" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Subiect email
                    </label>
                    {isEditing ? (
                      <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                    ) : (
                      <p className="text-sm">{tpl.subject || "—"}</p>
                    )}
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Conținut
                  </label>
                  {isEditing ? (
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={tpl.channel === "SMS" ? 2 : 6}
                      className="w-full rounded-md border px-3 py-2 text-sm font-mono"
                      maxLength={tpl.channel === "SMS" ? 160 : undefined}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs font-mono">
                      {tpl.body}
                    </pre>
                  )}
                </div>

                {placeholders.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Variabile disponibile:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {placeholders.map((ph) => (
                        <Badge key={ph} variant="outline" className="text-xs font-mono">
                          {`{{${ph}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
