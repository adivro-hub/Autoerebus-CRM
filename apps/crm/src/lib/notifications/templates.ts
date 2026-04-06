import { prisma } from "@autoerebus/database";

/**
 * Render a template by replacing {{placeholders}} with values from data object.
 */
export function renderTemplate(template: string, data: Record<string, string | number | Date | null | undefined>): string {
  let result = template;
  for (const [key, rawValue] of Object.entries(data)) {
    let value: string;
    if (rawValue === null || rawValue === undefined) {
      value = "";
    } else if (rawValue instanceof Date) {
      value = rawValue.toLocaleString("ro-RO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      value = String(rawValue);
    }
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value);
  }
  return result;
}

/**
 * Get a template by key and channel, render it with data.
 */
export async function getRenderedTemplate(
  key: string,
  data: Record<string, string | number | Date | null | undefined>
): Promise<{ subject?: string; body: string } | null> {
  const template = await prisma.notificationTemplate.findFirst({
    where: { key, enabled: true },
  });
  if (!template) return null;

  return {
    subject: template.subject ? renderTemplate(template.subject, data) : undefined,
    body: renderTemplate(template.body, data),
  };
}
