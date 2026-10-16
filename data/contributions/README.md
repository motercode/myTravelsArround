# Datos de contribuciones

Copia aquí los `contribuciones.json` generados por `../contribExtraction`, uno por extracción
(p. ej. `motercode.json`, `fernando-gost.json`). Se leen todos al hacer `npm run build`:

- El autor se deduce del `userId` de la URL (`/maps/contrib/<userId>/`); los nombres están en `src/lib/contributions.ts` (`AUTHORS`).
- Las fotos repetidas entre ficheros se eliminan por su `photoId` (`!1s...`).
- Los items sin coordenadas o con `0,0` se ignoran.
