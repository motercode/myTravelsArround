"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Map as LeafletMap } from "leaflet";
import { Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Contribution } from "@/lib/contributions";

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

export function MapView({ contributions }: { contributions: Contribution[] }) {
  const [map, setMap] = useState<LeafletMap | null>(null);

  const authors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of contributions) counts.set(c.author, (counts.get(c.author) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [contributions]);

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = useMemo(
    () => contributions.filter((c) => !hidden.has(c.author)),
    [contributions, hidden],
  );

  const toggleAuthor = (author: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(author)) next.delete(author);
      else next.add(author);
      return next;
    });

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
      <TravelMap contributions={visible} onReady={setMap} />

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
