import { describe, expect, it } from "vitest";
import type { Contribution } from "@/lib/contributions";
import { buildTrips, buildTripsWithRules, formatTripDates, groupTripsByYear, tripsForPage, type TripRules } from "@/lib/trips";

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

describe("buildTripsWithRules", () => {
  // Tres viajes de testA: 1-2 ene, 10-11 ene y 20 ene.
  const fotos = () => [
    foto("2020-01-01T09:00:00"),
    foto("2020-01-01T18:00:00"),
    foto("2020-01-02"),
    foto("2020-01-10T10:00:00"),
    foto("2020-01-11T10:00:00"),
    foto("2020-01-20T10:00:00"),
  ];
  const reglas = (r: Partial<TripRules>): TripRules => ({ operations: [], names: [], ...r });
  const rangos = (trips: { startDay: string; endDay: string }[]) => trips.map((t) => `${t.startDay}/${t.endDay}`).reverse();

  it("une solo los dos viajes elegidos, aunque no sean seguidos", () => {
    const { trips } = buildTripsWithRules(
      fotos(),
      reglas({ operations: [{ type: "merge", author: "testA", trips: ["2020-01-01T09:00:00", "2020-01-20"] }] }),
    );
    expect(rangos(trips)).toEqual(["2020-01-01/2020-01-20", "2020-01-10/2020-01-11"]);
    expect(trips.find((t) => t.startDay === "2020-01-01")?.days).toEqual(["2020-01-01", "2020-01-02", "2020-01-20"]);
  });

  it("separa un viaje por la fecha y hora del corte", () => {
    const { trips } = buildTripsWithRules(fotos(), reglas({ operations: [{ type: "split", author: "testA", at: "2020-01-01T12:00:00" }] }));
    expect(rangos(trips)).toEqual(["2020-01-01/2020-01-01", "2020-01-01/2020-01-02", "2020-01-10/2020-01-11", "2020-01-20/2020-01-20"]);
    // Dos viajes que empiezan el mismo día: el segundo lleva «-2».
    expect(trips.filter((t) => t.startDay === "2020-01-01").map((t) => t.id).sort()).toEqual(["testa-2020-01-01", "testa-2020-01-01-2"]);
  });

  it("las fotos con solo el día del corte van al lado con más horas de ese día", () => {
    // Corte el 2 a las 13:00: la foto del día 2 sin hora va al viaje anterior.
    const tarde = buildTripsWithRules(
      [...fotos(), foto("2020-01-02T20:00:00")],
      reglas({ operations: [{ type: "split", author: "testA", at: "2020-01-02T13:00:00" }] }),
    );
    expect(rangos(tarde.trips).slice(0, 2)).toEqual(["2020-01-01/2020-01-02", "2020-01-02/2020-01-02"]);
    expect(tarde.trips.find((t) => t.id === "testa-2020-01-02")?.photoIds).toHaveLength(1);
    // Corte el 2 a las 08:00: va al posterior.
    const pronto = buildTripsWithRules(fotos(), reglas({ operations: [{ type: "split", author: "testA", at: "2020-01-02T08:00:00" }] }));
    expect(rangos(pronto.trips).slice(0, 2)).toEqual(["2020-01-01/2020-01-01", "2020-01-02/2020-01-02"]);
  });

  it("aplica las operaciones en el orden en que se hicieron", () => {
    // Unir 1-2 ene con 10-11 ene y después separar el viaje unido el 5.
    const { trips } = buildTripsWithRules(
      fotos(),
      reglas({
        operations: [
          { type: "merge", author: "testA", trips: ["2020-01-01", "2020-01-10"] },
          { type: "split", author: "testA", at: "2020-01-05T00:00:00" },
        ],
      }),
    );
    expect(rangos(trips)).toEqual(["2020-01-01/2020-01-02", "2020-01-10/2020-01-11", "2020-01-20/2020-01-20"]);
  });

  it("pone los nombres y, si dos caen en el mismo viaje, gana el más antiguo", () => {
    const { trips } = buildTripsWithRules(
      fotos(),
      reglas({
        operations: [{ type: "merge", author: "testA", trips: ["2020-01-01", "2020-01-10"] }],
        names: [
          { author: "testA", at: "2020-01-10T10:00:00", name: "Segundo" },
          { author: "testA", at: "2020-01-01T09:00:00", name: "Primero" },
          { author: "testA", at: "2020-01-20", name: "Tercero" },
        ],
      }),
    );
    expect(trips.map((t) => t.name).reverse()).toEqual(["Primero", "Tercero"]);
  });

  it("devuelve las reglas que ya no caen en ningún viaje", () => {
    const { orphanOperations, orphanNames } = buildTripsWithRules(
      fotos(),
      reglas({
        operations: [
          { type: "split", author: "testA", at: "2020-01-05T00:00:00" }, // entre dos viajes
          { type: "merge", author: "testA", trips: ["2020-01-01", "2020-01-02"] }, // el mismo viaje
          { type: "split", author: "testA", at: "2020-01-01T08:00:00" }, // antes de todas sus fotos
        ],
        names: [{ author: "otro", at: "2020-01-01", name: "Nadie" }],
      }),
    );
    expect(orphanOperations).toEqual([0, 1, 2]);
    expect(orphanNames).toEqual([0]);
  });

  it("al unir viajes no seguidos, las reglas ancladas en una foto siguen en su viaje", () => {
    // El unido (1-20 ene) abarca en fechas al del 10-11; el nombre de la foto del 10 sigue en este.
    const { trips, nameTrips } = buildTripsWithRules(
      fotos(),
      reglas({
        operations: [{ type: "merge", author: "testA", trips: ["2020-01-01T09:00:00", "2020-01-20T10:00:00"] }],
        names: [{ author: "testA", at: "2020-01-10T10:00:00", name: "En medio" }],
      }),
    );
    expect(trips.find((t) => t.startDay === "2020-01-10")?.name).toBe("En medio");
    expect(nameTrips).toEqual(["testa-2020-01-10"]);
  });
});
