import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  Globe2,
  Languages,
  MapPin,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  APIError,
  changeTrip,
  createTrip,
  deleteTrip,
  download,
  findPlaces,
  getCapabilities,
  getTrip,
  getTrips,
  request,
  type Capabilities,
  type Item,
  type Place,
  type Trip,
} from "./client";
import { configureAuth } from "./auth";
import {
  cloudDraft,
  loadDrafts,
  newDraft,
  persistDraft,
  removeDraft,
  type Draft,
} from "./drafts";
import Translator from "./Translator";
import "./travel.css";
import en from "../locales/en.json";
import ta from "../locales/ta.json";
import { prepareChanges, type SaveStep } from "./savePlan";
import { preserveOAuthDraft, restoreOAuthDraft } from "./oauthDraft";
import { AccountScope } from "./accountScope";
import { useModal } from "../components/useModal";
const TravelMap = lazy(() => import("./TravelMap"));
type View = "discover" | "editor" | "trips" | "translator" | "about";
type SaveJournal = {
  target: Draft;
  trip: Trip | null;
  changes: SaveStep[];
  ids: Record<string, string>;
  owner: string;
  index: number;
  batch: string;
  created: boolean;
};
const countries = [
  ["", "Everywhere"],
  ["IN", "India"],
  ["FR", "France"],
  ["JP", "Japan"],
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["AE", "United Arab Emirates"],
  ["TH", "Thailand"],
  ["SG", "Singapore"],
  ["LK", "Sri Lanka"],
  ["AU", "Australia"],
];
const currencies = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AED",
  "SGD",
  "LKR",
  "AUD",
];
const zones = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Bangkok",
  "Europe/Paris",
  "Europe/London",
  "America/New_York",
  "Australia/Sydney",
  "UTC",
];

function dates(d: Draft) {
  const start = new Date(d.metadata.start_date + "T12:00:00Z").getTime();
  const end = new Date(d.metadata.end_date + "T12:00:00Z").getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  return Array.from(
    {
      length: Math.max(
        0,
        Math.min(30, Math.floor((end - start) / 86400000) + 1),
      ),
    },
    (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10),
  );
}
function labelDate(date: string) {
  return new Intl.DateTimeFormat(
    document.documentElement.lang === "ta" ? "ta-IN" : "en-IN",
    { month: "short", day: "numeric", timeZone: "UTC" },
  ).format(new Date(date + "T12:00:00Z"));
}
function metadataValid(d: Draft) {
  const dayCount = dates(d).length;
  return (
    d.metadata.title.trim().length > 0 &&
    d.metadata.title.length <= 120 &&
    dayCount > 0 &&
    (new Date(d.metadata.end_date).getTime() -
      new Date(d.metadata.start_date).getTime()) /
      86400000 <
      30 &&
    d.items.every((i) => i.day_index < dayCount)
  );
}

