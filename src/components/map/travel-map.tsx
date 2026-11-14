"use client";

import "leaflet/dist/leaflet.css";
import { useMemo, useState } from "react";
import { canvas, divIcon, type LatLngBoundsExpression, type Map as LeafletMap } from "leaflet";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { buildClusterIndex, clusterBBox, clusterSize, type PointProps } from "@/lib/clusters";
import type { Contribution } from "@/lib/contributions";

const SPAIN_BOUNDS: LatLngBoundsExpression = [
  [36, -9.5],
  [43.8, 3.4],
];

const MARKER_RADIUS = 7;

// Zona de clic y de tooltip: con una tolerancia igual al radio, el radio efectivo es el doble y el
// área, 4 veces (#37), sin que los puntos se vean más grandes. Este componente solo se carga en el
// navegador (sin SSR), así que se puede crear el renderer aquí.
const RENDERER = canvas({ tolerance: MARKER_RADIUS });

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

// Grupo de fotos: círculo con el número, más grande cuantas más fotos tiene. HTML fijo con estilos
// en línea porque Leaflet lo inserta fuera de React.
function clusterIcon(count: number, label: string | number) {
  const size = clusterSize(count);
  return divIcon({
    className: "",
    iconSize: [size, size],
    html: `<div class="marker-cluster" style="width:${size}px;height:${size}px;border-radius:9999px;background:rgba(37,99,235,.85);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);color:#fff;font:600 12px/1 system-ui,sans-serif;display:flex;align-items:center;justify-content:center">${label}</div>`,
  });
}

function viewOf(map: LeafletMap) {
  // Un 20 % de margen alrededor para que al mover el mapa no aparezcan huecos antes de recalcular.
  const b = map.getBounds().pad(0.2);
  return { bbox: clusterBBox(b.getWest(), b.getSouth(), b.getEast(), b.getNorth()), zoom: Math.round(map.getZoom()) };
}

// Solo dibuja los grupos y las fotos del área visible; se recalcula al terminar de mover el mapa.
function ClusteredMarkers({ contributions }: { contributions: Contribution[] }) {
  const map = useMap();
  const index = useMemo(() => buildClusterIndex(contributions), [contributions]);
  const [view, setView] = useState(() => viewOf(map));
  useMapEvents({ moveend: () => setView(viewOf(map)) });
  const features = useMemo(() => index.getClusters(view.bbox, view.zoom), [index, view]);

  return features.map((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    if ("cluster" in feature.properties && feature.properties.cluster) {
      const { cluster_id, point_count, point_count_abbreviated } = feature.properties;
      return (
        <Marker
          key={`g${cluster_id}`}
          position={[lat, lng]}
          icon={clusterIcon(point_count, point_count_abbreviated)}
          eventHandlers={{
            click: () => map.flyTo([lat, lng], Math.min(index.getClusterExpansionZoom(cluster_id), 19)),
          }}
        >
          <Tooltip direction="top">{point_count} fotos · clic para acercar</Tooltip>
        </Marker>
      );
    }
    const c = contributions[(feature.properties as PointProps).index];
    return (
      <CircleMarker
        key={c.id}
        center={[c.lat, c.lng]}
        radius={MARKER_RADIUS}
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
    );
  });
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
      renderer={RENDERER}
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
      <ClusteredMarkers contributions={contributions} />
    </MapContainer>
  );
}
