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
