export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function buildObjectPath(
  tenantId: string,
  yyyy: number,
  mm: number,
  dd: number,
): string {
  return `tenant_id=${tenantId}/yyyy=${yyyy}/mm=${pad2(mm)}/dd=${pad2(dd)}/data.csv`;
}

export function isValidDate(yyyy: number, mm: number, dd: number): boolean {
  if (!Number.isInteger(yyyy) || !Number.isInteger(mm) || !Number.isInteger(dd)) return false;
  if (yyyy < 2000 || yyyy > 2100) return false;
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;
  // JS Date で末日チェック (UTC で十分: 日付の妥当性のみ)
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return d.getUTCFullYear() === yyyy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd;
}

export function getJstDateParts(
  now: Date = new Date(),
): { yyyy: number; mm: number; dd: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { yyyy: get("year"), mm: get("month"), dd: get("day") };
}

export const PATH_DD_RE = /\/dd=(\d{2})\/data\.csv$/;