export default function TravelApp() {
  const [view, setView] = useState<View>("discover"),
    [cap, setCap] = useState<Capabilities | null>(null),
    [query, setQuery] = useState(""),
    [country, setCountry] = useState(""),
    [source, setSource] = useState("cities"),
    [places, setPlaces] = useState<Place[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [searched, setSearched] = useState(false),
    [searching, setSearching] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [draft, setDraft] = useState<Draft | null>(null),
    [day, setDay] = useState(0),
    [local, setLocal] = useState<Draft[]>(loadDrafts),
    [cloud, setCloud] = useState<Trip[]>([]),
    [session, setSession] = useState<Session | null>(null),
    [auth, setAuth] = useState<SupabaseClient | null>(null),
    [authOpen, setAuthOpen] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [locale, setLocale] = useState<"en" | "ta">("en"),
    [mapVisible, setMapVisible] = useState(false);
  const searchController = useRef<AbortController | null>(null),
    searchSequence = useRef(0),
    journal = useRef<SaveJournal | null>(null);
  const accountScope = useRef(new AccountScope());
  const [cloudCursor, setCloudCursor] = useState<string | null>(null);
  const restoredOAuth = useRef(false);
  useEffect(() => {
    if (restoredOAuth.current) return;
    restoredOAuth.current = true;
    const restored = restoreOAuthDraft();
    if (restored) {
      setDraft(restored);
      setView("editor");
      setNotice(
        "Your draft was restored after sign-in. Choose Save to cloud to upload it.",
      );
    }
  }, []);
  const tamil = locale === "ta";
  const modalRef = useModal(authOpen, busy, () => setAuthOpen(false));
  const words = tamil ? ta : en;

  useEffect(() => {
    let active = true;
    getCapabilities()
      .then((value) => {
        if (!active) return;
        setCap(value);
        setAuth(
          configureAuth(value.supabase_url, value.supabase_publishable_key),
        );
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!auth) return;
    let active = true;
    const initial = accountScope.current.capture();
    const updateSession = (value: Session | null) => {
      const changed = accountScope.current.setIdentity(value?.user.id || null);
      if (changed) {
        setCloud([]);
        setCloudCursor(null);
        setDraft((d) => (d?.cloud_id ? null : d));
        journal.current = null;
      }
      setSession(value);
    };
    void auth.auth.getSession().then(({ data }) => {
      if (active && accountScope.current.current(initial))
        updateSession(data.session);
    });
    const {
      data: { subscription },
    } = auth.auth.onAuthStateChange((event, value) => {
      updateSession(value);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [auth]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    searchController.current?.abort();
    return () => searchController.current?.abort();
  }, []);
  const token = session?.access_token;
  const tokenRef = useRef(token);
  tokenRef.current = token;
  async function refreshCloud(more = false) {
    if (!token) return;
    const scope = accountScope.current.capture();
    try {
      const result = await getTrips(token, more ? cloudCursor : null);
      if (accountScope.current.current(scope)) {
        setCloud((previous) =>
          more
            ? [
                ...previous,
                ...result.trips.filter(
                  (t) => !previous.some((p) => p.id === t.id),
                ),
              ]
            : result.trips,
        );
        setCloudCursor(result.next_cursor);
      }
    } catch (e) {
      if (accountScope.current.current(scope)) setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (token) void refreshCloud();
    else setCloud([]);
  }, [token]);
  const go = useCallback((next: View) => {
    setView(next);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  async function search() {
    if (query.trim().length < 2) {
      setError("Enter at least two characters.");
      return;
    }
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const sequence = ++searchSequence.current;
    setSearching(true);
    setError("");
    setSearched(false);
    try {
      const result = await findPlaces(
        query.trim(),
        source,
        country,
        controller.signal,
      );
      if (sequence === searchSequence.current) {
        setPlaces(result.places);
        setSelected(result.places[0]?.id || null);
        setSearched(true);
      }
    } catch (e) {
      if (sequence === searchSequence.current && !controller.signal.aborted)
        setError((e as Error).message);
    } finally {
      if (sequence === searchSequence.current) setSearching(false);
    }
  }
  function addPlace(place: Place) {
    if (journal.current) {
      setError(
        "Finish or retry the pending cloud save before changing this trip.",
      );
      return;
    }
    const next = draft || newDraft();
    if (next.items.length >= 200) {
      setError("A trip supports up to 200 places.");
      return;
    }
    const target = day < dates(next).length ? day : 0;
    const item: Item = {
      id: crypto.randomUUID(),
      day_index: target,
      position: next.items.filter((i) => i.day_index === target).length,
      place,
      notes: "",
    };
    setDraft({ ...next, items: [...next.items, item] });
    setDay(target);
    go("editor");
  }
  function keepDraft() {
    if (!draft) return;
    if (!metadataValid(draft)) {
      setError(
        "Check the title and date range. Move visits before shortening a trip; trips support up to 30 days.",
      );
      return;
    }
    try {
      persistDraft(draft);
      setLocal(loadDrafts());
      setNotice(
        "Draft kept on this device. Use a trusted device and export a backup.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function editMetadata(key: string, value: string) {
    if (!draft || journal.current) return;
    setDraft({ ...draft, metadata: { ...draft.metadata, [key]: value } });
  }
  function modifyItems(items: Item[]) {
    if (draft && !journal.current) setDraft({ ...draft, items });
  }
  function move(item: Item, destination: number, position?: number) {
    if (!draft) return;
    const others = draft.items.filter((i) => i.id !== item.id);
    const target = others.filter((i) => i.day_index === destination);
    target.splice(Math.min(position ?? target.length, target.length), 0, {
      ...item,
      day_index: destination,
    });
    modifyItems([
      ...others.filter((i) => i.day_index !== destination),
      ...target.map((i, index) => ({ ...i, position: index })),
    ]);
  }
  async function saveCloud() {
    if (!draft) return;
    if (!token || !auth) {
      setAuthOpen(true);
      return;
    }
    if (!metadataValid(draft)) {
      setError("Check the title, date range and visit days before saving.");
      return;
    }
    const scope = accountScope.current.capture();
    if (draft.cloud_owner && draft.cloud_owner !== scope.identity) {
      setError("Sign in to the account that owns this cloud trip.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!journal.current) {
        const existing = draft.cloud_id
          ? await getTrip(draft.cloud_id, token)
          : null;
        if (existing && existing.version !== draft.version)
          throw new APIError(
            "This trip changed elsewhere. Export your edits or load the cloud version before continuing.",
            "version_conflict",
            409,
          );
        const changes = prepareChanges(existing, draft);
        journal.current = {
          target: structuredClone(draft),
          trip: existing,
          changes,
          ids: {},
          owner: scope.identity!,
          index: 0,
          batch: crypto.randomUUID(),
          created: !!existing,
        };
      }
      const j = journal.current;
      if (!j.trip) {
        j.trip = await createTrip(
          j.target.metadata,
          token,
          "create:" + j.target.id,
        );
        const current = await getTrip(j.trip.id, token);
        if (current.version > 1) {
          const recovered = {
            ...draft,
            cloud_id: current.id,
            cloud_owner: scope.identity!,
            version: 0,
          };
          if (accountScope.current.current(scope)) {
            setDraft(recovered);
            journal.current = null;
            if (local.some((d) => d.id === draft.id)) {
              persistDraft(recovered);
              setLocal(loadDrafts());
            }
          }
          throw new APIError(
            "This trip changed elsewhere. A previous save was recovered. Export your edits or load the cloud version before continuing.",
            "version_conflict",
            409,
          );
        }
      }
      while (j.index < j.changes.length) {
        if (!accountScope.current.current(scope) || j.owner !== scope.identity)
          throw new APIError(
            "Your account changed during saving.",
            "session_changed",
            401,
          );
        const step = j.changes[j.index],
          before = new Set(j.trip.items?.map((i) => i.id));
        const change = { ...step.change };
        if (change.item_id)
          change.item_id = j.ids[change.item_id] || change.item_id;
        j.trip = await changeTrip(
          j.trip.id,
          change,
          j.trip.version,
          token,
          "save:" + j.batch + ":" + j.index,
        );
        if (step.localId) {
          const added = j.trip.items?.find((i) => !before.has(i.id));
          if (added) j.ids[step.localId] = added.id;
        }
        j.index++;
      }
      if (!accountScope.current.current(scope))
        throw new APIError(
          "Your account changed during saving. Sign in to the original account to check the trip.",
          "session_changed",
          401,
        );
      const saved = {
        ...cloudDraft(j.trip),
        id: j.target.id,
        cloud_owner: scope.identity!,
      };
      setDraft(saved);
      journal.current = null;
      if (local.some((d) => d.id === j.target.id)) {
        persistDraft(saved);
        setLocal(loadDrafts());
      }
      setNotice("Trip saved privately to your account.");
      await refreshCloud();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadCloudVersion() {
    if (!draft?.cloud_id || !token) return;
    const scope = accountScope.current.capture();
    setBusy(true);
    try {
      const trip = await getTrip(draft.cloud_id, token);
      if (!accountScope.current.current(scope)) return;
      setDraft({ ...cloudDraft(trip), cloud_owner: scope.identity! });
      journal.current = null;
      setError("");
      setNotice("Loaded the current cloud version.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function signIn() {
    if (!auth) {
      setError(
        "Sign-in is waiting for the Supabase project connection. You can keep a local draft now.",
      );
      return;
    }
    setBusy(true);
    try {
      const { error } = await auth.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword("");
      setAuthOpen(false);
      setNotice("Signed in. Choose Save to cloud to upload your draft.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importLegacy(file: File) {
    if (file.size > 65536) {
      setError("Choose a version 1 Payanam export smaller than 64 KB.");
      return;
    }
    if (!token) {
      setError(
        "Sign in before importing into your private account. The original file stays on your device.",
      );
      setAuthOpen(true);
      return;
    }
    if (
      !confirm(
        "Import this old illustrative journey into your account? It will remain labelled illustrative, with no verified hours, fares or routes. The original file is unchanged.",
      )
    )
      return;
    const scope = accountScope.current.capture();
    setBusy(true);
    try {
      const original = await file.text();
      const trip = await request<Trip>("/imports/legacy", {
        method: "POST",
        token,
        key: crypto.randomUUID(),
        body: { original },
      });
      if (!accountScope.current.current(scope)) return;
      setDraft({ ...cloudDraft(trip), cloud_owner: scope.identity! });
      setDay(0);
      go("editor");
      setNotice(
        "Imported as illustrative legacy data. Original times and fares are not verified.",
      );
      await refreshCloud();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportDraft() {
    if (!draft) return;
    const allowed = draft.items.filter((i) =>
      ["CC-BY-4.0", "ODbL-1.0"].includes(i.place.license),
    );
    download(
      {
        kind: "payanam-draft",
        version: 2,
        draft: { ...draft, items: allowed },
        attributions: [...new Set(allowed.map((i) => i.place.attribution))],
        export_note:
          allowed.length < draft.items.length
            ? "Legacy source records omitted: export rights unqualified. Original legacy export remains on your device."
            : null,
      },
      "payanam-draft.json",
    );
  }
  const currentPlaces =
    view === "editor"
      ? draft?.items.filter((i) => i.day_index === day).map((i) => i.place) ||
        []
      : places;
  const snapshot = cap?.city_snapshot_at
    ? new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(new Date(cap.city_snapshot_at))
    : "";

  return (
    <div className="travel-shell">
      <a className="skip-link" href="#travel-main">
        Skip to content
      </a>
      <header className="travel-header">
        <button
          className="travel-logo"
          onClick={() => go("discover")}
          aria-label="Payanam home"
        >
          <span className="travel-brand-mark">
            <Route size={22} />
          </span>
          <span>
            payanam<span className="logo-dot">.</span>
            <small>a little more journey</small>
          </span>
        </button>
        <nav aria-label="Main navigation" className="travel-navigation">
          {(
            [
              ["discover", Compass, words.discover],
              ["trips", Bookmark, words.trips],
              ["translator", Languages, words.translator],
            ] as const
          ).map(([id, Icon, title]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              aria-current={view === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon size={17} />
              <span>{title}</span>
            </button>
          ))}
        </nav>
        <div className="travel-header-actions">
          <button
            className="locale-button"
            onClick={() => setLocale(tamil ? "en" : "ta")}
          >
            {tamil ? "EN" : "தமிழ்"}
          </button>
          {session ? (
            <button
              className="travel-button secondary compact"
              disabled={busy}
              onClick={() => void auth?.auth.signOut()}
            >
              <UserRound size={16} />
              Sign out
            </button>
          ) : (
            <button
              className="travel-button secondary compact"
              onClick={() => {
                setError("");
                setAuthOpen(true);
              }}
            >
              <UserRound size={16} />
              {words.signIn}
            </button>
          )}
        </div>
      </header>
      <main id="travel-main" className="travel-main">
        {tamil && (
          <div className="locale-preview" role="status">
            தமிழ் முன்னோட்டம் · Tamil interface preview; some text remains in
            English pending native review.
          </div>
        )}
        {error && (
          <div className="travel-alert" role="alert">
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={18} />
            </button>
          </div>
        )}
        {notice && (
          <div className="travel-notice" role="status">
            <Check size={17} />
            {notice}
          </div>
        )}
        {view === "discover" && (
          <>
            <div className="discover-intro">
              <div>
                <span className="travel-eyebrow">
                  <Globe2 size={14} /> REAL PLACES. YOUR OWN PACE.
                </span>
                <h1>
                  Make room for
                  <br />
                  the journey.
                </h1>
                <p>
                  From a familiar street to somewhere entirely new.
                  <br className="desktop-break" /> Find your places. Bring your
                  people. Keep the moments.
                </p>
              </div>
              <div className="discovery-stat">
                <span className="stat-orbit">
                  <Globe2 size={35} />
                </span>
                <strong>
                  {cap
                    ? new Intl.NumberFormat("en-IN").format(cap.city_count)
                    : "Worldwide"}
                </strong>
                <span>real cities to discover</span>
                <small>India & beyond · free to explore</small>
              </div>
            </div>
            <form
              className="destination-search"
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
            >
              <div className="destination-input">
                <MapPin size={20} />
                <label>
                  <span>Where would you like to go?</span>
                  <input
                    aria-label="Search destinations"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="City, destination or local name"
                    maxLength={200}
                    minLength={2}
                    required
                  />
                </label>
              </div>
              <label className="search-country">
                <span>Country</span>
                <select
                  aria-label="Search country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  {countries.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="search-source">
                <span>Search for</span>
                <select
                  aria-label="Search source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="cities">Cities</option>
                  <option value="places" disabled={!cap?.place_search}>
                    Places {cap?.place_search ? "" : "· connect provider"}
                  </option>
                </select>
              </label>
              <button
                className="travel-button primary search-submit"
                disabled={searching}
              >
                <Search size={17} />
                {searching
                  ? "Searching…"
                  : source === "cities"
                    ? words.search
                    : "Search places"}
              </button>
            </form>
            <div className="search-prompts">
              <span>Start somewhere:</span>
              {["Madurai", "Chennai", "Jaipur", "Paris", "Tokyo"].map(
                (city) => (
                  <button
                    key={city}
                    onClick={() => {
                      setQuery(city);
                      setCountry("");
                    }}
                  >
                    {city}
                    <ArrowRight size={12} />
                  </button>
                ),
              )}
            </div>
            <div
              className={
                "discovery-workspace " + (mapVisible ? "mobile-map" : "")
              }
            >
              <section className="destination-results">
                <div className="results-heading">
                  <div>
                    <span className="travel-eyebrow">YOUR NEXT CHAPTER</span>
                    <h2>
                      {searched
                        ? `${places.length} destinations found`
                        : "A world of possibilities."}
                    </h2>
                  </div>
                  <button
                    className="mobile-map-toggle"
                    onClick={() => setMapVisible(!mapVisible)}
                  >
                    {mapVisible ? words.list : words.map}
                  </button>
                </div>
                {!searched && !searching && (
                  <div className="discovery-empty">
                    <span>
                      <Compass size={36} />
                    </span>
                    <h3>Somewhere worth slowing down.</h3>
                    <p>
                      Search a city in India or anywhere in the world. Original
                      names, real coordinates, no invented travel facts.
                    </p>
                    <div className="empty-badges">
                      <span>
                        <ShieldCheck size={15} />
                        Attributed data
                      </span>
                      <span>
                        <Bookmark size={15} />
                        Your own itinerary
                      </span>
                    </div>
                  </div>
                )}
                {searching && (
                  <div className="discovery-empty" role="status">
                    <span className="search-spinner" />
                    <p>Finding your destinations…</p>
                  </div>
                )}
                {searched && places.length === 0 && (
                  <div className="discovery-empty">
                    <Search size={30} />
                    <h3>No destinations found.</h3>
                    <p>
                      Try a different spelling or remove the country filter.
                      Detailed attraction search needs the connected provider.
                    </p>
                  </div>
                )}
                {searched &&
                  places.map((p, index) => (
                    <article
                      className={
                        "destination-card " +
                        (selected === p.id ? "selected" : "")
                      }
                      data-testid="place-card"
                      key={p.id}
                    >
                      <button
                        className="place-main"
                        onClick={() => setSelected(p.id)}
                        aria-label={"Show " + p.name + " on map"}
                      >
                        <span className="place-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <h3>{p.name}</h3>
                          <p>
                            {p.country}
                            {p.region ? " · " + p.region : ""}
                          </p>
                          <div className="place-chips">
                            <span>
                              {p.kind === "city" ? "City destination" : "Place"}
                            </span>
                            <span>
                              {p.timezone?.replaceAll("_", " ") ||
                                "Timezone unknown"}
                            </span>
                          </div>
                        </div>
                      </button>
                      <div className="destination-card-bottom">
                        <a
                          href={p.source_url || "https://www.geonames.org/"}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.attribution}
                        </a>
                        <button
                          className="travel-button small secondary"
                          onClick={() => addPlace(p)}
                        >
                          <Plus size={14} />
                          {words.add}
                        </button>
                      </div>
                    </article>
                  ))}
                <div className="source-caption">
                  <ShieldCheck size={15} />
                  <span>
                    GeoNames · CC BY 4.0
                    {snapshot ? " · snapshot " + snapshot : ""}. City geography
                    is not live venue availability.
                  </span>
                </div>
              </section>
              <div className="map-panel">
                <Suspense
                  fallback={
                    <div className="map-loading" role="status">
                      Opening the map…
                    </div>
                  }
                >
                  <TravelMap
                    places={currentPlaces}
                    selected={selected}
                    onSelect={setSelected}
                  />
                </Suspense>
              </div>
            </div>
            <div className="travel-value-row">
              <div>
                <span>01</span>
                <h3>Know what you know.</h3>
                <p>
                  Sources and timestamps stay with your places. Missing
                  information stays visible.
                </p>
              </div>
              <div>
                <span>02</span>
                <h3>Make the day yours.</h3>
                <p>
                  Arrange days around the people and moments that matter. Add
                  notes, move visits, leave room.
                </p>
              </div>
              <div>
                <span>03</span>
                <h3>Keep it close.</h3>
                <p>
                  Save a draft on a trusted device, export a backup, or connect
                  your account for private cloud trips.
                </p>
              </div>
            </div>
          </>
        )}
        {view === "editor" && draft && (
          <>
            <div className="trip-page-intro">
              <div>
                <span className="travel-eyebrow">
                  A JOURNEY TO MAKE YOUR OWN
                </span>
                <h1>Your journey, your way.</h1>
                <p>
                  {draft.cloud_id
                    ? "Private cloud trip · changes need saving"
                    : "Local draft · nothing is uploaded until you choose"}
                </p>
              </div>
              <div className="trip-actions">
                <button
                  className="travel-button secondary"
                  onClick={exportDraft}
                >
                  <Download size={16} />
                  Export draft
                </button>
                {draft.cloud_id && token && (
                  <button
                    className="travel-button secondary"
                    onClick={() =>
                      void request("/trips/" + draft.cloud_id + "/export", {
                        token,
                      })
                        .then((value) =>
                          download(value, "payanam-cloud-trip.json"),
                        )
                        .catch((e) => setError(e.message))
                    }
                  >
                    Export saved copy
                  </button>
                )}
                <button
                  className="travel-button secondary"
                  onClick={keepDraft}
                  disabled={busy}
                >
                  {words.save}
                </button>
                <button
                  className="travel-button primary"
                  onClick={() => void saveCloud()}
                  disabled={busy}
                >
                  {busy
                    ? "Saving…"
                    : journal.current
                      ? "Retry cloud save"
                      : words.cloud}
                </button>
              </div>
            </div>
            {draft.cloud_id && error && (
              <div className="conflict-actions">
                <span>
                  Your edits are still in this draft. Export them before loading
                  another version.
                </span>
                <button
                  className="travel-button secondary"
                  onClick={() => void loadCloudVersion()}
                >
                  Load cloud version
                </button>
              </div>
            )}
            <fieldset
              className="trip-metadata"
              disabled={busy || !!journal.current}
            >
              <label>
                {words.title}
                <input
                  aria-label="Trip title"
                  value={draft.metadata.title}
                  maxLength={120}
                  onChange={(e) => editMetadata("title", e.target.value)}
                />
              </label>
              <label>
                {words.start}
                <input
                  aria-label="Start date"
                  type="date"
                  value={draft.metadata.start_date}
                  onChange={(e) => editMetadata("start_date", e.target.value)}
                />
              </label>
              <label>
                {words.end}
                <input
                  aria-label="End date"
                  type="date"
                  value={draft.metadata.end_date}
                  onChange={(e) => editMetadata("end_date", e.target.value)}
                />
              </label>
              <label>
                {words.timezone}
                <select
                  aria-label="Timezone"
                  value={draft.metadata.timezone}
                  onChange={(e) => editMetadata("timezone", e.target.value)}
                >
                  {[...new Set([draft.metadata.timezone, ...zones])].map(
                    (z) => (
                      <option key={z}>{z}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                {words.currency}
                <select
                  aria-label="Currency"
                  value={draft.metadata.currency}
                  onChange={(e) => editMetadata("currency", e.target.value)}
                >
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </fieldset>
            <div className="trip-day-strip">
              <div role="tablist" aria-label="Trip days">
                {dates(draft).map((date, index) => (
                  <button
                    role="tab"
                    aria-selected={day === index}
                    className={day === index ? "active" : ""}
                    key={date}
                    onClick={() => setDay(index)}
                  >
                    <small>DAY {index + 1}</small>
                    {labelDate(date)}
                  </button>
                ))}
              </div>
              <button
                className="travel-button secondary"
                onClick={() => go("discover")}
              >
                <Plus size={16} />
                Add a destination
              </button>
            </div>
            <div className="trip-workspace">
              <section className="day-board">
                <div className="results-heading">
                  <h2>{draft.metadata.title}</h2>
                  <span>
                    {draft.items.filter((i) => i.day_index === day).length}{" "}
                    places
                  </span>
                </div>
                {draft.items
                  .filter((i) => i.day_index === day)
                  .sort((a, b) => a.position - b.position)
                  .map((item, index) => (
                    <article className="itinerary-place" key={item.id}>
                      <div className="itinerary-place-top">
                        <span className="place-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <span className="travel-eyebrow">
                            {item.place.kind === "city"
                              ? "DESTINATION"
                              : "PLACE"}{" "}
                            · UNSCHEDULED
                          </span>
                          <h3>{item.place.name}</h3>
                          <p>
                            {item.place.country} ·{" "}
                            {item.place.timezone || "Timezone unknown"}
                          </p>
                        </div>
                        <button
                          aria-label={"Remove " + item.place.name}
                          className="travel-icon-button"
                          disabled={busy || !!journal.current}
                          onClick={() =>
                            modifyItems(
                              draft.items.filter((i) => i.id !== item.id),
                            )
                          }
                        >
                          <X size={17} />
                        </button>
                      </div>
                      <label className="visit-note">
                        <span>Notes for this stop</span>
                        <textarea
                          aria-label={"Notes for " + item.place.name}
                          value={item.notes}
                          placeholder="A small reminder, a moment to leave room for…"
                          maxLength={4000}
                          disabled={busy || !!journal.current}
                          onChange={(e) =>
                            modifyItems(
                              draft.items.map((i) =>
                                i.id === item.id
                                  ? { ...i, notes: e.target.value }
                                  : i,
                              ),
                            )
                          }
                        />
                      </label>
                      <div className="visit-controls">
                        <label>
                          Move to
                          <select
                            aria-label={"Day for " + item.place.name}
                            value={item.day_index}
                            disabled={busy || !!journal.current}
                            onChange={(e) => move(item, Number(e.target.value))}
                          >
                            {dates(draft).map((date, i) => (
                              <option value={i} key={i}>
                                Day {i + 1} · {labelDate(date)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div>
                          <button
                            className="travel-icon-button"
                            aria-label={"Move " + item.place.name + " earlier"}
                            disabled={index === 0 || busy || !!journal.current}
                            onClick={() => move(item, day, index - 1)}
                          >
                            <ChevronLeft size={17} />
                          </button>
                          <button
                            className="travel-icon-button"
                            aria-label={"Move " + item.place.name + " later"}
                            disabled={
                              index ===
                                draft.items.filter((i) => i.day_index === day)
                                  .length -
                                  1 ||
                              busy ||
                              !!journal.current
                            }
                            onClick={() => move(item, day, index + 1)}
                          >
                            <ChevronRight size={17} />
                          </button>
                        </div>
                      </div>
                      <a
                        className="visit-source"
                        href={item.place.source_url || undefined}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.place.attribution}
                      </a>
                    </article>
                  ))}
                {draft.items.filter((i) => i.day_index === day).length ===
                  0 && (
                  <div className="discovery-empty">
                    <MapPin size={36} />
                    <h3>A little room for something good.</h3>
                    <p>
                      Add a destination to this day. Travel times, opening hours
                      and costs stay unknown until a qualified source provides
                      them.
                    </p>
                    <button
                      className="travel-button primary"
                      onClick={() => go("discover")}
                    >
                      Find a destination
                      <ArrowRight size={16} />
                    </button>
                  </div>
                )}
                <div className="trip-evidence-note">
                  <ShieldCheck size={18} />
                  <p>
                    These are your places and notes. No live fares, route times
                    or reservations are implied. Dates use your chosen trip
                    timezone.
                  </p>
                </div>
              </section>
              <div className="map-panel">
                <Suspense
                  fallback={
                    <div className="map-loading">Opening your places…</div>
                  }
                >
                  <TravelMap
                    places={currentPlaces}
                    selected={selected}
                    onSelect={setSelected}
                  />
                </Suspense>
              </div>
            </div>
          </>
        )}
        {view === "editor" && !draft && (
          <div className="discovery-empty">
            <h1>Start a journey.</h1>
            <button
              className="travel-button primary"
              onClick={() => {
                setDraft(newDraft());
                setDay(0);
              }}
            >
              Create a trip
            </button>
          </div>
        )}
        {view === "trips" && (
          <section className="trips-page">
            <div className="trip-page-intro">
              <div>
                <span className="travel-eyebrow">A JOURNEY TO RETURN TO</span>
                <h1>Your days, kept close.</h1>
                <p>
                  Local drafts stay on this device. Cloud trips belong to your
                  signed-in account.
                </p>
              </div>
              <button
                className="travel-button primary"
                disabled={busy || !!journal.current}
                onClick={() => {
                  journal.current = null;
                  setDraft(newDraft());
                  setDay(0);
                  go("editor");
                }}
              >
                <Plus size={16} />
                {words.new}
              </button>
            </div>
            <div className="trip-collection">
              <h2>
                On this device <span>{local.length}</span>
              </h2>
              <label className="travel-button secondary compact">
                <Upload size={14} />
                Import illustrative v1 export
                <input
                  type="file"
                  accept="application/json,.json"
                  aria-label="Import legacy export"
                  disabled={busy}
                  style={{ maxWidth: 180 }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importLegacy(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {local.length === 0 && (
                <p className="muted">
                  No drafts yet. Keep a trip on this device to return to it
                  here.
                </p>
              )}
              <div className="trip-card-grid">
                {local.map((d) => (
                  <article className="saved-trip-card" key={d.id}>
                    <div className="trip-cover">
                      <Route size={34} />
                      <span>LOCAL DRAFT</span>
                    </div>
                    <h3>{d.metadata.title}</h3>
                    <p>
                      {labelDate(d.metadata.start_date)} · {d.items.length}{" "}
                      places
                    </p>
                    <div className="trip-card-actions">
                      <button
                        className="travel-button secondary"
                        disabled={busy || !!journal.current}
                        onClick={() => {
                          journal.current = null;
                          setDraft(structuredClone(d));
                          setDay(0);
                          go("editor");
                        }}
                      >
                        Open trip
                        <ArrowRight size={14} />
                      </button>
                      <button
                        className="travel-icon-button"
                        aria-label={"Delete local draft " + d.metadata.title}
                        onClick={() => {
                          if (
                            confirm(
                              "Delete this local draft? Export a backup first if you need it.",
                            )
                          ) {
                            removeDraft(d.id);
                            setLocal(loadDrafts());
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="trip-collection">
              <h2>
                In your account <span>{cloud.length}</span>
              </h2>
              {!session ? (
                <div className="cloud-connect-card">
                  <ShieldCheck size={25} />
                  <div>
                    <h3>Your journeys, privately saved.</h3>
                    <p>
                      Sign in after the project is connected to save and reopen
                      trips across devices.
                    </p>
                  </div>
                  <button
                    className="travel-button secondary"
                    onClick={() => setAuthOpen(true)}
                  >
                    {words.signIn}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    className="travel-button secondary compact"
                    onClick={() => void refreshCloud()}
                  >
                    Refresh cloud trips
                  </button>
                  {cloudCursor && (
                    <button
                      className="travel-button secondary compact"
                      onClick={() => void refreshCloud(true)}
                    >
                      Load more trips
                    </button>
                  )}
                  <div className="trip-card-grid">
                    {cloud.map((trip) => (
                      <article className="saved-trip-card" key={trip.id}>
                        <div className="trip-cover cloud">
                          <Globe2 size={34} />
                          <span>PRIVATE CLOUD TRIP</span>
                        </div>
                        <h3>{trip.title}</h3>
                        <p>
                          {labelDate(trip.start_date)} ·{" "}
                          {trip.items?.length || 0} places
                        </p>
                        <div className="trip-card-actions">
                          <button
                            className="travel-button secondary"
                            disabled={busy || !!journal.current}
                            onClick={() => {
                              journal.current = null;
                              setDraft({
                                ...cloudDraft(trip),
                                cloud_owner: session?.user.id,
                              });
                              setDay(0);
                              go("editor");
                            }}
                          >
                            Open trip
                            <ArrowRight size={14} />
                          </button>
                          <button
                            className="travel-icon-button"
                            aria-label={"Delete cloud trip " + trip.title}
                            onClick={() => {
                              if (
                                token &&
                                confirm("Delete this cloud trip permanently?")
                              )
                                void deleteTrip(trip, token)
                                  .then(() => refreshCloud())
                                  .catch((e) => setError(e.message));
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        )}
        {view === "translator" && <Translator />}
        {view === "about" && (
          <section className="tool-page">
            <span className="travel-eyebrow">A LITTLE MORE JOURNEY</span>
            <h1>
              Travel with confidence.
              <br />
              Keep the moments that matter.
            </h1>
            <p>
              Payanam is a free planning workspace built around real places,
              understandable source information and days you can make your own.
            </p>
            <div className="free-plan">
              <span>FREE PILOT</span>
              <strong>₹0</strong>
              <p>
                Explore real cities, use the map, organize days and export your
                drafts. Cloud trips and detailed place search need the connected
                free services.
              </p>
              <small>
                No bookings or payments. Free services have quotas and may be
                temporarily unavailable. Existing upstream licensing is under
                review; no blanket open-source license is asserted.
              </small>
            </div>
            <div className="free-plan">
              <h2>Your data</h2>
              <p>
                Local drafts are stored only after you choose to keep them.
                Cloud upload requires an explicit save. Deleting Payanam cloud
                data removes your trips and deactivates access; your Supabase
                sign-in account is managed separately by the project owner.
              </p>
              <button
                className="travel-button secondary"
                onClick={() => {
                  if (
                    confirm(
                      "Remove all local drafts from this device? Export a backup first.",
                    )
                  ) {
                    localStorage.removeItem("payanam.drafts.v2");
                    setLocal([]);
                    setNotice("Local drafts removed.");
                  }
                }}
              >
                Clear device drafts
              </button>
              {session && (
                <button
                  className="travel-button secondary"
                  disabled={busy}
                  onClick={() => {
                    if (
                      token &&
                      confirm(
                        "Permanently delete all your Payanam cloud trips and deactivate access? Export first.",
                      )
                    ) {
                      setBusy(true);
                      void request("/me", { method: "DELETE", token })
                        .then(() => auth?.auth.signOut())
                        .then(() =>
                          setNotice(
                            "Cloud trips deleted and Payanam access deactivated.",
                          ),
                        )
                        .catch((e) => setError(e.message))
                        .finally(() => setBusy(false));
                    }
                  }}
                >
                  Delete my Payanam cloud data
                </button>
              )}
            </div>
          </section>
        )}
      </main>
      <footer className="travel-footer">
        <div>
          <strong>
            payanam<span>.</span>
          </strong>
          <p>Travel with confidence. Keep the moments that matter.</p>
        </div>
        <div>
          <button onClick={() => go("about")}>About & free plan</button>
          <a href="?mode=demo">Illustrative Madurai demo</a>
          <a
            href="https://github.com/Krithika-2525/Payanam-2.0"
            target="_blank"
            rel="noreferrer"
          >
            Source & roadmap
          </a>
        </div>
        <small>
          GeoNames · CC BY 4.0 · OpenMapTiles · © OpenStreetMap contributors
        </small>
      </footer>
      {authOpen && (
        <div
          className="travel-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) {
              setAuthOpen(false);
              setPassword("");
            }
          }}
        >
          <section
            ref={modalRef}
            className="travel-auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
          >
            <button
              className="travel-icon-button modal-dismiss"
              aria-label="Close sign in"
              onClick={() => {
                setAuthOpen(false);
                setPassword("");
              }}
              disabled={busy}
            >
              <X size={20} />
            </button>
            <span className="travel-auth-icon">
              <ShieldCheck size={30} />
            </span>
            <h2 id="auth-title">Your journeys, kept private.</h2>
            <p>
              Sign in to save to your account. Your local draft is not uploaded
              until you choose Save to cloud.
            </p>
            {!auth ? (
              <div className="travel-notice">
                Sign-in is waiting for the Supabase project connection. You can
                explore cities and keep drafts on this device now.
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void signIn();
                }}
              >
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="username"
                    value={email}
                    required
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    required
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button className="travel-button primary" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in to your account"}
                </button>
                <button
                  type="button"
                  className="travel-button secondary"
                  disabled={busy}
                  onClick={() =>
                    void auth.auth
                      .signUp({ email, password })
                      .then(({ error }) => {
                        if (error) setError(error.message);
                        else
                          setNotice(
                            "Check your email to confirm your account, then sign in.",
                          );
                      })
                  }
                >
                  Create an account
                </button>
                <button
                  type="button"
                  className="travel-button secondary"
                  disabled={busy}
                  onClick={() => {
                    try {
                      if (draft) {
                        if (
                          !confirm(
                            "Keep this draft temporarily in this browser tab while Google signs you in? Nothing is uploaded.",
                          )
                        )
                          return;
                        preserveOAuthDraft(draft);
                      }
                      void auth.auth
                        .signInWithOAuth({
                          provider: "google",
                          options: { redirectTo: location.origin },
                        })
                        .then(({ error }) => {
                          if (error) setError(error.message);
                        });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Continue with Google
                </button>
                <small>
                  Use an account in the connected project. Google sign-in must
                  be enabled by its owner.
                </small>
              </form>
            )}
            <button
              className="text-link"
              onClick={() => {
                setAuthOpen(false);
                setPassword("");
              }}
            >
              Keep exploring
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
