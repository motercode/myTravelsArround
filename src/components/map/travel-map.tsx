"use client";

import "leaflet/dist/leaflet.css";
import type { LatLngBoundsExpression, Map as LeafletMap } from "leaflet";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import type { Contribution } from "@/lib/contributions";

const SPAIN_BOUNDS: LatLngBoundsExpression = [
  [36, -9.5],
  [43.8, 3.4],
];

const MARKER_STYLE = {
  color: "#ffffff",
  weight: 1.5,
  fillColor: "#2563eb",
  fillOpacity: 0.9,
};

function initialBounds(points: Contribution[]): LatLngBoundsExpression {
  if (points.length === 0) return SPAIN_BOUNDS;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

export default function TravelMap({
  contributions,
  onReady,
}: {
  contributions: Contribution[];
  onReady: (map: LeafletMap) => void;
}) {
  return (
    <MapContainer
      bounds={initialBounds(contributions)}
      boundsOptions={{ padding: [40, 40], maxZoom: 15 }}
      preferCanvas
      worldCopyJump
      className="h-full w-full"
      ref={(map) => {
        if (map) onReady(map);
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {contributions.map((c) => (
        <CircleMarker
          key={c.id}
          center={[c.lat, c.lng]}
          radius={7}
          pathOptions={MARKER_STYLE}
          eventHandlers={{
            click: () => window.open(c.mapsUrl, "_blank", "noopener,noreferrer"),
          }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            <div className="flex w-48 flex-col gap-1">
              {c.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" className="h-28 w-48 rounded object-cover" loading="lazy" />
              )}
              <span className="text-xs font-medium">{c.author}</span>
              <span className="text-[10px] text-neutral-500">Clic para abrir en Google Maps</span>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
