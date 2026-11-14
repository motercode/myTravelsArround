# Datos de contribuciones

Copia aquí los `contribuciones.json` generados por `../contribExtraction`, uno por extracción
(p. ej. `motercode.json`, `fernando-gost.json`). Se leen todos al hacer `npm run build`:

- Solo fotos **públicas**: contribuciones de Google Maps o fotos de álbumes de Google Fotos compartidos públicamente.
- El autor se deduce del `userId` de la URL (`/maps/contrib/<userId>/`); los nombres están en `src/lib/contributions.ts` (`AUTHORS`). Las fotos de álbum (`photos.google.com/share/…`) no llevan autor en la URL y cuentan como de motercode.
- Las fotos repetidas entre ficheros se eliminan por su `photoId` (`!1s...` en Maps, `/photo/<id>` en álbumes).
- Los items sin coordenadas o con `0,0` se ignoran.

**Al añadir o revisar un fichero**, ejecuta `npm run datos:origen` y mira de qué sitio vienen las
URLs (Maps, álbum u otro). Un origen nuevo puede traer fotos sin autor o que no deban publicarse;
así se detectaron las 1277 fotos de álbum de #7.
