"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Route } from "lucide-react";
import { formatTripDates, groupTripsByYear, type TripSummary } from "@/lib/trips";

// Desplegable de viajes agrupados por año (docs/features/viajes.md, 4.3). Cada año es otro
// desplegable; solo el más reciente empieza abierto.
export function TripPicker({
  trips,
  selectedId,
  onSelect,
}: {
  trips: TripSummary[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const years = useMemo(() => groupTripsByYear(trips), [trips]);
  const selected = trips.find((t) => t.id === selectedId) ?? null;

  if (trips.length === 0) {
    return (
      <button type="button" disabled className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-xs opacity-60">
        <Route className="size-4" /> Sin fechas de fotos
      </button>
    );
  }

  const choose = (id: string | null) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="lista-viajes"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-left text-xs hover:bg-secondary"
      >
        <Route className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate">
          {selected ? `Viaje: ${selected.name ? `${selected.name} · ` : ""}${formatTripDates(selected)}` : "Viajes: todas las fotos"}
        </span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div id="lista-viajes" className="mt-2 max-h-72 overflow-y-auto rounded-md border text-xs">
          <button
            type="button"
            onClick={() => choose(null)}
            aria-pressed={selectedId === null}
            className="w-full px-3 py-2 text-left font-medium hover:bg-secondary aria-pressed:bg-secondary"
          >
            Todas las fotos
          </button>
          {years.map(({ year, trips }, i) => (
            <details key={year} open={i === 0} className="border-t">
              <summary className="cursor-pointer px-3 py-2 font-medium hover:bg-secondary">
                {year} <span className="font-normal text-muted-foreground">· {trips.length} {trips.length === 1 ? "viaje" : "viajes"}</span>
              </summary>
              <ul>
                {trips.map((trip) => (
                  <li key={trip.id}>
                    <button
                      type="button"
                      onClick={() => choose(trip.id)}
                      aria-pressed={trip.id === selectedId}
                      className="w-full px-5 py-1.5 text-left hover:bg-secondary aria-pressed:bg-secondary"
                    >
                      <span className="block">
                        {trip.name && <span className="font-medium">{trip.name} · </span>}
                        {formatTripDates(trip)}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {trip.dayCount} {trip.dayCount === 1 ? "día" : "días"} · {trip.photoCount}{" "}
                        {trip.photoCount === 1 ? "foto" : "fotos"} · {trip.author}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
