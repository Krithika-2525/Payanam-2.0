import type { components } from "./schema";
export type Place = components["schemas"]["ResolvedPlace"];
export type Trip = components["schemas"]["TripDocument"];
export type Metadata = components["schemas"]["TripCreate"];
export type Change = components["schemas"]["TripChange"];
export type Item = components["schemas"]["TripItem"];
export type Capabilities = {
  city_count: number;
  city_snapshot_at: string;
  place_search: boolean;
  cloud_trips: boolean;
  supabase_url: string;
  supabase_publishable_key: string;
  map_style: string;
  live_traffic: boolean;
};
const env = (import.meta as unknown as { env: Record<string, string> }).env;
export const base = (
  env.VITE_API_BASE_URL || (env.DEV ? "http://127.0.0.1:8010" : "")
).replace(/\/$/, "");
export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    key?: string;
    version?: number;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  if (!base)
    throw new APIError(
      "The journey service is being connected. Your draft stays here.",
      "not_configured",
      503,
    );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const headers: Record<string, string> = {};
    if (options.body !== undefined)
      headers["Content-Type"] = "application/json";
    if (options.token) headers.Authorization = "Bearer " + options.token;
    if (options.key) headers["Idempotency-Key"] = options.key;
    if (options.version !== undefined)
      headers["If-Match"] = '"' + options.version + '"';
    const response = await fetch(base + "/api/v2" + path, {
      method: options.method || "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 204) return undefined as T;
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new APIError(
        "The service may be waking up. Your draft is safe; please retry shortly.",
        "service_waking",
        503,
      );
    const data = await response.json();
    if (!response.ok)
      throw new APIError(
        data.message || "Please check your trip details and try again.",
        data.code || "request_failed",
        response.status,
      );
    return data as T;
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError(
      "We could not reach the journey service. Keep your draft and retry.",
      "network_unavailable",
      503,
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
export const getCapabilities = () => request<Capabilities>("/capabilities");
export const findPlaces = (
  query: string,
  source: string,
  country: string,
  signal?: AbortSignal,
) =>
  request<{
    places: Place[];
    source: string;
    cached: boolean;
    message: string;
  }>(
    "/places/search?" +
      new URLSearchParams({
        q: query,
        source,
        ...(country ? { country } : {}),
      }),
    { signal },
  );
export const getTrips = (token: string,cursor?:string|null) =>
  request<{ trips: Trip[];next_cursor:string|null }>("/trips"+(cursor?'?cursor='+encodeURIComponent(cursor):''), { token });
export const getTrip = (id: string, token: string) =>
  request<Trip>("/trips/" + id, { token });
export const createTrip = (metadata: Metadata, token: string, key: string) =>
  request<Trip>("/trips", { method: "POST", body: metadata, token, key });
export const changeTrip = (
  id: string,
  change: Change,
  version: number,
  token: string,
  key: string = crypto.randomUUID(),
) =>
  request<Trip>("/trips/" + id, {
    method: "PATCH",
    body: change,
    version,
    token,
    key,
  });
export const deleteTrip = (trip: Trip, token: string) =>
  request<void>("/trips/" + trip.id, {
    method: "DELETE",
    version: trip.version,
    token,
  });
export function download(value: unknown, name: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
