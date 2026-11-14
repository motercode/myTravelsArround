import { describe, expect, it } from "vitest";
import { buildClusterIndex, CLUSTER_MAX_ZOOM, clusterBBox, clusterSize } from "@/lib/clusters";
import type { Contribution } from "@/lib/contributions";

// Fotos ficticias: tres en Madrid casi en el mismo sitio y una en Barcelona.
const foto = (id: string, lat: number, lng: number): Contribution => ({ id, lat, lng, author: "testA", mapsUrl: "https://example.com" });
const FOTOS = [foto("a", 40.4168, -3.7038), foto("b", 40.4169, -3.7037), foto("c", 40.417, -3.7036), foto("d", 41.3874, 2.1686)];
const MUNDO: [number, number, number, number] = [-180, -90, 180, 90];

describe("buildClusterIndex", () => {
  it("agrupa las fotos cercanas a poco zoom y cuenta cuántas hay", () => {
    const grupos = buildClusterIndex(FOTOS).getClusters(MUNDO, 5);
    const madrid = grupos.find((g) => "cluster" in g.properties);
    expect(madrid?.properties).toMatchObject({ cluster: true, point_count: 3 });
    expect(grupos).toHaveLength(2);
  });

  it("por encima del zoom máximo de agrupación enseña todas las fotos sueltas", () => {
    const sueltas = buildClusterIndex(FOTOS).getClusters(MUNDO, CLUSTER_MAX_ZOOM + 1);
    expect(sueltas.map((p) => FOTOS[(p.properties as { index: number }).index].id).sort()).toEqual(["a", "b", "c", "d"]);
  });
});

describe("clusterSize", () => {
  it("crece con el número de fotos, pero despacio", () => {
    expect(clusterSize(2)).toBe(30);
    expect(clusterSize(100)).toBe(44);
    expect(clusterSize(10_000)).toBe(60);
  });
});

describe("clusterBBox", () => {
  it("deja igual una caja normal", () => {
    expect(clusterBBox(-10, 35, 5, 45)).toEqual([-10, 35, 5, 45]);
  });

  it("devuelve las longitudes a ±180 al dar la vuelta al mundo", () => {
    expect(clusterBBox(350, 35, 365, 45)).toEqual([-10, 35, 5, 45]);
  });

  it("con más de una vuelta de ancho, todo el mundo", () => {
    expect(clusterBBox(-300, -95, 300, 95)).toEqual([-180, -90, 180, 90]);
  });
});
