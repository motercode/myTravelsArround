import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadContributions } from "@/lib/load-contributions";

// Fixtures ficticios: los datos reales de data/contributions/ no se usan en los tests.
const FIXTURES = path.join(__dirname, "__fixtures__");

describe("loadContributions", () => {
  const contributions = loadContributions(path.join(FIXTURES, "validos"));
  const porId = (id: string) => contributions.find((c) => c.id === id);

  it("descarta los items sin coordenadas, en 0,0 o fuera de rango", () => {
    expect(contributions.map((c) => c.id).sort()).toEqual(["111111111111111111111:FOTO1", "motercode:FOTOALBUM1", "testA:FOTO1", "testA:FOTO2"]);
  });

  it("elimina la misma foto repetida entre ficheros y se queda con la última", () => {
    expect(porId("testA:FOTO1")).toMatchObject({ lat: 41.4, lng: 2.2, author: "testA" });
  });

  it("no mezcla fotos con el mismo photoId de autores distintos", () => {
    expect(porId("111111111111111111111:FOTO1")).toMatchObject({ author: "111111111111111111111", lat: 37.4, lng: -5.9 });
  });

  it("las fotos de álbum son de motercode, se deduplican por su photoId y abren el álbum", () => {
    expect(porId("motercode:FOTOALBUM1")).toMatchObject({
      author: "motercode",
      lat: 46.9,
      lng: 11.9,
      mapsUrl: "https://photos.google.com/share/ALBUMFICTICIO/photo/FOTOALBUM1?key=CLAVEFICTICIA",
      imageUrl: "https://lh3.googleusercontent.com/pw/FICTICIA3=w400-h240-p-k-no",
    });
  });

  it("usa la URL canónica y la miniatura estable si existen", () => {
    expect(porId("testA:FOTO2")).toMatchObject({
      mapsUrl: "https://maps.example/foto2",
      imageUrl: "https://lh3.googleusercontent.com/gpms-cs-s/FICTICIA2=w400-h240-p-k-no",
    });
  });

  it("sin URL canónica usa la URL original", () => {
    expect(porId("111111111111111111111:FOTO1")?.mapsUrl).toContain("/maps/contrib/111111111111111111111/");
  });

  it("devuelve una lista vacía si no existe el directorio", () => {
    expect(loadContributions(path.join(FIXTURES, "no-existe"))).toEqual([]);
  });

  it("falla con el nombre del fichero si el formato no es válido", () => {
    expect(() => loadContributions(path.join(FIXTURES, "invalidos"))).toThrow(/roto\.json/);
  });
});
