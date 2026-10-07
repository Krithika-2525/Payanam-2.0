import type { Place, Metadata, Item, Trip } from "./client";
export type Draft = {
  id: string;
  metadata: Metadata;
  items: Item[];
  cloud_id?: string;
  cloud_owner?: string;
  version?: number;
  updated_at: string;
};
const storageKey = "payanam.drafts.v2";
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function newDraft(): Draft {
  return {
    id: crypto.randomUUID(),
    metadata: {
      title: "My next journey",
      start_date: today(),
      end_date: today(),
      timezone: "Asia/Kolkata",
      currency: "INR",
    },
    items: [],
    updated_at: new Date().toISOString(),
  };
}
export function cloudDraft(trip: Trip): Draft {
  return {
    id: trip.id,
    metadata: {
      title: trip.title,
      start_date: trip.start_date,
      end_date: trip.end_date,
      timezone: trip.timezone,
      currency: trip.currency,
    },
    items: trip.items || [],
    cloud_id: trip.id,
    version: trip.version,
    updated_at: trip.updated_at,
  };
}
function isPlace(p: unknown): p is Place {
  if (!p || typeof p !== "object") return false;
  const x = p as Place;
  return (
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    x.name.length <= 1000 &&
    Number.isFinite(x.longitude) &&
    Number.isFinite(x.latitude) &&
    Math.abs(x.longitude) <= 180 &&
    Math.abs(x.latitude) <= 90 &&
    typeof x.provider === "string" &&
    typeof x.attribution === "string" &&
    typeof x.retrieved_at === "string"
  );
}
export function validDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const d = value as Draft;
  return (
    typeof d.id === "string" &&
    !!d.metadata &&
    typeof d.metadata.title === "string" &&
    d.metadata.title.length <= 120 &&
    validDate(d.metadata.start_date) &&
    validDate(d.metadata.end_date) &&
    typeof d.metadata.timezone === "string" &&
    typeof d.metadata.currency === "string" &&
    Array.isArray(d.items) &&
    d.items.length <= 200 &&
    d.items.every(
      (i) =>
        !!i &&
        typeof i === "object" &&
        typeof i.id === "string" &&
        Number.isInteger(i.day_index) &&
        i.day_index >= 0 &&
        i.day_index < 30 &&
        Number.isInteger(i.position) &&
        typeof i.notes === "string" &&
        i.notes.length <= 4000 &&
        isPlace(i.place),
    )
  );
}
function validDate(value: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function loadDrafts(): Draft[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw || raw.length > 2_000_000) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(validDraft).slice(0, 50) : [];
  } catch {
    return [];
  }
}
export function persistDraft(draft: Draft) {
  const previous = loadDrafts();
  if (previous.length >= 50 && !previous.some((d) => d.id === draft.id))
    throw new Error(
      "This device is full. Export or delete a draft before creating another.",
    );
  const values = [
    { ...draft, updated_at: new Date().toISOString() },
    ...previous.filter((d) => d.id !== draft.id),
  ];
  const data = JSON.stringify(values);
  if (data.length > 2_000_000)
    throw new Error(
      "This device is full. Export your trip before clearing old drafts.",
    );
  localStorage.setItem(storageKey, data);
}
export function removeDraft(id: string) {
  localStorage.setItem(
    storageKey,
    JSON.stringify(loadDrafts().filter((d) => d.id !== id)),
  );
}
