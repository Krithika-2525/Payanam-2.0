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
  routeCoordinates,
  roadRoute = false,
}: {
  places: Place[];
  selected: string | null;
  onSelect: (id: string) => void;
  routeCoordinates?: number[][];
  roadRoute?: boolean;
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
        maxZoom: 14,
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
  useEffect(() => {
    const value = map.current;
    if (!ready || !value) return;
    const source = value.getSource("journey-route") as
      | maplibregl.GeoJSONSource
      | undefined;
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: routeCoordinates || [],
      },
    };
    if (source) source.setData(data);
    else {
      value.addSource("journey-route", { type: "geojson", data });
      value.addLayer({
        id: "journey-route",
        type: "line",
        source: "journey-route",
        paint: {
          "line-color": "#1e625e",
          "line-width": 3,
          "line-dasharray": [2, 2],
        },
      });
    }
    value.setPaintProperty(
      "journey-route",
      "line-dasharray",
      roadRoute ? [1, 0] : [2, 2],
    );
  }, [ready, routeCoordinates, roadRoute]);
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
        {routeCoordinates
          ? roadRoute
            ? "Road route · no live traffic"
            : "Estimated links · check directions before travelling"
          : "Real places · © OpenStreetMap contributors"}
      </div>
    </div>
  );
}
