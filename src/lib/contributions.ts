// Tipos y utilidades compartidas (cliente y servidor) para las contribuciones.

// userId de Google Maps (/maps/contrib/<userId>/...) -> nombre a mostrar.
export const AUTHORS: Record<string, string> = {
  "102214896434264755474": "motercode",
  "102784682183746369499": "fernando gost",
};

export type Contribution = {
  id: string;
  lat: number;
  lng: number;
  author: string;
  mapsUrl: string;
  imageUrl?: string;
};

export function authorFromUrl(url: string): string {
  const userId = url.match(/\/maps\/contrib\/(\d+)/)?.[1];
  if (!userId) return "desconocido";
  return AUTHORS[userId] ?? userId;
}

// Miniatura que Google sirve siempre. Las URLs de la galería traen encuadre de panorama
// (`-pi0.29-ya264.8-ro5.9-fo100`): ese recorte del 360° se genera al vuelo y, si no está en
// caché, Google responde 429 y el navegador bloquea la imagen (ORB). Un tamaño simple con
// recorte centrado (`-p`) no tiene ese problema; 400x240 cubre la miniatura en pantallas 2x.
export function stableThumbnailUrl(imageUrl: string): string {
  const base = imageUrl.split("=")[0];
  return /googleusercontent\.com/i.test(base) ? `${base}=w400-h240-p-k-no` : imageUrl;
}

// Identificador de la foto en Maps: bloque `!1s<photoId>!` de la URL.
export function photoIdFromUrl(url: string): string | undefined {
  return url.match(/!1s([^!]+)/)?.[1];
}
