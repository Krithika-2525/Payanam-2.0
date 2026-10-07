import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { Place } from "./client";
maplibregl.setWorkerUrl(workerUrl);

export default function TravelMap({
  places,
  selected,
  onSelect,
}: {
  places: Place[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    markers = useRef<maplibregl.Marker[]>([]);
  const [status, setStatus] = useState("Opening the world map…"),
    [ready, setReady] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    let active = true;
    try {
      const value = new maplibregl.Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [78.2, 20.6],
        zoom: 3,
        attributionControl: { compact: false },
      });
      map.current = value;
      value.addControl(new maplibregl.NavigationControl(), "top-right");
      value.on("load", () => {
        if (active) {
          setReady(true);
          setStatus("");
        }
      });
      value.on("error", () => {
        if (active)
          setStatus(
            "Map tiles are unavailable. You can still use the destination list.",
          );
      });
    } catch {
      setStatus(
        "The map is unavailable on this device. The destination list still works.",
      );
    }
    return () => {
      active = false;
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const bounds = new maplibregl.LngLatBounds();
    places.forEach((p, index) => {
      const button = document.createElement("button");
      button.className =
        "journey-map-pin" + (p.id === selected ? " selected" : "");
      button.textContent = String(index + 1);
      button.setAttribute("aria-label", "Select " + p.name);
      button.onclick = () => onSelect(p.id);
      markers.current.push(
        new maplibregl.Marker({ element: button })
          .setLngLat([p.longitude, p.latitude])
          .addTo(map.current!),
      );
      bounds.extend([p.longitude, p.latitude]);
    });
    if (places.length)
      map.current.fitBounds(bounds, {
        padding: 75,
        maxZoom: 10,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 600,
      });
  }, [places, ready]);
  useEffect(() => {
    if (!ready) return;
    markers.current.forEach((m, i) =>
      m.getElement().classList.toggle("selected", places[i]?.id === selected),
    );
  }, [selected, ready, places]);
  return (
    <div className="journey-map">
      <div
        className="map-canvas"
        ref={container}
        role="region"
        aria-label="Destination map"
      />
      {status && (
        <div className="map-status" role="status">
          {status}
        </div>
      )}
      <div className="map-caption">
        Real world map · route times are not calculated
      </div>
    </div>
  );
}
