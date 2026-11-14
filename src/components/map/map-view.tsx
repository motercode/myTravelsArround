"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Map as LeafletMap } from "leaflet";
import { Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { photosFromBase, type MapBase, type MapPhoto } from "@/lib/map-data";
import type { TripSummary } from "@/lib/trips";
import { TripPicker } from "./trip-picker";

// Leaflet necesita `window`: solo se renderiza en cliente.
const TravelMap = dynamic(() => import("./travel-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  ),
});

type SearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
};

const NO_PHOTOS: MapPhoto[] = [];

export function MapView({ trips }: { trips: TripSummary[] }) {
  const [map, setMap] = useState<LeafletMap | null>(null);

  // Las fotos llegan aparte, en /datos/base.json (generado en el build): la página no las lleva
  // dentro (#42).
  const [loaded, setLoaded] = useState<MapPhoto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    fetch("/datos/base.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<MapBase>;
      })
      .then((base) => setLoaded(photosFromBase(base)))
      .catch(() => setLoadError(true));
  }, []);
  const contributions = loaded ?? NO_PHOTOS;

  const authors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of contributions) counts.set(c.author, (counts.get(c.author) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [contributions]);

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [tripId, setTripId] = useState<string | null>(null);
  const visible = useMemo(
    () => contributions.filter((c) => !hidden.has(c.author) && (tripId === null || c.tripId === tripId)),
    [contributions, hidden, tripId],
  );
  // Solo los viajes de los autores que se ven.
  const visibleTrips = useMemo(() => trips.filter((t) => !hidden.has(t.author)), [trips, hidden]);

  const toggleAuthor = (author: string) => {
    // Si se oculta el autor del viaje elegido, el viaje deja de estar elegido.
    if (!hidden.has(author) && trips.find((t) => t.id === tripId)?.author === author) setTripId(null);
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(author)) next.delete(author);
      else next.add(author);
      return next;
    });
  };

  // Al elegir un viaje, el mapa se encuadra sobre sus fotos (como el encuadre inicial).
  useEffect(() => {
    if (!map || tripId === null || visible.length === 0) return;
    map.fitBounds(
      visible.map((c) => [c.lat, c.lng] as [number, number]),
      { padding: [40, 40], maxZoom: 15 },
    );
  }, [map, tripId]); // eslint-disable-line react-hooks/exhaustive-deps -- solo al cambiar de viaje

  // Búsqueda de POI con Nominatim (solo al enviar: su política limita a 1 req/s).
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.search = new URLSearchParams({ q, format: "jsonv2", limit: "6", "accept-language": "es" }).toString();
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SearchResult[] = await res.json();
      setResults(data);
      if (data.length === 0) setSearchError("Sin resultados");
    } catch {
      setSearchError("No se pudo buscar. Inténtalo de nuevo.");
    } finally {
      setSearching(false);
    }
  }

  function goTo(r: SearchResult) {
    const [south, north, west, east] = r.boundingbox.map(Number);
    map?.flyToBounds(
      [
        [south, west],
        [north, east],
      ],
      { maxZoom: 16 },
    );
    setResults([]);
  }

  return (
    <div className="relative h-dvh w-full">
      {loaded ? (
        <TravelMap photos={visible} initial={loaded} onReady={setMap} />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {loadError ? "No se han podido cargar las fotos. Recarga la página." : <Loader2 className="size-6 animate-spin" />}
        </div>
      )}

      <div className="absolute left-3 right-3 top-3 z-[1000] flex flex-col gap-2 sm:right-auto sm:w-80">
        <div className="rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur">
          <h1 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <MapPin className="size-4 text-primary" /> My Travels Arround
          </h1>

          <form onSubmit={search} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar lugar o POI…"
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <Button type="submit" size="icon" disabled={searching} aria-label="Buscar">
              {searching ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </form>

          {searchError && <p className="mt-2 text-xs text-muted-foreground">{searchError}</p>}
          {results.length > 0 && (
            <ul className="mt-2 max-h-56 overflow-y-auto rounded-md border">
              {results.map((r) => (
                <li key={r.place_id}>
                  <button
                    type="button"
                    onClick={() => goTo(r)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-secondary"
                  >
                    {r.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 border-t pt-3">
            <TripPicker trips={visibleTrips} selectedId={tripId} onSelect={setTripId} />
          </div>

          <div className="mt-3 flex flex-col gap-1.5 border-t pt-3">
            {authors.map(([author, count]) => (
              <label key={author} className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={!hidden.has(author)}
                  onChange={() => toggleAuthor(author)}
                  className="accent-blue-600"
                />
                <span className="flex-1">{author}</span>
                <span className="text-muted-foreground">{count}</span>
              </label>
            ))}
            <p className="text-[11px] text-muted-foreground">
              {visible.length} fotos en el mapa · clic en un punto para abrirla en Google Maps
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
