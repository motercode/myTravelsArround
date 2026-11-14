import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Panel de administración local (tools/admin/) sobre fotos ficticias y un repositorio git
// temporal: no lee ni escribe data/. Las teselas del mapa no hacen falta.

const PUERTO = 3041;
const URL_PANEL = `http://localhost:${PUERTO}`;
const DATOS = path.join(import.meta.dirname, "fixtures", "panel");

let repo: string;
let admin: string;
let panel: ChildProcess;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "panel-admin-"));
  execFileSync("git", ["init", "-q", "-b", "prueba", repo]);
  admin = path.join(repo, "data", "admin");
  panel = spawn("node", ["tools/admin/server.ts", "--datos", DATOS, "--admin", admin, "--puerto", String(PUERTO)], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise<void>((listo, fallo) => {
    panel.stdout!.on("data", (trozo) => String(trozo).includes("panel en") && listo());
    panel.on("exit", (codigo) => fallo(new Error(`el panel ha terminado con código ${codigo}`)));
  });
});

test.afterAll(() => {
  panel?.kill();
  fs.rmSync(repo, { recursive: true, force: true });
});

test("reasignar una foto escribe data/admin/autores.json y cambia los recuentos", async ({ page }) => {
  await page.goto(URL_PANEL);
  await expect(page.getByText("rama prueba")).toBeVisible();
  await expect(page.getByText("testA: 3")).toBeVisible();

  await page.getByLabel("URL o id de una foto").fill("https://www.google.com/maps/contrib/999999999999999999999/photos/data=!1sFOTO1!2e10");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(page.getByText("1 foto seleccionada.")).toBeVisible();
  await page.getByLabel("Autor nuevo").selectOption("motercode");
  await page.getByRole("button", { name: "Asignar" }).click();

  await expect(page.getByText("1 foto asignada a motercode.")).toBeVisible();
  await expect(page.getByText("testA: 2")).toBeVisible();
  await expect(page.getByText("motercode: 2")).toBeVisible();
  expect(JSON.parse(fs.readFileSync(path.join(admin, "autores.json"), "utf8"))).toEqual({
    version: 1,
    photos: { "testA:FOTO1": "motercode" },
  });

  // Devolverla al autor de la URL deja el fichero sin entradas.
  await page.getByLabel("URL o id de una foto").fill("testA:FOTO1");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("button", { name: "Devolver al autor de la URL" }).click();
  await expect(page.getByText("testA: 3")).toBeVisible();
  expect(JSON.parse(fs.readFileSync(path.join(admin, "autores.json"), "utf8")).photos).toEqual({});
});

const leerViajes = () => JSON.parse(fs.readFileSync(path.join(admin, "viajes.json"), "utf8"));

