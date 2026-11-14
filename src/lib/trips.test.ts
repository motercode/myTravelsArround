import { describe, expect, it } from "vitest";
import type { Contribution } from "@/lib/contributions";
import { buildTrips, formatTripDates, groupTripsByYear, tripsForPage } from "@/lib/trips";

// Fotos ficticias.
let n = 0;
const foto = (takenAt: string | undefined, author = "testA"): Contribution => ({
  id: `${author}:F${++n}`,
  lat: 0,
  lng: 0,
  author,
  mapsUrl: "https://example.com",
  ...(takenAt ? { takenAt } : {}),
});

describe("buildTrips", () => {
  it("agrupa los días con 2 días o menos sin fotos y empieza un viaje nuevo con 3", () => {
    const trips = buildTrips(["2020-09-29", "2020-09-30", "2020-10-02", "2020-10-06"].map((d) => foto(d)));
    expect(trips.map(({ startDay, endDay, days }) => ({ startDay, endDay, days: days.length }))).toEqual([
      { startDay: "2020-10-06", endDay: "2020-10-06", days: 1 },
      { startDay: "2020-09-29", endDay: "2020-10-02", days: 3 },
    ]);
  });

  it("1 oct y 4 oct van juntos; 1 oct y 5 oct, no", () => {
    expect(buildTrips([foto("2020-10-01"), foto("2020-10-04")])).toHaveLength(1);
    expect(buildTrips([foto("2020-10-01"), foto("2020-10-05")])).toHaveLength(2);
  });

  it("toma el día de los 10 primeros caracteres, sin zona horaria", () => {
    const [trip] = buildTrips([foto("2020-09-30T23:59:59")]);
    expect(trip.startDay).toBe("2020-09-30");
  });

  it("no cuenta el cambio de hora como un día más", () => {
    // 25 → 28 oct 2020 cruza el cambio de hora europeo: siguen siendo 2 días vacíos.
    expect(buildTrips([foto("2020-10-25"), foto("2020-10-28")])).toHaveLength(1);
  });

  it("deja fuera las fotos sin fecha", () => {
    const sinFecha = foto(undefined);
    const trips = buildTrips([sinFecha, foto("2020-01-01")]);
    expect(trips.flatMap((t) => t.photoIds)).not.toContain(sinFecha.id);
  });

  it("calcula los viajes por autor", () => {
    const trips = buildTrips([foto("2020-01-01", "testA"), foto("2020-01-02", "motercode")]);
    expect(trips.map((t) => t.author).sort()).toEqual(["motercode", "testA"]);
  });

  it("ordena las fotos por fecha y, con la misma, por id", () => {
    const a = foto("2020-01-01T10:00:00");
    const b = foto("2020-01-01");
    const c = foto("2020-01-01T09:00:00");
    expect(buildTrips([a, b, c])[0].photoIds).toEqual([b.id, c.id, a.id]);
  });

  it("da ids estables con el autor y el primer día", () => {
    const fotos = [foto("2020-01-01", "fernando gost"), foto("2020-01-02", "fernando gost")];
    expect(buildTrips(fotos)[0].id).toBe("fernando-gost-2020-01-01");
    expect(buildTrips([...fotos].reverse())[0].id).toBe("fernando-gost-2020-01-01");
  });
});

describe("groupTripsByYear", () => {
  it("agrupa por el año del primer día, del más reciente al más antiguo", () => {
    const trips = buildTrips(["2019-05-01", "2020-12-30", "2021-01-02"].map((d) => foto(d)));
    expect(groupTripsByYear(trips).map(({ year, trips }) => [year, trips.map((t) => t.startDay)])).toEqual([
      ["2020", ["2020-12-30"]],
      ["2019", ["2019-05-01"]],
    ]);
  });
});

describe("formatTripDates", () => {
  // Los nombres de los meses los pone Intl; se comprueba la forma y que el día no se mueve.
  it("un día solo", () => {
    expect(formatTripDates({ startDay: "2020-09-30", endDay: "2020-09-30" })).toMatch(/^30 \S+ 2020$/);
  });

  it("varios días del mismo mes", () => {
    expect(formatTripDates({ startDay: "2020-09-29", endDay: "2020-09-30" })).toMatch(/^29–30 \S+ 2020$/);
  });

  it("dos meses del mismo año", () => {
    expect(formatTripDates({ startDay: "2020-09-29", endDay: "2020-10-02" })).toMatch(/^29 \S+ – 2 \S+ 2020$/);
  });

  it("dos años", () => {
    expect(formatTripDates({ startDay: "2020-12-30", endDay: "2021-01-02" })).toMatch(/^30 \S+ 2020 – 2 \S+ 2021$/);
  });
});

describe("tripsForPage", () => {
  it("pone el viaje a cada foto con fecha, quita las fechas y resume los viajes", () => {
    const fotos = [foto("2020-01-01T10:00:00"), foto("2020-01-02"), foto(undefined)];
    const page = tripsForPage(fotos, buildTrips(fotos));
    expect(page.contributions.map((c) => c.tripId)).toEqual(["testa-2020-01-01", "testa-2020-01-01", undefined]);
    expect(page.contributions[0]).not.toHaveProperty("takenAt");
    expect(page.trips).toEqual([
      { id: "testa-2020-01-01", author: "testA", startDay: "2020-01-01", endDay: "2020-01-02", dayCount: 2, photoCount: 2 },
    ]);
  });
});
