export interface KuluEntry {
  id: string;
  name: string;
  amount: number;
  date: string; // ISO yyyy-mm-dd
  phone?: string;
  createdAt: number;
}

const KEY = "kulu_entries_v1";
const PHONE_KEY = "kulu_brother_phone_v1";

export function loadEntries(): KuluEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as KuluEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries: KuluEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function getBrotherPhone(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(PHONE_KEY) ?? "";
}

export function setBrotherPhone(phone: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PHONE_KEY, phone);
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function toCSV(entries: KuluEntry[]): string {
  const header = ["Name", "Amount", "Date", "Phone", "Created At"];
  const rows = entries.map((e) => [
    `"${e.name.replace(/"/g, '""')}"`,
    `"${e.amount}"`,
    `"${e.date}"`,
    `"${(e.phone ?? "").replace(/"/g, '""')}"`,
    `"${new Date(e.createdAt).toISOString()}"`,
  ]);
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}