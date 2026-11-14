import { expect, test, type Page } from "@playwright/test";

// Recorrido principal: abrir el mapa y filtrar por autor. No depende del número de fotos de
// data/contributions/ ni de servicios externos (teselas, Nominatim).

const fotosEnElMapa = /(\d+) fotos en el mapa/;

// El mapa solo se pinta en el cliente: cuando aparece su control de zoom, React ya ha hidratado
// el panel. Antes de eso, un clic en los checkboxes cambia el DOM pero no el estado.
async function esperarMapa(page: Page) {
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible({ timeout: 30_000 });
}

test("el mapa se abre con su panel una sola vez", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /my travels arround/i })).toHaveCount(1);
  await expect(page.getByRole("textbox")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Buscar" })).toHaveCount(1);
  await expect(page.getByText(fotosEnElMapa)).toHaveCount(1);
});

test("ocultar todos los autores deja el mapa sin fotos y volver a mostrarlos las recupera", async ({ page }) => {
  await page.goto("/");
  await esperarMapa(page);
  const contador = page.getByText(fotosEnElMapa);
  const autores = page.getByRole("checkbox");
  await expect(autores.first()).toBeVisible();

  const total = (await contador.textContent())?.match(fotosEnElMapa)?.[1];
  expect(Number(total)).toBeGreaterThan(0);

  for (const autor of await autores.all()) await autor.uncheck();
  await expect(contador).toHaveText(/^0 fotos en el mapa/);

  for (const autor of await autores.all()) await autor.check();
  await expect(contador).toHaveText(new RegExp(`^${total} fotos en el mapa`));
});

test("elegir un viaje deja en el mapa solo sus fotos y «Todas las fotos» las recupera", async ({ page }) => {
  await page.goto("/");
  await esperarMapa(page);
  const contador = page.getByText(fotosEnElMapa);
  const total = (await contador.textContent())?.match(fotosEnElMapa)?.[1];

  await page.getByRole("button", { name: /Viajes: todas las fotos/ }).click();
  const lista = page.locator("#lista-viajes");
  const anios = lista.locator("details");
  expect(await anios.count()).toBeGreaterThan(0);
  // Solo el año más reciente empieza abierto.
  await expect(anios.first()).toHaveAttribute("open", "");
  if ((await anios.count()) > 1) {
    await expect(anios.nth(1)).not.toHaveAttribute("open", "");
    await anios.nth(1).locator("summary").click();
    await expect(anios.nth(1)).toHaveAttribute("open", "");
  }

  const viaje = anios.first().getByRole("button").first();
  const fotosDelViaje = (await viaje.textContent())?.match(/(\d+) fotos?/)?.[1];
  await viaje.click();
  await expect(contador).toHaveText(new RegExp(`^${fotosDelViaje} fotos en el mapa`));
  await expect(page.getByRole("button", { name: /^Viaje: / })).toBeVisible();

  await page.getByRole("button", { name: /^Viaje: / }).click();
  await page.getByRole("button", { name: "Todas las fotos" }).click();
  await expect(contador).toHaveText(new RegExp(`^${total} fotos en el mapa`));
});

test("las fotos salen agrupadas y al pulsar un grupo el mapa se acerca", async ({ page }) => {
  await page.goto("/");
  await esperarMapa(page);
  const grupos = page.locator(".marker-cluster");
  await expect(grupos.first()).toBeVisible();

  // El zoom se lee de las teselas (…/{z}/{x}/{y}.png): no hace falta que carguen.
  const zoom = async () => Number((await page.locator(".leaflet-tile").last().getAttribute("src"))?.match(/\/(\d+)\/\d+\/\d+\.png/)?.[1]);
  const antes = await zoom();
  await grupos.first().click();
  await expect.poll(zoom, { timeout: 10_000 }).toBeGreaterThan(antes);
});

test("una foto suelta carga su miniatura al pasar el ratón y el clic la abre en Google", async ({ page }) => {
  await page.goto("/");
  await esperarMapa(page);
  // Un viaje pequeño encuadrado deja fotos sueltas, sin agrupar.
  await page.getByRole("button", { name: /Viajes: todas las fotos/ }).click();
  await page.locator("#lista-viajes details").first().getByRole("button").first().click();
  await page.waitForTimeout(1500);

  // Centro aproximado de un punto suelto: primer píxel azul del canvas del mapa.
  const punto = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".leaflet-overlay-pane canvas");
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const escala = r.width / canvas.width;
    const datos = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const i = (y * canvas.width + x) * 4;
        const px = r.left + x * escala;
        const py = r.top + y * escala;
        const libre = px > 360 && px < innerWidth - 20 && py > 20 && py < innerHeight - 20;
        if (libre && datos[i] < 80 && datos[i + 2] > 200 && datos[i + 3] > 200) return { x: px, y: py + 4 };
      }
    }
    return null;
  });
  expect(punto).not.toBeNull();
  await page.mouse.move(punto!.x, punto!.y);
  await expect(page.locator(".leaflet-tooltip img")).toBeVisible({ timeout: 10_000 });

  // El clic abre la foto en Google (Maps o el álbum de Fotos). Se corta la petición para no salir
  // a internet: basta con ver adónde va.
  await page.context().route(/google\.com/, (ruta) => ruta.abort());
  const peticion = page.context().waitForEvent("request", (r) => /google\.com\/(maps|share)|photos\.google\.com/.test(r.url()));
  await page.mouse.click(punto!.x, punto!.y);
  expect((await peticion).url()).toMatch(/^https:\/\/(www\.google\.com\/maps|photos\.google\.com\/share)\//);
});
