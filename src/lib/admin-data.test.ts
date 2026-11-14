import { describe, expect, it } from "vitest";
import {
  applyAuthorOverrides,
  authorsFileSchema,
  emptyAuthorsFile,
  serializeAuthorsFile,
  setAuthors,
  urlAuthorOf,
} from "@/lib/admin-data";
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
