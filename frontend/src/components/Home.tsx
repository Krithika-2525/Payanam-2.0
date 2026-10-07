import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Compass,
  Flower2,
  Heart,
  Leaf,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import type { Language, Preferences } from "../types";
import { t } from "../i18n";

export type JourneyPreset = Pick<
  Preferences,
  "required_place_ids" | "optional_place_ids" | "pace"
>;
const ideas = [
  {
    title: "Sacred & slow",
    tag: "TEMPLES & TRADITION",
    kind: "temples",
    image: "madurai",
    alt: "Madurai skyline and the towers of Meenakshi Temple",
    icon: Flower2,
    description: "Meaningful temple visits. Quiet pauses. A day to reconnect.",
    places: "Meenakshi · Alagar · Pazhamudircholai",
    required_place_ids: ["meenakshi", "alagar"],
    optional_place_ids: ["pazhamudircholai"],
    pace: "relaxed" as const,
  },
  {
    title: "A city with a story",
    tag: "ART & HISTORY",
    kind: "culture",
    image: "museum",
    alt: "Gandhi Memorial Museum in Madurai",
    icon: Compass,
    description:
      "Walk through royal courtyards and discover Madurai’s many layers.",
    places: "Nayakkar Palace · Gandhi Museum · Teppakulam",
    required_place_ids: ["palace", "gandhi"],
    optional_place_ids: ["teppakulam"],
    pace: "standard" as const,
  },
  {
    title: "A little of everything",
    tag: "THE CITY, YOUR WAY",
    kind: "mixed",
    image: "palace",
    alt: "Architectural views of Thirumalai Nayakkar Palace",
    icon: Sparkles,
    description:
      "One special visit, a little culture, and plenty of room to breathe.",
    places: "Meenakshi · Nayakkar Palace · Gandhi Museum",
    required_place_ids: ["meenakshi", "palace"],
    optional_place_ids: ["gandhi", "teppakulam"],
    pace: "relaxed" as const,
  },
];
export function Home({
  preferences,
  setPreferences,
  onContinue,
  onChoosePreset,
  language,
}: {
  preferences: Preferences;
  setPreferences: (p: Preferences) => void;
  onContinue: () => void;
  onChoosePreset: (p: JourneyPreset) => void;
  language: Language;
}) {
  const [filter, setFilter] = useState("all");
  const change = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setPreferences({ ...preferences, [key]: value });
  return (
    <>
      <section className="booking-hero" aria-labelledby="home-title">
        <div className="hero-heading">
          <span className="hero-location">
            <MapPin size={14} />
            THE MADURAI EDITION
          </span>
          <h1 id="home-title">Your next great day starts here.</h1>
          <p>
            Places that matter. People you love. A plan that brings it all
            together.
          </p>
        </div>
        <form
          className="search-card"
          onSubmit={(e) => {
            e.preventDefault();
            onContinue();
          }}
        >
          <div className="search-card-top">
            <div className="journey-type">
              <span className="selected-type">
                <Check size={14} />
                One-day journey
              </span>
              <span>In and around Madurai</span>
            </div>
            <span className="search-card-note">
              <ShieldCheck size={15} />
              Built around your must-see moments
            </span>
          </div>
          <div className="search-fields">
            <div className="search-field origin-field">
              <span>
                <MapPin size={15} /> STARTING FROM
              </span>
              <strong>Madurai</strong>
              <small>Madurai Junction · Tamil Nadu</small>
            </div>
            <label className="search-field">
              <span>
                <CalendarDays size={15} /> JOURNEY DATE
              </span>
              <input
                type="date"
                aria-label="Journey date"
                required
                value={preferences.date}
                onChange={(e) => change("date", e.target.value)}
              />
              <small>A day to look forward to</small>
            </label>
            <label className="search-field">
              <span>
                <Users size={15} /> TRAVELERS
              </span>
              <div className="field-with-unit">
                <input
                  type="number"
                  aria-label="Travelers"
                  min="1"
                  max="20"
                  required
                  value={preferences.party_size}
                  onChange={(e) => change("party_size", Number(e.target.value))}
                />
                <b>people</b>
              </div>
              <small>Your whole group, together</small>
            </label>
            <label className="search-field">
              <span>
                <Clock3 size={15} /> FINISH BY
              </span>
              <input
                type="time"
                aria-label="Finish by"
                required
                value={preferences.end_time}
                onChange={(e) => change("end_time", e.target.value)}
              />
              <small>We’ll keep an eye on the time</small>
            </label>
            <label className="search-field">
              <span>
                <Wallet size={15} /> GROUP BUDGET
              </span>
              <div className="field-with-unit">
                <b>₹</b>
                <input
                  type="number"
                  aria-label="Group transport budget"
                  min="1"
                  max="100000"
                  required
                  value={preferences.budget_inr}
                  onChange={(e) => change("budget_inr", Number(e.target.value))}
                />
              </div>
              <small>Transport estimate for everyone</small>
            </label>
          </div>
          <div className="search-card-bottom">
            <fieldset className="quick-pace">
              <legend>Your kind of pace</legend>
              {(["relaxed", "standard"] as const).map((p) => (
                <label
                  key={p}
                  className={preferences.pace === p ? "chosen" : ""}
                >
                  <input
                    type="radio"
                    name="home-pace"
                    checked={preferences.pace === p}
                    onChange={() => change("pace", p)}
                  />
                  {p === "relaxed" ? "Relaxed pace" : "More exploring"}
                </label>
              ))}
            </fieldset>
            <p>
              <Leaf size={16} />
              There’s always time for a little pause.
            </p>
          </div>
          <button className="button primary search-submit" type="submit">
            {t(language).plan}
            <ArrowRight size={19} />
          </button>
        </form>
        <p className="search-disclaimer">
          Planning preview · Illustrative hours & fares · No reservations or
          payments
        </p>
      </section>
      <section className="benefits-row" aria-label="The Payanam promise">
        <div>
          <span className="benefit-icon">
            <Heart size={23} />
          </span>
          <span>
            <b>Your priorities, first</b>
            <small>Must-see places shape your day.</small>
          </span>
        </div>
        <div>
          <span className="benefit-icon">
            <Wallet size={23} />
          </span>
          <span>
            <b>A little more clarity</b>
            <small>See the group transport estimate.</small>
          </span>
        </div>
        <div>
          <span className="benefit-icon">
            <RefreshIcon />
          </span>
          <span>
            <b>A plan that can adapt</b>
            <small>Compare alternatives when delayed.</small>
          </span>
        </div>
      </section>
      <section className="inspiration" aria-labelledby="inspiration-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              GOOD DAYS START WITH A LITTLE INSPIRATION
            </span>
            <h2 id="inspiration-title">Find your kind of journey</h2>
            <p>A starting point for your day. Make every detail your own.</p>
          </div>
          <button className="text-button" onClick={onContinue}>
            Build your own day
            <ArrowRight size={16} />
          </button>
        </div>
        <div
          className="filter-tabs"
          role="group"
          aria-label="Filter journey ideas"
        >
          {[
            ["all", "All journeys"],
            ["temples", "Temples & tradition"],
            ["culture", "Art & history"],
          ].map(([key, label]) => (
            <button
              className={filter === key ? "active" : ""}
              aria-pressed={filter === key}
              key={key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="inspiration-grid">
          {ideas
            .filter((idea) => filter === "all" || idea.kind === filter)
            .map((idea) => (
              <button
                className="inspiration-card"
                key={idea.title}
                onClick={() => onChoosePreset(idea)}
              >
                <div className={`idea-photo photo-${idea.image}`}>
                  <img
                    src={`/images/${idea.image}.jpg`}
                    alt={idea.alt}
                    loading="lazy"
                  />
                  <span className="photo-tag">
                    <idea.icon size={13} />
                    {idea.tag}
                  </span>
                </div>
                <div className="idea-content">
                  <h3>{idea.title}</h3>
                  <p>{idea.description}</p>
                  <div className="idea-places">
                    <MapPin size={13} />
                    <span>{idea.places}</span>
                  </div>
                  <div className="idea-bottom">
                    <span>
                      <Leaf size={14} />
                      {idea.pace === "relaxed"
                        ? "Unhurried pace"
                        : "A little more exploring"}
                    </span>
                    <span className="idea-action">
                      Explore this day
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </button>
            ))}
        </div>
      </section>
      <section className="family-banner">
        <div>
          <span className="eyebrow">MORE THAN A ROUTE ON A MAP</span>
          <h2>
            Made for the people
            <br />
            you travel with.
          </h2>
          <p>
            Room for your parents to rest. Time for one more conversation. A day
            that feels like yours.
          </p>
          <button className="button secondary" onClick={onContinue}>
            Make room for what matters
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="family-visual">
          <img
            src="/images/madurai.jpg"
            alt="A panoramic view across Madurai and Meenakshi Temple"
            loading="lazy"
          />
          <span>
            <MapPin size={15} />
            Madurai, where every day has a story.
          </span>
        </div>
      </section>
      <section className="how-it-works" id="how-it-works">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THOUGHTFULLY SIMPLE</span>
            <h2>A good day, in three steps</h2>
          </div>
          <span className="muted-chip">Made for moments, not just miles</span>
        </div>
        <div className="steps-grid">
          {[
            [
              "01",
              "Tell us what matters",
              "Choose your must-see places, group budget and the pace that feels right.",
            ],
            [
              "02",
              "Find your flow",
              "Get a day arranged around example opening sessions, travel and rest time.",
            ],
            [
              "03",
              "Carry the day with you",
              "Save, print or export your itinerary. Compare a new plan if you’re delayed.",
            ],
          ].map(([n, title, description]) => (
            <div key={n}>
              <span className="step-number">{n}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="faq-section" id="help">
        <h2>A little clarity before you go</h2>
        <details>
          <summary>Does Payanam book tickets or transport?</summary>
          <p>
            This release plans your day. It does not make reservations, collect
            payments or dispatch transport. Hours, fares and travel times are
            illustrative; confirm them locally before traveling.
          </p>
        </details>
        <details>
          <summary>Where are my saved journeys stored?</summary>
          <p>
            In this browser on this device. Export a journey backup to keep it
            elsewhere, or print an itinerary before you leave. Clearing browser
            storage removes saved journeys.
          </p>
        </details>
        <details>
          <summary>Can I plan outside Madurai?</summary>
          <p>
            For now, Payanam supports one-day journeys starting at Madurai
            Junction, with six places in and around Madurai. Your itinerary ends
            at the last visit; a return transfer is not included.
          </p>
        </details>
      </section>
      <div className="promise-note">
        <Heart size={19} />
        <p>Travel with confidence. Keep the moments that matter.</p>
      </div>
    </>
  );
}
function RefreshIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M20 11a8 8 0 0 0-14-5L3 9m0-6v6h6M4 13a8 8 0 0 0 14 5l3-3m0 6v-6h-6" />
    </svg>
  );
}
