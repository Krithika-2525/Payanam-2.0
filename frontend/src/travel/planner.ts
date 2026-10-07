import type { components } from "./schema";
import type { Draft } from "./drafts";
import type { Place } from "./client";
export type Plan = components["schemas"]["ItineraryPlan"];
export type Preferences = components["schemas"]["ItineraryRequest"];
export type Planning = components["schemas"]["PlanningState"];
export type Visit = components["schemas"]["PlannedVisit"];
export const categories = [
  "heritage",
  "museum",
  "temple",
  "nature",
  "viewpoint",
  "food",
  "attraction",
] as const;
export const categoryName: Record<string, string> = {
  heritage: "History & heritage",
  museum: "Museums & art",
  temple: "Culture & sacred places",
  nature: "Parks & nature",
  viewpoint: "Scenic viewpoints",
  food: "Food & cafés",
  attraction: "Landmarks",
};
export const initialPacking = [
  "Photo ID / passport",
  "Tickets & reservations",
  "Water bottle",
  "Power bank & charger",
  "Comfortable walking shoes",
  "Personal medicines",
];
export function safeLink(value?: string | null) {
  try {
    const u = new URL(value || "");
    return ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function dayDate(start: string, index: number) {
  return new Date(new Date(start + "T12:00:00Z").getTime() + index * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function dayCount(draft: Draft) {
  return Math.max(
    1,
    Math.min(
      30,
      Math.round(
        (Date.parse(draft.metadata.end_date) -
          Date.parse(draft.metadata.start_date)) /
          86400000,
      ) + 1,
    ),
  );
}
export function fromPlan(plan: Plan, previous: Draft | null): Draft {
  const items = plan.days.flatMap((d) =>
    d.stops.map((s, position) => ({
      id: crypto.randomUUID(),
      day_index: d.day_index,
      position,
      place: s.place,
      notes:
        previous?.items.find((i) => i.place.id === s.place.id)?.notes || "",
    })),
  );
  const p = plan.preferences;
  const planning: Planning = {
    city_id: plan.city.id,
    mode: p.mode,
    pace: p.pace,
    interests: p.interests || [],
    day_start: p.day_start,
    day_end: p.day_end,
    visits: plan.days.flatMap((d) =>
      d.stops.map((s, position) => ({
        place_id: s.place.id,
        day_index: d.day_index,
        position,
        arrival: s.arrival,
        departure: s.departure,
        travel_minutes: s.travel_minutes,
        distance_m: s.distance_m,
        duration_minutes: s.duration_minutes,
        hours_status: s.hours_status,
      })),
    ),
    expenses: previous?.metadata.planning?.expenses || [],
    checklist:
      previous?.metadata.planning?.checklist ||
      initialPacking.map((label) => ({
        id: crypto.randomUUID(),
        label,
        done: false,
      })),
    budget: previous?.metadata.planning?.budget || 0,
    stale: false,
  };
  return {
    ...(previous || {}),
    id: previous?.id || crypto.randomUUID(),
    metadata: {
      title: previous?.metadata.planning
        ? previous.metadata.title
        : plan.city.name + " · a journey to remember",
      start_date: p.start_date,
      end_date: dayDate(p.start_date, p.days - 1),
      timezone: plan.city.timezone || "UTC",
      currency:
        previous?.metadata.currency ||
        { IN: "INR", FR: "EUR", JP: "JPY", GB: "GBP", TH: "THB", SG: "SGD" }[
          plan.city.country_code || "IN"
        ] ||
        "USD",
      planning,
    },
    items,
    updated_at: new Date().toISOString(),
  };
}
export function markChanged(draft: Draft, items: Draft["items"]): Draft {
  return {
    ...draft,
    items,
    metadata: {
      ...draft.metadata,
      planning: draft.metadata.planning
        ? { ...draft.metadata.planning, stale: true }
        : null,
    },
  };
}
export function validPlanning(p: unknown): p is Planning {
  if (!p || typeof p !== "object") return false;
  const x = p as Planning,
    uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  return (
    typeof x.city_id === "string" &&
    uuid.test(x.city_id) &&
    ["walk", "drive"].includes(x.mode) &&
    ["relaxed", "balanced", "packed"].includes(x.pace) &&
    time.test(x.day_start) &&
    time.test(x.day_end) &&
    x.day_end > x.day_start &&
    typeof x.stale === "boolean" &&
    Number.isFinite(x.budget) &&
    x.budget >= 0 &&
    x.budget <= 10000000 &&
    Array.isArray(x.interests) &&
    x.interests.length <= 7 &&
    x.interests.every((c) => categories.includes(c)) &&
    Array.isArray(x.visits) &&
    x.visits.length <= 100 &&
    x.visits.every(
      (v) =>
        !!v &&
        uuid.test(v.place_id) &&
        Number.isInteger(v.day_index) &&
        v.day_index >= 0 &&
        v.day_index < 30 &&
        Number.isInteger(v.position) &&
        v.position >= 0 &&
        v.position < 200 &&
        time.test(v.arrival) &&
        time.test(v.departure) &&
        v.departure > v.arrival &&
        Number(v.departure.slice(0, 2)) * 60 +
          Number(v.departure.slice(3)) -
          Number(v.arrival.slice(0, 2)) * 60 -
          Number(v.arrival.slice(3)) ===
          v.duration_minutes &&
        Number.isFinite(v.travel_minutes) &&
        v.travel_minutes >= 0 &&
        v.travel_minutes <= 1440 &&
        Number.isFinite(v.duration_minutes) &&
        v.duration_minutes >= 10 &&
        v.duration_minutes <= 240 &&
        Number.isFinite(v.distance_m) &&
        v.distance_m >= 0 &&
        v.distance_m <= 1000000 &&
        ["mapped", "unknown", "unverified"].includes(v.hours_status),
    ) &&
    Array.isArray(x.expenses) &&
    x.expenses.length <= 50 &&
    x.expenses.every(
      (e) =>
        !!e &&
        typeof e.id === "string" &&
        e.id.length <= 100 &&
        typeof e.label === "string" &&
        e.label.length <= 120 &&
        Number.isFinite(e.amount) &&
        e.amount >= 0 &&
        e.amount <= 10000000 &&
        ["transport", "stay", "food", "activities", "other"].includes(
          e.category,
        ),
    ) &&
    Array.isArray(x.checklist) &&
    x.checklist.length <= 50 &&
    x.checklist.every(
      (c) =>
        !!c &&
        typeof c.id === "string" &&
        c.id.length <= 100 &&
        typeof c.label === "string" &&
        c.label.length <= 120 &&
        typeof c.done === "boolean",
    ) &&
    new TextEncoder().encode(JSON.stringify(x)).length <= 30000
  );
}
export function textDownload(
  text: string,
  filename: string,
  type = "text/plain",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function escaped(s: string) {
  return s
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;")
    .replace(/\r/g, "");
}
function fold(s: string) {
  const output: string[] = [];
  let line = "";
  for (const ch of s) {
    if (new TextEncoder().encode(line + ch).length > 74) {
      output.push(line);
      line = " " + ch;
    } else line += ch;
  }
  output.push(line);
  return output.join("\r\n");
}
export function calendar(draft: Draft) {
  const p = draft.metadata.planning;
  if (!p || p.stale)
    throw new Error("Recalculate times before exporting a calendar.");
  const timezone = draft.metadata.timezone;
  new Intl.DateTimeFormat("en", { timeZone: timezone });
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Payanam//Journey planner//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const item of draft.items) {
    const visit = p.visits?.find(
      (v) =>
        v.place_id === item.place.id &&
        v.day_index === item.day_index &&
        v.position === item.position,
    );
    if (!visit) continue;
    const date = dayDate(draft.metadata.start_date, item.day_index).replaceAll(
      "-",
      "",
    );
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + item.id + "@payanam",
      "DTSTAMP:" + stamp,
      "DTSTART;TZID=" +
        timezone +
        ":" +
        date +
        "T" +
        visit.arrival.replace(":", "") +
        "00",
      "DTEND;TZID=" +
        timezone +
        ":" +
        date +
        "T" +
        visit.departure.replace(":", "") +
        "00",
      "SUMMARY:" + escaped(item.place.name),
      "LOCATION:" +
        escaped(item.place.name + ", " + (item.place.country || "")),
      "DESCRIPTION:" +
        escaped(
          item.notes +
            "\nPlanned visit; verify hours before travelling. " +
            item.place.attribution,
        ),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
export function directions(city: Place, places: Place[], mode: string) {
  const dest = places[places.length - 1] || city;
  return (
    "https://www.google.com/maps/dir/?" +
    new URLSearchParams({
      api: "1",
      origin: city.latitude + "," + city.longitude,
      destination: dest.latitude + "," + dest.longitude,
      travelmode: mode === "walk" ? "walking" : "driving",
      ...(places.length > 1
        ? {
            waypoints: places
              .slice(0, -1)
              .slice(0, 8)
              .map((p) => p.latitude + "," + p.longitude)
              .join("|"),
          }
        : {}),
    })
  );
}
