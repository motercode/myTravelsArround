import { describe, expect, it } from "vitest";
import type { Contribution } from "@/lib/contributions";
import {
  buildMapBase,
  chunkCount,
  chunkOf,
  DETAIL_CHUNK_SIZE,
  detailChunk,
  photosFromBase,
  spatialOrder,
} from "@/lib/map-data";

// Fotos ficticias: dos en Madrid, dos en Oslo, intercaladas.
const foto = (id: string, lat: number, lng: number, extra: Partial<Contribution> = {}): Contribution => ({
  id,
  lat,
  lng,
  author: "testA",
  mapsUrl: `https://example.com/${id}`,
  ...extra,
});
const FOTOS = [
  foto("madrid1", 40.4168, -3.7038, { tripId: "testa-2020-01-01", imageUrl: "https://example.com/m1.jpg" }),
  foto("oslo1", 59.9139, 10.7522, { author: "motercode" }),
  foto("madrid2", 40.4169, -3.7037, { tripId: "testa-2020-01-01" }),
  foto("oslo2", 59.914, 10.7523, { author: "motercode" }),
];

describe("spatialOrder", () => {
  it("deja juntas las fotos cercanas", () => {
    const ids = spatialOrder(FOTOS).map((c) => c.id);
    expect(Math.abs(ids.indexOf("madrid1") - ids.indexOf("madrid2"))).toBe(1);
    expect(Math.abs(ids.indexOf("oslo1") - ids.indexOf("oslo2"))).toBe(1);
  });

  it("da el mismo orden sea cual sea el orden de entrada", () => {
    expect(spatialOrder([...FOTOS].reverse()).map((c) => c.id)).toEqual(spatialOrder(FOTOS).map((c) => c.id));
  });
});

describe("buildMapBase y photosFromBase", () => {
  it("compacta las fotos y se recuperan igual en el navegador", () => {
    const sorted = spatialOrder(FOTOS);
    const base = buildMapBase(sorted);
    expect(base.authors.sort()).toEqual(["motercode", "testA"]);
    expect(base.trips).toEqual(["testa-2020-01-01"]);
    const photos = photosFromBase(buildMapBase(sorted));
    expect(photos.map(({ lat, lng, author, tripId }) => ({ lat, lng, author, tripId }))).toEqual(
      sorted.map(({ lat, lng, author, tripId }) => ({ lat, lng, author, tripId })),
    );
    expect(photos.map((p) => p.index)).toEqual([0, 1, 2, 3]);
  });

  it("redondea las coordenadas a 5 decimales", () => {
    const [[lat, lng]] = buildMapBase([foto("x", 40.123456789, -3.987654321)]).photos;
    expect([lat, lng]).toEqual([40.12346, -3.98765]);
  });
});

describe("bloques de detalles", () => {
  it("reparte las fotos en bloques y cada índice sabe en cuál está", () => {
    expect(chunkCount(0)).toBe(0);
    expect(chunkCount(DETAIL_CHUNK_SIZE)).toBe(1);
    expect(chunkCount(DETAIL_CHUNK_SIZE + 1)).toBe(2);
    expect(chunkOf(DETAIL_CHUNK_SIZE - 1)).toBe(0);
    expect(chunkOf(DETAIL_CHUNK_SIZE)).toBe(1);
  });

  it("cada bloque lleva la URL y la miniatura en el orden de la base", () => {
    const sorted = spatialOrder(FOTOS);
    const chunk = detailChunk(sorted, 0);
    expect(chunk).toEqual(sorted.map((c) => [c.mapsUrl, c.imageUrl ?? null]));
  });
});
