import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudSun,
  Compass,
  Download,
  ExternalLink,
  MapPin,
  Plus,
  Printer,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Wallet,
  X,
} from "lucide-react";
import { request, type Place, type Item } from "./client";
import { type Draft, today } from "./drafts";
import { type Hotspots } from "./CityExplorer";
import {
  categories,
  categoryName,
  fromPlan,
  markChanged,
  dayDate,
  dayCount,
  calendar,
  textDownload,
  directions,
  safeLink,
  type Plan,
  type Preferences,
} from "./planner";
import TripTools from "./TripTools";
import "./planner.css";
const TravelMap = lazy(() => import("./TravelMap"));
type Forecast = {
  available: boolean;
  days: {
    date: string;
    high: number;
    low: number;
    rain_probability: number;
    code: number;
  }[];
  retrieved_at?: string;
  message: string;
};
export default function JourneyPlanner({
  city: initialCity,
  draft: incoming,
  onChange,
  onBack,
  onKeep,
  onCloud,
  onExport,
  busy,
  roadEnabled = false,
}: {
  city: Place | null;
  draft: Draft | null;
  onChange: (d: Draft) => void;
  onBack: () => void;
  onKeep: () => void;
  onCloud: () => void;
  onExport: () => void;
  busy: boolean;
  roadEnabled?: boolean;
}) {
  const [city, setCity] = useState(initialCity),
    [data, setData] = useState<Hotspots | null>(null),
    [forecast, setForecast] = useState<Forecast | null>(null),
    [loading, setLoading] = useState(false),
    [generating, setGenerating] = useState(false),
    [error, setError] = useState(""),
    [warnings, setWarnings] = useState<string[]>([]),
    [tab, setTab] = useState<"places" | "itinerary" | "tools">(
      incoming?.metadata.planning ? "itinerary" : "places",
    ),
    [filter, setFilter] = useState(""),
    [text, setText] = useState(""),
    [day, setDay] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [required, setRequired] = useState<string[]>([]),
    [mobileMap, setMobileMap] = useState(false),
    [road, setRoad] = useState<{
      coordinates: number[][];
      attribution: string;
    } | null>(null),
    [routeMessage, setRouteMessage] = useState(""),
    [routing, setRouting] = useState(false);
  const saved = incoming?.metadata.planning;
  const draft = incoming && saved?.city_id === city?.id ? incoming : null;
  const [preferences, setPreferences] = useState<Preferences>({
    city_id: initialCity?.id || saved?.city_id || "",
    start_date: incoming?.metadata.start_date || today(),
    days: incoming ? Math.min(14, dayCount(incoming)) : 3,
    interests: saved?.interests || ["heritage", "museum", "nature"],
    pace: saved?.pace || "balanced",
    mode: saved?.mode || "drive",
    day_start: saved?.day_start || "09:00",
    day_end: saved?.day_end || "18:00",
  });
  const sequence = useRef(0),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    if (initialCity) {
      setCity(initialCity);
      return;
    }
    if (saved?.city_id)
      request<Place>("/places/" + saved.city_id)
        .then((p) => {
          if (active) setCity(p);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [initialCity?.id, saved?.city_id]);
  useEffect(() => {
    controller.current?.abort();
    sequence.current++;
    return () => {
      controller.current?.abort();
      sequence.current++;
    };
  }, [city?.id, incoming?.cloud_owner]);
  useEffect(() => {
    if (!city) return;
    let active = true;
    const abort = new AbortController();
    setLoading(true);
    setData(null);
    setForecast(null);
    setError("");
    setPreferences((p) => ({ ...p, city_id: city.id }));
    request<Hotspots>("/cities/" + city.id + "/hotspots", {
      signal: abort.signal,
    })
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    request<Forecast>("/cities/" + city.id + "/weather", {
      signal: abort.signal,
    })
      .then((f) => {
        if (active) setForecast(f);
      })
      .catch(() => {
        if (active)
          setForecast({
            available: false,
            days: [],
            message: "Weather is unavailable. Your itinerary still works.",
          });
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [city?.id]);
  useEffect(() => {
    setRoad(null);
    setRouteMessage("");
  }, [day, draft?.items, draft?.metadata.planning?.mode]);
  const current =
    draft?.items
      .filter((i) => i.day_index === day)
      .sort((a, b) => a.position - b.position) || [];
  const planning = draft?.metadata.planning;
  const visiblePlaces = (data?.places || []).filter(
    (p) =>
      (!filter || p.category === filter) &&
      (!text || p.name.toLowerCase().includes(text.toLowerCase())),
  );
  const positions =
    tab === "itinerary" ? current.map((i) => i.place) : visiblePlaces;
  const visits = planning?.visits || [];
  const timed = visits
    .filter((v) => v.day_index === day)
    .sort((a, b) => a.position - b.position);
  const weather = forecast?.days.find(
    (w) =>
      w.date ===
      dayDate(draft?.metadata.start_date || preferences.start_date, day),
  );
  const days = draft ? dayCount(draft) : preferences.days;
  const inputsLocked = busy || generating;
  async function refresh() {
    if (!city) return;
    setLoading(true);
    setError("");
    try {
      setData(
        await request<Hotspots>(
          "/cities/" + city.id + "/hotspots?refresh=true",
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function generate(recalculate = false) {
    if (!city || inputsLocked) return;
    if (
      !recalculate &&
      draft?.items.length &&
      !confirm(
        "Generate a new route? This replaces planned stops. Notes for retained places, expenses and packing stay with your trip. Export first if you want to keep this version.",
      )
    )
      return;
    const input: Preferences =
      recalculate && draft
        ? {
            ...preferences,
            city_id: city.id,
            start_date: draft.metadata.start_date,
            days: dayCount(draft),
            mode: planning!.mode,
            pace: planning!.pace,
            interests: planning!.interests,
            day_start: planning!.day_start,
            day_end: planning!.day_end,
            fixed_order: Array.from({ length: dayCount(draft) }, (_, d) =>
              draft.items
                .filter((i) => i.day_index === d)
                .sort((a, b) => a.position - b.position)
                .map((i) => i.place.id),
            ),
          }
        : { ...preferences, city_id: city.id, must_visit: required };
    if (input.days > 14) {
      setError(
        "Automatic planning supports up to 14 days. Keep longer journeys in the manual editor.",
      );
      return;
    }
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const id = ++sequence.current;
    setGenerating(true);
    setError("");
    try {
      const plan = await request<Plan>("/itineraries/generate", {
        method: "POST",
        body: input,
        signal: abort.signal,
      });
      if (id !== sequence.current) return;
      let next = fromPlan(plan, draft);
      if (recalculate && draft) {
        const schedule = next.metadata.planning!;
        const fit = new Set(
          (schedule.visits || []).map((v) => `${v.day_index}:${v.place_id}`),
        );
        next = {
          ...next,
          items: draft.items,
          metadata: {
            ...next.metadata,
            planning: {
              ...schedule,
              stale: draft.items.some(
                (i) => !fit.has(`${i.day_index}:${i.place.id}`),
              ),
            },
          },
        };
      }
      onChange(next);
      setDay(0);
      setTab("itinerary");
      setWarnings(plan.warnings);
      setSelected(null);
    } catch (e) {
      if (id === sequence.current && !abort.signal.aborted)
        setError((e as Error).message);
    } finally {
      if (id === sequence.current) setGenerating(false);
    }
  }
  function changeItems(items: Item[]) {
    if (!draft || inputsLocked) return;
    onChange(markChanged(draft, items));
  }
  function remove(item: Item) {
    changeItems(
      draft!.items
        .filter((i) => i.id !== item.id)
        .map((i) =>
          i.day_index === item.day_index && i.position > item.position
            ? { ...i, position: i.position - 1 }
            : i,
        ),
    );
  }
  function move(item: Item, target: number, offset?: number) {
    if (!draft) return;
    const others = draft.items.filter((i) => i.id !== item.id);
    const group = others
      .filter((i) => i.day_index === target)
      .sort((a, b) => a.position - b.position);
    group.splice(
      Math.max(0, Math.min(group.length, offset ?? group.length)),
      0,
      { ...item, day_index: target },
    );
    changeItems([
      ...others
        .filter((i) => i.day_index !== target)
        .map((i) =>
          i.day_index === item.day_index && i.position > item.position
            ? { ...i, position: i.position - 1 }
            : i,
        ),
      ...group.map((i, position) => ({ ...i, position })),
    ]);
  }
  function add(p: Place) {
    if (!draft) {
      setRequired((r) =>
        r.includes(p.id) ? r.filter((id) => id !== p.id) : [...r, p.id],
      );
      return;
    }
    if (draft.items.some((i) => i.place.id === p.id && i.day_index === day)) {
      setError(
        "This place is already on this day. Select another day to add a repeat visit.",
      );
      return;
    }
    if (draft.items.length >= 100) {
      setError("Generated journeys support up to 100 stops.");
      return;
    }
    changeItems([
      ...draft.items,
      {
        id: crypto.randomUUID(),
        day_index: day,
        position: current.length,
        place: p,
        notes: "",
      },
    ]);
    setTab("itinerary");
  }
  async function roadRoute() {
    if (!city || routing) return;
    setRouting(true);
    setRouteMessage("");
    try {
      const r = await request<{
        available: boolean;
        geometry?: { coordinates: number[][] };
        attribution?: string;
        message: string;
      }>("/itineraries/route", {
        method: "POST",
        body: {
          city_id: city.id,
          place_ids: current.map((i) => i.place.id),
          mode: planning?.mode || preferences.mode,
        },
      });
      if (r.available && r.geometry)
        setRoad({
          coordinates: r.geometry.coordinates,
          attribution: r.attribution || "",
        });
      setRouteMessage(r.message);
    } catch (e) {
      setRouteMessage((e as Error).message);
    } finally {
      setRouting(false);
    }
  }
  if (!city)
    return (
      <section className="planner-loading" role="status">
        <Compass size={34} />
        <h2>Opening your destination…</h2>
        {error && <p role="alert">{error}</p>}
        <button className="travel-button secondary" onClick={onBack}>
          Return to discovery
        </button>
      </section>
    );
  const routeCoordinates =
    road?.coordinates ||
    (!planning?.stale && current.length
      ? [
          [city.longitude, city.latitude],
          ...current.map((i) => [i.place.longitude, i.place.latitude]),
          [city.longitude, city.latitude],
        ]
      : undefined);
  return (
    <div className="planner-page">
      <button className="planner-back" onClick={onBack}>
        <ArrowLeft size={14} /> All destinations
      </button>
      <div className="planner-hero">
        <div>
          <span className="travel-eyebrow">
            <MapPin size={14} /> {city.country} · YOUR NEXT CHAPTER
          </span>
          <h1>Explore {city.name}</h1>
          <p>
            Discover what’s nearby. Turn the places you love into days you’ll
            remember.
          </p>
          <div className="planner-hero-chips">
            <span>
              <Compass size={14} />
              {data
                ? data.places.length + " real nearby places"
                : "Finding nearby places"}
            </span>
            <span>
              <Route size={14} /> A route, not just a list
            </span>
            <span>
              <Bookmark size={14} /> Free. No account needed.
            </span>
          </div>
        </div>
        <div className="planner-hero-mark">
          <GlobeMark />
          <span>{city.name.toUpperCase()}</span>
        </div>
      </div>
      {error && (
        <div className="travel-alert" role="alert">
          <span>{error}</span>
          <button
            aria-label="Dismiss planner error"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <fieldset className="planner-preferences" disabled={inputsLocked}>
        <div className="preference-heading">
          <SlidersHorizontal size={19} />
          <strong>Make it your kind of trip</strong>
          <span>Preferences apply when you generate a route.</span>
        </div>
        <div className="planner-fields">
          <label>
            First day
            <input
              type="date"
              aria-label="Planner start date"
              required
              value={preferences.start_date}
              onChange={(e) =>
                setPreferences((p) => ({ ...p, start_date: e.target.value }))
              }
            />
          </label>
          <label>
            Days to explore
            <select
              aria-label="Number of days"
              value={preferences.days}
              onChange={(e) =>
                setPreferences((p) => ({ ...p, days: Number(e.target.value) }))
              }
            >
              {Array.from({ length: 14 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} {i ? "days" : "day"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Your pace
            <select
              aria-label="Trip pace"
              value={preferences.pace}
              onChange={(e) =>
                setPreferences((p) => ({
                  ...p,
                  pace: e.target.value as Preferences["pace"],
                }))
              }
            >
              <option value="relaxed">Slow & easy · ~3 stops</option>
              <option value="balanced">A little of everything · ~5</option>
              <option value="packed">Make the most of it · ~7</option>
            </select>
          </label>
          <label>
            Getting around
            <select
              aria-label="Travel mode"
              value={preferences.mode}
              onChange={(e) =>
                setPreferences((p) => ({
                  ...p,
                  mode: e.target.value as Preferences["mode"],
                }))
              }
            >
              <option value="drive">Car / taxi · estimated</option>
              <option value="walk">On foot · estimated</option>
            </select>
          </label>
          <label>
            Start at
            <input
              type="time"
              aria-label="Daily start time"
              min="06:00"
              max="22:00"
              value={preferences.day_start}
              onChange={(e) =>
                setPreferences((p) => ({ ...p, day_start: e.target.value }))
              }
            />
          </label>
          <label>
            Back by
            <input
              type="time"
              aria-label="Daily end time"
              min="06:00"
              max="23:00"
              value={preferences.day_end}
              onChange={(e) =>
                setPreferences((p) => ({ ...p, day_end: e.target.value }))
              }
            />
          </label>
        </div>
        <div className="planner-interest-row">
          <div className="interest-chips">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={preferences.interests?.includes(c)}
                className={preferences.interests?.includes(c) ? "active" : ""}
                onClick={() =>
                  setPreferences((p) => ({
                    ...p,
                    interests: p.interests?.includes(c)
                      ? p.interests.filter((i) => i !== c)
                      : [...(p.interests || []), c],
                  }))
                }
              >
                {categoryName[c]}
                {preferences.interests?.includes(c) && <Check size={12} />}
              </button>
            ))}
          </div>
          <button
            className="travel-button primary generate-button"
            onClick={() => void generate()}
            disabled={loading || !data?.places.length}
          >
            <Sparkles size={17} />
            {generating ? "Planning your days…" : "Generate itinerary"}
          </button>
        </div>
      </fieldset>
      <div className="planner-workspace-heading">
        <nav aria-label="Planner sections" className="planner-tabs">
          <button
            className={tab === "places" ? "active" : ""}
            onClick={() => setTab("places")}
          >
            <Compass size={16} /> Nearby places
          </button>
          <button
            className={tab === "itinerary" ? "active" : ""}
            disabled={!draft}
            onClick={() => setTab("itinerary")}
          >
            <CalendarDays size={16} /> Your itinerary{" "}
            {draft && <span>{draft.items.length}</span>}
          </button>
          <button
            className={tab === "tools" ? "active" : ""}
            disabled={!draft}
            onClick={() => setTab("tools")}
          >
            <Wallet size={16} /> Budget & packing
          </button>
        </nav>
        {draft && (
          <div className="planner-save-actions">
            <button
              className="travel-button secondary"
              onClick={onKeep}
              disabled={inputsLocked}
            >
              Keep draft on this device
            </button>
            <button
              className="travel-button secondary"
              onClick={onCloud}
              disabled={inputsLocked}
            >
              Save to cloud
            </button>
          </div>
        )}
      </div>
      {draft && (
        <div className="planner-trip-title">
          <label>
            Trip title
            <input
              aria-label="Trip title"
              maxLength={120}
              value={draft.metadata.title}
              disabled={inputsLocked}
              onChange={(e) =>
                onChange({
                  ...draft,
                  metadata: { ...draft.metadata, title: e.target.value },
                })
              }
            />
          </label>
          <div className="planner-portable-actions">
            <button onClick={onExport}>
              <Download size={15} /> Export draft
            </button>
            <button
              disabled={planning?.stale || inputsLocked}
              onClick={() => {
                try {
                  textDownload(
                    calendar(draft),
                    "payanam-itinerary.ics",
                    "text/calendar",
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <CalendarDays size={15} /> Export calendar
            </button>
            <button onClick={() => window.print()}>
              <Printer size={15} /> Print trip guide
            </button>
          </div>
        </div>
      )}
      {tab === "tools" && draft && (
        <fieldset disabled={inputsLocked} className="planner-tools-lock">
          <TripTools draft={draft} onChange={onChange} />
        </fieldset>
      )}
      {tab !== "tools" && (
        <>
          <div className="planner-mobile-view">
            <button
              aria-pressed={!mobileMap}
              onClick={() => setMobileMap(false)}
            >
              List
            </button>
            <button aria-pressed={mobileMap} onClick={() => setMobileMap(true)}>
              Map
            </button>
          </div>
          <div className={"planner-grid " + (mobileMap ? "show-map" : "")}>
            <div className="planner-board">
              {tab === "places" ? (
                <>
                  <div className="hotspot-toolbar">
                    <div>
                      <h2>Places worth making time for.</h2>
                      <p>
                        {data?.stale
                          ? "Dated source snapshot"
                          : data?.source === "wikipedia"
                            ? "Sourced from Wikipedia"
                            : "Sourced from OpenStreetMap"}
                        {data
                          ? " · " +
                            new Date(data.retrieved_at).toLocaleDateString(
                              "en-IN",
                            )
                          : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => void refresh()}
                      disabled={loading}
                      className="travel-button small secondary"
                    >
                      {loading ? "Finding places…" : "Refresh places"}
                    </button>
                  </div>
                  <div className="hotspot-search">
                    <Search size={16} />
                    <input
                      aria-label="Filter nearby places"
                      placeholder="Find a place in this city…"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                    <select
                      aria-label="Filter hotspot category"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="">All discoveries</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {categoryName[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {loading && !data && (
                    <div className="planner-loading" role="status">
                      <span className="search-spinner" />
                      <p>Finding real places near {city.name}…</p>
                    </div>
                  )}
                  {data && !visiblePlaces.length && (
                    <div className="planner-loading">
                      <Compass />
                      <h3>No matching places in this source.</h3>
                      <p>
                        Try another category or refresh. Coverage varies by
                        destination.
                      </p>
                    </div>
                  )}
                  <div className="hotspot-list">
                    {visiblePlaces.map((p) => (
                      <article
                        data-testid="hotspot-card"
                        key={p.id}
                        className={
                          "hotspot-card " +
                          (selected === p.id ? "selected" : "")
                        }
                      >
                        <button
                          className={"hotspot-symbol category-" + p.category}
                          aria-label={"Show " + p.name + " on map"}
                          onClick={() => setSelected(p.id)}
                        >
                          <MapPin size={23} />
                        </button>
                        <div className="hotspot-copy">
                          <span className="travel-eyebrow">
                            {categoryName[p.category || "attraction"]} ·{" "}
                            {((p.distance_m || 0) / 1000).toFixed(1)} KM AWAY
                          </span>
                          <h3>
                            <button onClick={() => setSelected(p.id)}>
                              {p.name}
                            </button>
                          </h3>
                          <p>
                            {p.opening_hours
                              ? "Mapped hours: " + p.opening_hours
                              : "Opening hours not recorded · check before visiting"}
                          </p>
                          <div className="hotspot-facts">
                            <span>
                              <Clock size={12} /> Suggested visit{" "}
                              {p.recommended_duration_minutes || 60} min
                            </span>
                            {p.fee && (
                              <span>
                                {p.fee === "no"
                                  ? "Mapped fee: no"
                                  : "Mapped fee: " + p.fee}
                              </span>
                            )}
                            {p.wheelchair && (
                              <span>Wheelchair: {p.wheelchair}</span>
                            )}
                          </div>
                          <div className="hotspot-links">
                            <a
                              href={safeLink(p.source_url)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {p.provider === "wikipedia"
                                ? "Wikipedia"
                                : "OpenStreetMap"}{" "}
                              <ExternalLink size={11} />
                            </a>
                            {safeLink(p.wikipedia) && (
                              <a
                                href={safeLink(p.wikipedia)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Read the story
                              </a>
                            )}
                            {safeLink(p.website) && (
                              <a
                                href={safeLink(p.website)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Official website
                              </a>
                            )}
                          </div>
                        </div>
                        <button
                          className={
                            "hotspot-add " +
                            (required.includes(p.id) ? "chosen" : "")
                          }
                          disabled={inputsLocked}
                          aria-pressed={
                            !draft ? required.includes(p.id) : undefined
                          }
                          onClick={() => add(p)}
                          aria-label={
                            (draft ? "Add to day: " : "Must visit: ") + p.name
                          }
                        >
                          {draft ? <Plus size={18} /> : <Star size={18} />}
                          <small>
                            {draft
                              ? "Add to day"
                              : required.includes(p.id)
                                ? "Must visit"
                                : "Want to go"}
                          </small>
                        </button>
                      </article>
                    ))}
                  </div>
                  {data && (
                    <p className="planner-source-note">{data.message}</p>
                  )}
                </>
              ) : (
                draft && (
                  <>
                    <div className="itinerary-heading">
                      <div>
                        <span className="travel-eyebrow">
                          YOUR DAYS, BEAUTIFULLY SPENT
                        </span>
                        <h2>{city.name}, one day at a time.</h2>
                      </div>
                      <button
                        className="travel-button small secondary"
                        disabled={inputsLocked}
                        onClick={() => void generate(true)}
                      >
                        <Route size={14} /> Recalculate times
                      </button>
                    </div>
                    <div
                      className="planner-day-tabs"
                      role="tablist"
                      aria-label="Itinerary days"
                    >
                      {Array.from({ length: days }, (_, i) => (
                        <button
                          role="tab"
                          aria-selected={day === i}
                          className={day === i ? "active" : ""}
                          key={i}
                          onClick={() => {
                            setDay(i);
                            setSelected(null);
                          }}
                        >
                          <small>DAY {i + 1}</small>
                          <strong>
                            {new Date(
                              dayDate(draft.metadata.start_date, i) +
                                "T12:00:00Z",
                            ).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              timeZone: "UTC",
                            })}
                          </strong>
                        </button>
                      ))}
                    </div>
                    {planning?.stale && (
                      <div className="planner-stale" role="status">
                        Your stops changed. Recalculate times before exporting a
                        calendar.
                      </div>
                    )}
                    {weather && (
                      <div className="planner-weather">
                        <CloudSun size={22} />
                        <div>
                          <strong>
                            {weather.low}–{weather.high}°C
                          </strong>
                          <span>
                            {weather.rain_probability}% rain probability ·
                            Open-Meteo forecast for {weather.date}
                          </span>
                        </div>
                        <a
                          href="https://open-meteo.com/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Source
                        </a>
                      </div>
                    )}
                    {!weather && (
                      <p className="planner-weather-missing">
                        Forecast unavailable for this date. Forecasts cover the
                        provider’s next 14 days.
                      </p>
                    )}
                    <div className="day-summary">
                      <span>
                        <MapPin size={14} />
                        {current.length} stops
                      </span>
                      <span>
                        <Route size={14} />
                        {(
                          timed.reduce((s, v) => s + v.distance_m, 0) / 1000
                        ).toFixed(1)}{" "}
                        km between stops · estimated
                      </span>
                      <span>
                        <Clock size={14} /> Start near {city.name} centre
                      </span>
                    </div>
                    <div className="planner-timeline">
                      <div className="timeline-origin">
                        <span />
                        <div>
                          <strong>
                            {planning?.day_start} · Start your day
                          </strong>
                          <p>
                            {city.name} city centre · choose your own stay /
                            starting point in your mapping app
                          </p>
                        </div>
                      </div>
                      {current.map((item, index) => {
                        const v = !planning?.stale
                          ? visits.find(
                              (v) =>
                                v.place_id === item.place.id &&
                                v.day_index === day &&
                                v.position === item.position,
                            )
                          : undefined;
                        const previous = index ? current[index - 1] : null;
                        const prevTime = previous
                          ? visits.find(
                              (v) =>
                                v.place_id === previous.place.id &&
                                v.day_index === day,
                            )
                          : null;
                        const showLunch =
                          v &&
                          v.arrival >= "14:00" &&
                          (!prevTime || prevTime.departure <= "13:00") &&
                          (planning?.day_start || "09:00") <= "13:00";
                        return (
                          <div key={item.id}>
                            {showLunch && (
                              <div className="lunch-block">
                                <span>13:00 – 14:00</span>
                                <strong>Lunch & a little breathing room</strong>
                                <p>
                                  Choose somewhere nearby; this is a reserved
                                  break.
                                </p>
                              </div>
                            )}
                            <div className="travel-connector">
                              <Route size={13} />
                              {v
                                ? `${v.travel_minutes} min · ${(v.distance_m / 1000).toFixed(1)} km · Estimated travel`
                                : "Estimated travel · recalculate for updated timing"}
                            </div>
                            <article
                              data-testid="scheduled-stop"
                              className={
                                "scheduled-stop " +
                                (selected === item.place.id ? "selected" : "")
                              }
                            >
                              <div className="schedule-time">
                                <strong>{v ? v.arrival : "—"}</strong>
                                <small>{v ? v.departure : "UNSCHEDULED"}</small>
                              </div>
                              <div className="scheduled-stop-main">
                                <div className="stop-top">
                                  <div>
                                    <span className="travel-eyebrow">
                                      {
                                        categoryName[
                                          item.place.category || "attraction"
                                        ]
                                      }
                                    </span>
                                    <h3>
                                      <button
                                        onClick={() =>
                                          setSelected(item.place.id)
                                        }
                                      >
                                        {item.place.name}
                                      </button>
                                    </h3>
                                  </div>
                                  <button
                                    aria-label={"Remove " + item.place.name}
                                    className="travel-icon-button"
                                    disabled={inputsLocked}
                                    onClick={() => remove(item)}
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                <div className="stop-details">
                                  <span>
                                    <Clock size={12} />{" "}
                                    {v?.duration_minutes ||
                                      item.place.recommended_duration_minutes ||
                                      60}{" "}
                                    min visit
                                  </span>
                                  <span>
                                    {v?.hours_status === "mapped"
                                      ? "Fits mapped hours"
                                      : "Hours need confirmation"}
                                  </span>
                                </div>
                                {item.place.opening_hours && (
                                  <p className="mapped-hours">
                                    {item.place.opening_hours}
                                  </p>
                                )}
                                <textarea
                                  aria-label={"Notes for " + item.place.name}
                                  placeholder="A reminder, a reservation, a little story…"
                                  maxLength={4000}
                                  value={item.notes}
                                  disabled={inputsLocked}
                                  onChange={(e) =>
                                    onChange({
                                      ...draft,
                                      items: draft.items.map((i) =>
                                        i.id === item.id
                                          ? { ...i, notes: e.target.value }
                                          : i,
                                      ),
                                    })
                                  }
                                />
                                <div className="stop-controls">
                                  <label>
                                    Day{" "}
                                    <select
                                      aria-label={"Day for " + item.place.name}
                                      disabled={inputsLocked}
                                      value={day}
                                      onChange={(e) =>
                                        move(item, Number(e.target.value))
                                      }
                                    >
                                      {Array.from({ length: days }, (_, i) => (
                                        <option value={i} key={i}>
                                          Day {i + 1}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button
                                    aria-label={
                                      "Move " + item.place.name + " earlier"
                                    }
                                    disabled={inputsLocked || index === 0}
                                    onClick={() => move(item, day, index - 1)}
                                  >
                                    <ChevronUp size={14} />
                                  </button>
                                  <button
                                    aria-label={
                                      "Move " + item.place.name + " later"
                                    }
                                    disabled={
                                      inputsLocked ||
                                      index === current.length - 1
                                    }
                                    onClick={() => move(item, day, index + 1)}
                                  >
                                    <ChevronDown size={14} />
                                  </button>
                                  <a
                                    href={
                                      "https://www.google.com/maps/search/?" +
                                      new URLSearchParams({
                                        api: "1",
                                        query:
                                          item.place.latitude +
                                          "," +
                                          item.place.longitude,
                                      })
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Directions <ExternalLink size={11} />
                                  </a>
                                </div>
                              </div>
                            </article>
                          </div>
                        );
                      })}
                      {!current.length && (
                        <div className="planner-loading">
                          <Compass size={30} />
                          <h3>Leave room for something wonderful.</h3>
                          <p>
                            Add a nearby place or generate a route for this day.
                          </p>
                          <button
                            className="travel-button secondary"
                            onClick={() => setTab("places")}
                          >
                            <Plus size={14} /> Browse nearby places
                          </button>
                        </div>
                      )}
                      {current.length > 0 && (
                        <div className="timeline-origin return">
                          <span />
                          <div>
                            <strong>Return to {city.name} centre</strong>
                            <p>
                              Allow time to return to your stay. Check the
                              complete route in your mapping app.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="route-actions">
                      <a
                        className="travel-button secondary"
                        href={directions(
                          city,
                          current.map((i) => i.place),
                          planning?.mode || "drive",
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Check directions <ExternalLink size={14} />
                      </a>
                      <button
                        className="travel-button secondary"
                        onClick={() => setTab("places")}
                      >
                        <Plus size={14} /> Add nearby places
                      </button>
                    </div>
                  </>
                )
              )}
            </div>
            <aside className="planner-map-panel">
              <Suspense
                fallback={<div className="map-loading">Opening your map…</div>}
              >
                <TravelMap
                  places={positions}
                  selected={selected}
                  onSelect={setSelected}
                  routeCoordinates={
                    tab === "itinerary" ? routeCoordinates : undefined
                  }
                  roadRoute={!!road}
                />
              </Suspense>
              <div className="planner-map-note">
                <Route size={17} />
                <div>
                  <strong>
                    {road
                      ? "Road route from openrouteservice"
                      : tab === "itinerary"
                        ? "See how your day connects"
                        : "A little closer to somewhere new"}
                  </strong>
                  <p>
                    {road
                      ? road.attribution
                      : tab === "itinerary"
                        ? "Dashed links are estimates between stops, not street directions."
                        : "Each marker is a real, attributed place. Select one to find it in the list."}
                  </p>
                </div>
              </div>
              {draft && tab === "itinerary" && roadEnabled && (
                <>
                  <button
                    className="optional-routing"
                    disabled={routing || inputsLocked || !current.length}
                    onClick={() => void roadRoute()}
                  >
                    {routing ? "Checking route…" : "Load road route"}{" "}
                    <ArrowRight size={14} />
                  </button>
                  {routeMessage && (
                    <p className="route-message" role="status">
                      {routeMessage}
                    </p>
                  )}
                </>
              )}
            </aside>
          </div>
        </>
      )}
      {draft && (
        <details className="planner-assumptions">
          <summary>Know what’s planned, and what to check.</summary>
          <ul>
            {(warnings.length
              ? warnings
              : [
                  "Travel is estimated from coordinates. Check road directions before leaving.",
                  "Opening hours, fees and accessibility are community records, not guaranteed availability.",
                ]
            ).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p>
            Sources: GeoNames · CC BY 4.0; © OpenStreetMap contributors · ODbL
            1.0; Wikipedia contributors · CC BY-SA 4.0; Open-Meteo forecasts ·
            CC BY 4.0. No paid APIs, invented ratings, live fares or automated
            bookings.
          </p>
        </details>
      )}
      <div className="planner-print-only">
        <h2>{draft?.metadata.title}</h2>
        <p>
          {city.name} · {draft?.metadata.start_date} —{" "}
          {draft?.metadata.end_date} · {draft?.metadata.timezone}
        </p>
        {draft &&
          Array.from({ length: dayCount(draft) }, (_, i) => (
            <section key={i}>
              <h3>
                Day {i + 1} · {dayDate(draft.metadata.start_date, i)}
              </h3>
              {draft.items
                .filter((item) => item.day_index === i)
                .sort((a, b) => a.position - b.position)
                .map((item) => {
                  const visit = planning?.stale
                    ? null
                    : visits.find(
                        (v) =>
                          v.place_id === item.place.id &&
                          v.day_index === i &&
                          v.position === item.position,
                      );
                  return (
                    <p key={item.id}>
                      <strong>
                        {visit
                          ? visit.arrival + "–" + visit.departure
                          : "Unscheduled"}{" "}
                        · {item.place.name}
                      </strong>
                      <br />
                      {item.notes}
                      <br />
                      {item.place.opening_hours ||
                        "Confirm opening hours"} · {item.place.attribution}
                    </p>
                  );
                })}
            </section>
          ))}
        <p>
          Travel estimates and mapped hours need confirmation. © OpenStreetMap
          contributors · GeoNames. Personal itinerary, no bookings.
        </p>
      </div>
    </div>
  );
}
function GlobeMark() {
  return (
    <svg viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <path
        d="M20 95C40 15 115 10 140 65"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 6"
      />
      <circle cx="84" cy="55" r="35" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="84" cy="55" rx="16" ry="35" stroke="currentColor" />
      <path d="M49 55H119M54 38H114M54 72H114" stroke="currentColor" />
      <circle cx="20" cy="95" r="5" fill="currentColor" />
      <circle cx="140" cy="65" r="5" fill="currentColor" />
    </svg>
  );
}
