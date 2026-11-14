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
  await expect(page.getByText("testA: 2")).toBeVisible();

  await page.getByLabel("URL o id de una foto").fill("https://www.google.com/maps/contrib/999999999999999999999/photos/data=!1sFOTO1!2e10");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(page.getByText("1 foto seleccionada.")).toBeVisible();
  await page.getByLabel("Autor nuevo").selectOption("motercode");
  await page.getByRole("button", { name: "Asignar" }).click();

  await expect(page.getByText("1 foto asignada a motercode.")).toBeVisible();
  await expect(page.getByText("testA: 1")).toBeVisible();
  await expect(page.getByText("motercode: 2")).toBeVisible();
  expect(JSON.parse(fs.readFileSync(path.join(admin, "autores.json"), "utf8"))).toEqual({
    version: 1,
    photos: { "testA:FOTO1": "motercode" },
  });

  // Devolverla al autor de la URL deja el fichero sin entradas.
  await page.getByLabel("URL o id de una foto").fill("testA:FOTO1");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("button", { name: "Devolver al autor de la URL" }).click();
  await expect(page.getByText("testA: 2")).toBeVisible();
  expect(JSON.parse(fs.readFileSync(path.join(admin, "autores.json"), "utf8")).photos).toEqual({});
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
});
