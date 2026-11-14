import { MapView } from "@/components/map/map-view";
import { loadContributions } from "@/lib/load-contributions";
import { buildTrips, tripsForPage } from "@/lib/trips";

// Los datos se leen de data/contributions/ (y data/admin/) al hacer el build: la página es
// estática y los viajes también se calculan aquí.
export const dynamic = "force-static";

export default function Home() {
  const contributions = loadContributions();
  const page = tripsForPage(contributions, buildTrips(contributions));
  return <MapView contributions={page.contributions} trips={page.trips} />;
}
