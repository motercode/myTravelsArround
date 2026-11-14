import { describe, expect, it } from "vitest";
import { authorFromUrl, photoIdFromUrl, stableThumbnailUrl } from "@/lib/contributions";

// Identificadores ficticios: 999… es el autor de prueba (testA) de AUTHORS.
const URL_TEST_A = "https://www.google.com/maps/contrib/999999999999999999999/photos/data=!3m1!1sFOTO1!2e10";
// Álbum compartido de Google Fotos ficticio.
const URL_ALBUM = "https://photos.google.com/share/ALBUMFICTICIO/photo/FOTOALBUM1?key=CLAVEFICTICIA";

describe("authorFromUrl", () => {
  it("devuelve el nombre del autor conocido", () => {
    expect(authorFromUrl(URL_TEST_A)).toBe("testA");
  });

  it("devuelve el userId si el autor no está en AUTHORS", () => {
    expect(authorFromUrl("https://www.google.com/maps/contrib/111/photos")).toBe("111");
  });

  it("asigna a motercode las fotos cuya URL no dice el autor", () => {
    expect(authorFromUrl("https://example.com/foto")).toBe("motercode");
  });

  it("asigna a motercode las fotos de álbumes de Google Fotos", () => {
    expect(authorFromUrl(URL_ALBUM)).toBe("motercode");
  });
});

describe("photoIdFromUrl", () => {
  it("extrae el photoId del bloque !1s…!", () => {
    expect(photoIdFromUrl(URL_TEST_A)).toBe("FOTO1");
  });

  it("extrae el photoId de una foto de álbum de Google Fotos, sin la clave del álbum", () => {
    expect(photoIdFromUrl(URL_ALBUM)).toBe("FOTOALBUM1");
  });

  it("devuelve undefined si no hay photoId", () => {
    expect(photoIdFromUrl("https://example.com/foto")).toBeUndefined();
  });
});

describe("stableThumbnailUrl", () => {
  it("cambia el encuadre de panorama por una miniatura simple de Google", () => {
    expect(
      stableThumbnailUrl("https://lh3.googleusercontent.com/abc=w900-h600-k-no-pi-4.8-ya359.9-ro359.4-fo100"),
    ).toBe("https://lh3.googleusercontent.com/abc=w400-h240-p-k-no");
  });

  it("deja igual las imágenes que no son de Google", () => {
    expect(stableThumbnailUrl("https://example.com/foto.jpg")).toBe("https://example.com/foto.jpg");
  });
});
