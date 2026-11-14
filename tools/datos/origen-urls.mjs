// Cuenta, por fichero de data/contributions/, de qué sitio vienen las URLs de las fotos (Maps,
// álbumes de Google Fotos u otros). Así se detectaron las 1277 fotos de álbum sin autor (#7):
// hay que pasarlo al añadir o revisar ficheros de datos.
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? path.join(import.meta.dirname, "..", "..", "data", "contributions");

function origen(url) {
  if (/google\.[^/]+\/maps\/contrib\/\d+\//.test(url)) return "maps";
  if (/^https:\/\/photos\.google\.com\/share\//.test(url)) return "album";
  return "otro";
}

let otros = 0;
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const { items = [] } = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const cuenta = { maps: 0, album: 0, otro: 0 };
  for (const item of items) cuenta[origen(item.url)]++;
  otros += cuenta.otro;
  console.log(`${file}: ${cuenta.maps} maps, ${cuenta.album} álbum, ${cuenta.otro} otro`);
}
// Un origen desconocido no rompe nada, pero hay que mirarlo antes de publicarlo (regla 2).
if (otros > 0) {
  console.error(`✗ ${otros} URL de origen desconocido: revisa que sean fotos públicas`);
  process.exit(1);
}
