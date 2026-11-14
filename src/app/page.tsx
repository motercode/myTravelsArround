import { MapView } from "@/components/map/map-view";
import { getSiteData } from "@/lib/site-data";

// La página es estática. Solo lleva los viajes (pocos); las fotos las pide el navegador a
// /datos/base.json y sus URL, por bloques, a /datos/detalles/<n> (#42).
export const dynamic = "force-static";

export default function Home() {
  return <MapView trips={getSiteData().trips} />;
}
