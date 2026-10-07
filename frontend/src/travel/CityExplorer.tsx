import { useEffect, useState } from "react";
import { ArrowRight, MapPin, Compass } from "lucide-react";
import { request, type Place } from "./client";
import type { components } from "./schema";
export type Hotspots = components["schemas"]["HotspotResult"];
export default function CityExplorer({
  city,
  onPlan,
}: {
  city: Place;
  onPlan: () => void;
}) {
  const [data, setData] = useState<Hotspots | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    setData(null);
    setError("");
    request<Hotspots>("/cities/" + city.id + "/hotspots", {
      signal: abort.signal,
    })
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [city.id]);
  return (
    <section
      className="city-preview"
      aria-label={"Nearby places in " + city.name}
    >
      <div className="city-preview-title">
        <Compass size={24} />
        <div>
          <span className="travel-eyebrow">BEYOND THE CITY NAME</span>
          <h2>{city.name}, up close.</h2>
          <p>
            {data
              ? `${data.places.length} sourced places nearby · museums, heritage & local discoveries`
              : "Explore nearby places and build your days."}
          </p>
        </div>
        <button className="travel-button primary" onClick={onPlan}>
          Explore & plan this city <ArrowRight size={16} />
        </button>
      </div>
      <div className="city-preview-places">
        {data?.places.slice(0, 4).map((p) => (
          <button key={p.id} onClick={onPlan}>
            <MapPin size={15} />
            {p.name}
          </button>
        ))}
        {error && <p>{error}</p>}
      </div>
    </section>
  );
}
