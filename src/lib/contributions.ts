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

// Identificador de la foto en Maps: bloque `!1s<photoId>!` de la URL.
export function photoIdFromUrl(url: string): string | undefined {
  return url.match(/!1s([^!]+)/)?.[1];
}