test("viajes: poner nombre, separar con PRE-/POST-, unir y quitar el nombre", async ({ page }) => {
  await page.goto(URL_PANEL);
  await page.getByRole("button", { name: "Viajes", exact: true }).click();
  const lista = page.locator("#lista-viajes");
  // testA: 1-2 de mayo y 20 de mayo (más de 2 días sin fotos entre medias).
  await expect(lista.getByText("2024-05-01 → 2024-05-02")).toBeVisible();
  await expect(lista.getByText("2024-05-20", { exact: true })).toBeVisible();

  await lista.getByText("2024-05-01 → 2024-05-02").click();
  await page.getByLabel("Nombre del viaje").fill("Pirineos");
  await page.getByRole("button", { name: "Guardar el nombre" }).click();
  await expect(page.getByText("Nombre guardado: Pirineos.")).toBeVisible();
  expect(leerViajes().names).toEqual([{ author: "testA", at: "2024-05-01T10:00:00", name: "Pirineos" }]);

  // Separar entre las dos fotos: las partes se llaman PRE- y POST-.
  await page.getByLabel("Fecha y hora del corte").fill("2024-05-02 12:00");
  await page.getByRole("button", { name: "Separar aquí" }).click();
  await expect(lista.getByText("PRE-Pirineos (2024-05-01)")).toBeVisible();
  await expect(lista.getByText("POST-Pirineos (2024-05-02)")).toBeVisible();
  expect(leerViajes().operations).toEqual([{ type: "split", author: "testA", at: "2024-05-02T12:00:00" }]);

  // Un corte fuera del viaje no se guarda.
  await lista.getByText("PRE-Pirineos (2024-05-01)").click();
  await page.getByLabel("Fecha y hora del corte").fill("2024-06-01 12:00");
  await page.getByRole("button", { name: "Separar aquí" }).click();
  await expect(page.getByText(/El corte tiene que dejar fotos/)).toBeVisible();

  // Unir PRE- con el del 20 de mayo (no seguidos): se queda el nombre del más antiguo.
  await page.getByLabel(/^Marcar PRE-Pirineos/).check();
  await page.getByLabel(/^Marcar 2024-05-20/).check();
  await page.getByRole("button", { name: "Unir los dos marcados" }).click();
  await expect(page.getByText("Viajes unidos.")).toBeVisible();
  await expect(lista.getByText("PRE-Pirineos (2024-05-01 → 2024-05-20)")).toBeVisible();
  await expect(lista.getByText("POST-Pirineos (2024-05-02)")).toBeVisible();
  expect(leerViajes().operations[1]).toEqual({ type: "merge", author: "testA", trips: ["2024-05-01T10:00:00", "2024-05-20T09:00:00"] });

  await page.getByLabel("Nombre del viaje").fill("");
  await page.getByRole("button", { name: "Guardar el nombre" }).click();
  await expect(page.getByText("Nombre quitado.")).toBeVisible();
  await expect(lista.getByText("2024-05-01 → 2024-05-20", { exact: true })).toBeVisible();
});

test("ajustes: cambiar los días sin fotos dentro de un viaje", async ({ page }) => {
  await page.goto(URL_PANEL);
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await expect(page.getByLabel("Días sin fotos que caben dentro de un viaje")).toHaveValue("2");
  await page.getByLabel("Días sin fotos que caben dentro de un viaje").fill("30");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText(/Guardado: 30 días/)).toBeVisible();
  expect(JSON.parse(fs.readFileSync(path.join(admin, "ajustes.json"), "utf8"))).toEqual({ version: 1, maxEmptyDaysInTrip: 30 });
});

test("en la rama main el panel no guarda", async ({ page, request }) => {
  execFileSync("git", ["-C", repo, "symbolic-ref", "HEAD", "refs/heads/main"]);
  await page.goto(URL_PANEL);
  await expect(page.getByText(/Estás en main: no se guarda nada/)).toBeVisible();
  await page.getByLabel("URL o id de una foto").fill("testA:FOTO2");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(page.getByRole("button", { name: "Asignar" })).toBeDisabled();

  // Tampoco llamando a la API directamente.
  const respuesta = await request.post(`${URL_PANEL}/api/autores`, { data: { ids: ["testA:FOTO2"], autor: "motercode" } });
  expect(respuesta.status()).toBe(409);
  expect(JSON.parse(fs.readFileSync(path.join(admin, "autores.json"), "utf8")).photos).toEqual({});
  for (const [ruta, datos] of [
    ["/api/viajes/nombre", { id: "testa-2024-05-01", nombre: "X" }],
    ["/api/ajustes", { maxEmptyDaysInTrip: 5 }],
  ] as const) {
    expect((await request.post(`${URL_PANEL}${ruta}`, { data: datos })).status()).toBe(409);
  }
  for (const [ruta, datos] of [
    ["/api/viajes/nombre", { id: "testa-2024-05-01", nombre: "X" }],
    ["/api/ajustes", { maxEmptyDaysInTrip: 5 }],
  ] as const) {
    expect((await request.post(`${URL_PANEL}${ruta}`, { data: datos })).status()).toBe(409);
  }
});
