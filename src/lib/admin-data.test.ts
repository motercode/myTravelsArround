import { describe, expect, it } from "vitest";
import {
  applyAuthorOverrides,
  authorsFileSchema,
  emptyAuthorsFile,
  emptyTripsFile,
  mergeTrips,
  nameTrip,
  serializeAuthorsFile,
  setAuthors,
  settingsFileSchema,
  splitTrip,
  tripsFileSchema,
  urlAuthorOf,
} from "@/lib/admin-data";
import { buildTripsWithRules } from "@/lib/trips";
import type { Contribution } from "@/lib/contributions";

// Fotos ficticias: testA y motercode están en AUTHORS.
const foto = (id: string): Contribution => ({ id, lat: 1, lng: 2, author: urlAuthorOf(id), mapsUrl: "https://example.com" });
const FOTOS = [foto("testA:F1"), foto("testA:F2"), foto("motercode:ALBUM1")];

describe("urlAuthorOf", () => {
  it("saca el autor de la URL del id", () => {
    expect(urlAuthorOf("fernando gost:CIHM0og")).toBe("fernando gost");
  });
});

describe("applyAuthorOverrides", () => {
  it("cambia el autor de las fotos listadas sin cambiar su id ni tocar las demás", () => {
    const { contributions } = applyAuthorOverrides(FOTOS, { version: 1, photos: { "testA:F1": "motercode" } });
    expect(contributions[0]).toMatchObject({ id: "testA:F1", author: "motercode" });
    expect(contributions[1].author).toBe("testA");
    expect(FOTOS[0].author).toBe("testA");
  });

  it("devuelve los ids que ya no existen como huérfanos", () => {
    const { orphanIds } = applyAuthorOverrides(FOTOS, { version: 1, photos: { "testA:NOEXISTE": "motercode" } });
    expect(orphanIds).toEqual(["testA:NOEXISTE"]);
  });
});

describe("setAuthors", () => {
  it("asigna el autor a varias fotos", () => {
    const file = setAuthors(emptyAuthorsFile(), ["testA:F1", "testA:F2"], "motercode");
    expect(file.photos).toEqual({ "testA:F1": "motercode", "testA:F2": "motercode" });
  });

  it("con null o con el autor de la URL quita la reasignación", () => {
    const file = setAuthors(emptyAuthorsFile(), ["testA:F1", "testA:F2"], "motercode");
    expect(setAuthors(file, ["testA:F1"], null).photos).toEqual({ "testA:F2": "motercode" });
    expect(setAuthors(file, ["testA:F2"], "testA").photos).toEqual({ "testA:F1": "motercode" });
  });

  it("no admite un autor que no está en AUTHORS", () => {
    expect(() => setAuthors(emptyAuthorsFile(), ["testA:F1"], "nadie")).toThrow(/nadie/);
  });
});

describe("autores.json", () => {
  it("se serializa con las claves ordenadas y formato fijo", () => {
    const file = setAuthors(emptyAuthorsFile(), ["testA:F2", "testA:F1"], "motercode");
    expect(serializeAuthorsFile(file)).toBe(
      '{\n  "version": 1,\n  "photos": {\n    "testA:F1": "motercode",\n    "testA:F2": "motercode"\n  }\n}\n',
    );
  });

  it("rechaza versiones desconocidas y autores que no están en AUTHORS", () => {
    expect(authorsFileSchema.safeParse({ version: 2, photos: {} }).success).toBe(false);
    expect(authorsFileSchema.safeParse({ version: 1, photos: { "testA:F1": "nadie" } }).success).toBe(false);
  });
});

describe("viajes.json y ajustes.json", () => {
  it("valida el formato", () => {
    const bueno = {
      version: 1,
      operations: [
        { type: "merge", author: "testA", trips: ["2020-01-01", "2020-01-10T10:00:00"] },
        { type: "split", author: "testA", at: "2020-01-01T12:00:00" },
      ],
      names: [{ author: "testA", at: "2020-01-01", name: "Viaje" }],
    };
    expect(tripsFileSchema.safeParse(bueno).success).toBe(true);
    // Un corte sin hora, un autor desconocido o un nombre vacío no valen.
    expect(tripsFileSchema.safeParse({ ...bueno, operations: [{ type: "split", author: "testA", at: "2020-01-01" }] }).success).toBe(false);
    expect(tripsFileSchema.safeParse({ ...bueno, names: [{ author: "nadie", at: "2020-01-01", name: "X" }] }).success).toBe(false);
    expect(tripsFileSchema.safeParse({ ...bueno, names: [{ author: "testA", at: "2020-01-01", name: " " }] }).success).toBe(false);
    expect(settingsFileSchema.safeParse({ version: 1, maxEmptyDaysInTrip: 2 }).success).toBe(true);
    expect(settingsFileSchema.safeParse({ version: 1, maxEmptyDaysInTrip: -1 }).success).toBe(false);
    expect(settingsFileSchema.safeParse({ version: 1, maxEmptyDaysInTrip: 1.5 }).success).toBe(false);
  });
});

