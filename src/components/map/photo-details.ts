"use client";

import { useEffect, useMemo, useState } from "react";
import { chunkOf, DETAIL_CHUNK_SIZE, type DetailChunk } from "@/lib/map-data";

// URL de las fotos pedidas por bloques a /datos/detalles/<n> (#42) y guardadas mientras dure la
// visita. Cada bloque se pide una sola vez aunque lo necesiten varias fotos a la vez.
const loaded = new Map<number, DetailChunk>();
const pending = new Map<number, Promise<DetailChunk>>();

export function loadChunk(n: number): Promise<DetailChunk> {
  const ready = loaded.get(n);
  if (ready) return Promise.resolve(ready);
  let request = pending.get(n);
  if (!request) {
    request = fetch(`/datos/detalles/${n}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DetailChunk>;
      })
      .then((chunk) => {
        loaded.set(n, chunk);
        return chunk;
      })
      .finally(() => pending.delete(n));
    pending.set(n, request);
  }
  return request;
}

export type PhotoDetails = { url: string; imageUrl: string | null };

/** Detalles de una foto si su bloque ya está cargado. */
export function detailsOf(index: number): PhotoDetails | undefined {
  const row = loaded.get(chunkOf(index))?.[index % DETAIL_CHUNK_SIZE];
  return row ? { url: row[0], imageUrl: row[1] } : undefined;
}

/** Pide los bloques de estas fotos y vuelve a pintar cuando llegan. */
export function useDetails(indexes: number[]) {
  const chunks = useMemo(() => [...new Set(indexes.map(chunkOf))].sort((a, b) => a - b), [indexes]);
  const [, setVersion] = useState(0);
  const key = chunks.join(",");
  useEffect(() => {
    let alive = true;
    for (const n of chunks) {
      if (loaded.has(n)) continue;
      loadChunk(n)
        .then(() => alive && setVersion((v) => v + 1))
        .catch(() => {}); // sin detalles, el tooltip dice que no se han podido cargar
    }
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- `key` resume `chunks`
}
