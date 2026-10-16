import { MapView } from "@/components/map/map-view";
import { loadContributions } from "@/lib/load-contributions";

// Los datos se leen de data/contributions/ al hacer el build: la página es estática.
export const dynamic = "force-static";

export default function Home() {
  return <MapView contributions={loadContributions()} />;
}