describe("acciones del panel sobre los viajes", () => {
  let n = 0;
  const conFecha = (takenAt: string, author = "testA"): Contribution => ({ ...foto(`${author}:V${++n}`), takenAt });
  // testA: 1-2 ene y 20 ene; motercode: 5 ene.
  const fotos = [
    conFecha("2020-01-01T09:00:00"),
    conFecha("2020-01-02T18:00:00"),
    conFecha("2020-01-20T10:00:00"),
    conFecha("2020-01-05T10:00:00", "motercode"),
  ];
  const viajes = (reglas = emptyTripsFile()) => buildTripsWithRules(fotos, reglas, 2).trips;

  it("pone y quita el nombre de un viaje", () => {
    const conNombre = nameTrip(fotos, emptyTripsFile(), 2, "testa-2020-01-01", "  Pirineos ");
    expect(conNombre.names).toEqual([{ author: "testA", at: "2020-01-01T09:00:00", name: "Pirineos" }]);
    const otro = nameTrip(fotos, conNombre, 2, "testa-2020-01-01", "Otro");
    expect(otro.names).toEqual([{ author: "testA", at: "2020-01-01T09:00:00", name: "Otro" }]);
    expect(nameTrip(fotos, otro, 2, "testa-2020-01-01", "").names).toEqual([]);
    expect(() => nameTrip(fotos, otro, 2, "no-existe", "X")).toThrow(/no-existe/);
  });

  it("une dos viajes del mismo autor y se queda el nombre del más antiguo", () => {
    let reglas = nameTrip(fotos, emptyTripsFile(), 2, "testa-2020-01-20", "Nuevo");
    reglas = nameTrip(fotos, reglas, 2, "testa-2020-01-01", "Antiguo");
    reglas = mergeTrips(fotos, reglas, 2, ["testa-2020-01-20", "testa-2020-01-01"]);
    expect(reglas.operations).toEqual([{ type: "merge", author: "testA", trips: ["2020-01-20T10:00:00", "2020-01-01T09:00:00"] }]);
    const unido = viajes(reglas).find((t) => t.author === "testA");
    expect(unido).toMatchObject({ startDay: "2020-01-01", endDay: "2020-01-20", name: "Antiguo" });
    // Si solo uno tiene nombre, se queda ese.
    const soloNuevo = mergeTrips(fotos, nameTrip(fotos, emptyTripsFile(), 2, "testa-2020-01-20", "Nuevo"), 2, [
      "testa-2020-01-01",
      "testa-2020-01-20",
    ]);
    expect(viajes(soloNuevo).find((t) => t.author === "testA")?.name).toBe("Nuevo");
  });

  it("no une viajes de autores distintos ni un viaje consigo mismo", () => {
    expect(() => mergeTrips(fotos, emptyTripsFile(), 2, ["testa-2020-01-01", "motercode-2020-01-05"])).toThrow(/mismo autor/);
    expect(() => mergeTrips(fotos, emptyTripsFile(), 2, ["testa-2020-01-01", "testa-2020-01-01"])).toThrow(/distintos/);
  });

  it("separa un viaje y, si tenía nombre, las partes llevan PRE- y POST-", () => {
    const conNombre = nameTrip(fotos, emptyTripsFile(), 2, "testa-2020-01-01", "Pirineos");
    const reglas = splitTrip(fotos, conNombre, 2, "testa-2020-01-01", "2020-01-02T12:00:00");
    expect(reglas.operations).toEqual([{ type: "split", author: "testA", at: "2020-01-02T12:00:00" }]);
    expect(viajes(reglas).filter((t) => t.author === "testA").map((t) => t.name)).toEqual([undefined, "POST-Pirineos", "PRE-Pirineos"]);
    // Sin nombre, solo el corte.
    expect(splitTrip(fotos, emptyTripsFile(), 2, "testa-2020-01-01", "2020-01-02T12:00:00").names).toEqual([]);
  });

  it("no separa sin hora ni con un corte que deja un lado vacío", () => {
    expect(() => splitTrip(fotos, emptyTripsFile(), 2, "testa-2020-01-01", "2020-01-02")).toThrow(/hora/);
    expect(() => splitTrip(fotos, emptyTripsFile(), 2, "testa-2020-01-01", "2020-01-03T12:00:00")).toThrow(/dos lados/);
  });

  it("no separa un viaje con un corte que iría a otro que se solapa", () => {
    // 1-20 ene unido abarca al de en medio (10 ene); cortar ese el 10 por la tarde caería en el unido.
    const conMedio = [...fotos, conFecha("2020-01-10T09:00:00"), conFecha("2020-01-10T20:00:00")];
    const unidos = mergeTrips(conMedio, emptyTripsFile(), 2, ["testa-2020-01-01", "testa-2020-01-20"]);
    expect(() => splitTrip(conMedio, unidos, 2, "testa-2020-01-10", "2020-01-10T12:00:00")).toThrow(/solapa/);
  });
});
