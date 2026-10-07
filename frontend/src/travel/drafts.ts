import type { Place, Metadata, Item, Trip } from "./client";
import { validPlanning } from "./planner";
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
      planning: trip.planning,
    },
    items: trip.items || [],
    cloud_id: trip.id,
    version: trip.version,
    updated_at: trip.updated_at,
  };
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const optionalPlaceStrings = {
  local_name: 1000,
  address: 2000,
  country: 200,
  country_code: 2,
  region: 500,
  timezone: 100,
  observed_at: 100,
  source_url: 2000,
  category: 40,
  opening_hours: 500,
  website: 1000,
  wikipedia: 400,
  wheelchair: 40,
  fee: 40,
  description: 1000,
};
function isPlace(p: unknown): p is Place {
  if (!p || typeof p !== "object") return false;
  const x = p as Place;
  const values = p as Record<string, unknown>;
  return (
    typeof x.id === "string" &&
    uuid.test(x.id) &&
    [
      x.name,
      x.provider,
      x.source_id,
      x.kind,
      x.license,
      x.attribution,
      x.retrieved_at,
    ].every((v) => typeof v === "string" && v.length <= 2000) &&
    x.name.length > 0 &&
    x.name.length <= 1000 &&
    Number.isFinite(Date.parse(x.retrieved_at)) &&
    Number.isFinite(x.longitude) &&
    Number.isFinite(x.latitude) &&
    Math.abs(x.longitude) <= 180 &&
    Math.abs(x.latitude) <= 90 &&
    Object.entries(optionalPlaceStrings).every(
      ([key, max]) =>
        values[key] == null ||
        (typeof values[key] === "string" &&
          (values[key] as string).length <= max),
    ) &&
    (x.distance_m == null ||
      (Number.isInteger(x.distance_m) &&
        x.distance_m >= 0 &&
        x.distance_m <= 10000000)) &&
    (x.recommended_duration_minutes == null ||
      (Number.isInteger(x.recommended_duration_minutes) &&
        x.recommended_duration_minutes >= 10 &&
        x.recommended_duration_minutes <= 240))
  );
}
function validLocale(timezone: unknown, currency: unknown) {
  if (
    typeof timezone !== "string" ||
    typeof currency !== "string" ||
    !/^[A-Z]{3}$/.test(currency)
  )
    return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return Intl.supportedValuesOf("currency").includes(currency);
  } catch {
    return false;
  }
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
    validLocale(d.metadata.timezone, d.metadata.currency) &&
    Date.parse(d.metadata.end_date) >= Date.parse(d.metadata.start_date) &&
    Date.parse(d.metadata.end_date) - Date.parse(d.metadata.start_date) <
      30 * 86400000 &&
    (!d.metadata.planning || validPlanning(d.metadata.planning)) &&
    Array.isArray(d.items) &&
    d.items.length <= 200 &&
    d.items.every(
      (i) =>
        !!i &&
        typeof i === "object" &&
        typeof i.id === "string" &&
        Number.isInteger(i.day_index) &&
        i.day_index >= 0 &&
        i.day_index <=
          (Date.parse(d.metadata.end_date) -
            Date.parse(d.metadata.start_date)) /
            86400000 &&
        Number.isInteger(i.position) &&
        i.position >= 0 &&
        i.position < 200 &&
        typeof i.notes === "string" &&
        i.notes.length <= 4000 &&
        isPlace(i.place),
    ) &&
    (!d.metadata.planning ||
      d.metadata.planning.stale ||
      ((d.metadata.planning.visits || []).length === d.items.length &&
        (d.metadata.planning.visits || []).every((v) =>
          d.items.some(
            (i) =>
              i.day_index === v.day_index &&
              i.position === v.position &&
              i.place.id === v.place_id,
          ),
        ) &&
        new Set(
          (d.metadata.planning.visits || []).map(
            (v) => `${v.day_index}:${v.position}`,
          ),
        ).size === d.items.length))
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
