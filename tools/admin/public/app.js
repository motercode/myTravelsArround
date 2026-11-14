// Página del panel de administración local. Sin dependencias aparte de Leaflet (window.L).
const L = window.L;
const COLORES = ["#1f6feb", "#d1495b", "#2a9d8f", "#e9a23b", "#6a4c93", "#5b6576"];
const $ = (id) => document.getElementById(id);

let estado = null;
const fotos = new Map(); // id → { id, lat, lng, autor, url, miniatura, marcador }
const seleccion = new Set();
const colorDe = new Map();

const mapa = L.map("mapa", { preferCanvas: true }).setView([40.4, -3.7], 5);
const capas = {
  Iconográfica: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }),
  Satélite: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Imágenes © Esri" },
  ),
};
capas["Iconográfica"].addTo(mapa);
L.control.layers(capas).addTo(mapa);

const autorDeUrl = (id) => id.slice(0, id.indexOf(":"));
const albumDe = (url) => url.match(/photos\.google\.com\/share\/([^/]+)\//)?.[1] ?? null;
const imagenGrande = (miniatura) =>
  miniatura && /googleusercontent\.com/.test(miniatura) ? `${miniatura.split("=")[0]}=w800-h600-k-no` : miniatura;

function estilo(foto) {
  const seleccionada = seleccion.has(foto.id);
  const reasignada = estado.reasignadas[foto.id] !== undefined;
  return {
    radius: seleccionada ? 7 : 4,
    color: seleccionada ? "#000" : reasignada ? "#000" : colorDe.get(foto.autor),
    weight: seleccionada ? 3 : reasignada ? 2 : 1,
    fillColor: colorDe.get(foto.autor),
    fillOpacity: 0.8,
  };
}

function popup(foto) {
  const div = document.createElement("div");
  div.className = "popup";
  const img = imagenGrande(foto.miniatura);
  if (img) {
    const imagen = document.createElement("img");
    imagen.src = img;
    imagen.alt = "Foto";
    div.append(imagen);
  }
  const autorUrl = autorDeUrl(foto.id);
  const texto = document.createElement("div");
  texto.textContent = foto.autor === autorUrl ? `Autor: ${foto.autor}` : `Autor: ${foto.autor} (en la URL: ${autorUrl})`;
  const id = document.createElement("div");
  id.className = "id";
  id.textContent = foto.id;
  const enlace = document.createElement("a");
  enlace.href = foto.url;
  enlace.target = "_blank";
  enlace.rel = "noopener";
  enlace.textContent = "Abrir el original";
  const fila = document.createElement("div");
  fila.className = "fila";
  const alternar = boton(seleccion.has(foto.id) ? "Quitar de la selección" : "Añadir a la selección", () => {
    alternarSeleccion([foto.id]);
    mapa.closePopup();
  });
  fila.append(alternar);
  const album = albumDe(foto.url);
  if (album) {
    const delAlbum = [...fotos.values()].filter((f) => albumDe(f.url) === album).map((f) => f.id);
    fila.append(
      boton(`Seleccionar su álbum (${delAlbum.length})`, () => {
        anadir(delAlbum);
        mapa.closePopup();
      }),
    );
  }
  div.append(texto, id, enlace, fila);
  return div;
}

function boton(texto, alPulsar) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "accion";
  b.textContent = texto;
  b.addEventListener("click", alPulsar);
  return b;
}

function cargar(nuevo) {
  const primeraVez = estado === null;
  estado = nuevo;
  estado.autores.forEach((a, i) => colorDe.set(a, COLORES[i % COLORES.length]));
  for (const [id, lat, lng, autor, url, miniatura] of estado.fotos) {
    const existente = fotos.get(id);
    if (existente) {
      existente.autor = autor;
      continue;
    }
    const foto = { id, lat, lng, autor, url, miniatura };
    foto.marcador = L.circleMarker([lat, lng], estilo(foto)).addTo(mapa);
    foto.marcador.on("click", (e) => {
      if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) alternarSeleccion([id]);
      else foto.marcador.bindPopup(() => popup(foto), { maxWidth: 360 }).openPopup();
    });
    fotos.set(id, foto);
  }
  if (primeraVez && fotos.size > 0) {
    mapa.fitBounds(L.latLngBounds([...fotos.values()].map((f) => [f.lat, f.lng])), { padding: [20, 20] });
  }
  for (const foto of fotos.values()) foto.marcador.setStyle(estilo(foto));
  pintarPanel();
}

function pintarPanel() {
  const { git } = estado;
  $("rama").textContent = git.rama ? `rama ${git.rama}` : "sin git";
  const aviso = $("aviso");
  if (!git.puedeGuardar) {
    aviso.className = "peligro";
    aviso.textContent = git.motivo;
  } else if (git.cambios.length > 0) {
    aviso.className = "cambios";
    aviso.textContent = `Cambios sin commit en data/admin/: ${git.cambios.join(", ")}. Llegan a la web con commit, PR y merge.`;
  } else {
    aviso.className = "";
    aviso.textContent = "";
  }

  const recuentos = new Map(estado.autores.map((a) => [a, 0]));
  for (const f of fotos.values()) recuentos.set(f.autor, (recuentos.get(f.autor) ?? 0) + 1);
  $("recuentos").replaceChildren(
    ...[...recuentos].map(([autor, n]) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="muestra" style="background:${colorDe.get(autor)}"></span>`;
      li.append(`${autor}: ${n}`);
      return li;
    }),
  );

  const selector = $("autor");
  const elegido = selector.value;
  selector.replaceChildren(...estado.autores.map((a) => new Option(a, a)));
  if (elegido) selector.value = elegido;

  $("seleccion").textContent =
    seleccion.size === 0 ? "Ninguna foto seleccionada." : `${seleccion.size} foto${seleccion.size === 1 ? "" : "s"} seleccionada${seleccion.size === 1 ? "" : "s"}.`;
  for (const id of ["asignar", "devolver"]) $(id).disabled = !git.puedeGuardar || seleccion.size === 0;

  const reasignadas = Object.entries(estado.reasignadas).filter(([id]) => fotos.has(id));
  $("num-reasignadas").textContent = String(reasignadas.length);
  $("reasignadas").replaceChildren(
    ...reasignadas.slice(0, 200).map(([id, autor]) => {
      const li = document.createElement("li");
      li.append(
        boton(`${autorDeUrl(id)} → ${autor}`, () => {
          const f = fotos.get(id);
          mapa.setView([f.lat, f.lng], Math.max(mapa.getZoom(), 14));
          f.marcador.bindPopup(() => popup(f), { maxWidth: 360 }).openPopup();
        }),
      );
      li.firstChild.className = "enlace";
      li.append(Object.assign(document.createElement("div"), { className: "id", textContent: id }));
      return li;
    }),
  );

  const huerfanas = estado.huerfanas;
  $("titulo-huerfanas").hidden = $("nota-huerfanas").hidden = huerfanas.length === 0;
  $("huerfanas").replaceChildren(
    ...huerfanas.map((id) => Object.assign(document.createElement("li"), { className: "id", textContent: id })),
  );
}

function refrescarEstilos(ids) {
  for (const id of ids) {
    const f = fotos.get(id);
    if (f) f.marcador.setStyle(estilo(f));
  }
  pintarPanel();
}

function alternarSeleccion(ids) {
  for (const id of ids) {
    if (seleccion.has(id)) seleccion.delete(id);
    else seleccion.add(id);
  }
  refrescarEstilos(ids);
}

function anadir(ids) {
  for (const id of ids) seleccion.add(id);
  refrescarEstilos(ids);
}

function mensaje(texto, error = false) {
  $("mensaje").textContent = texto;
  $("mensaje").className = error ? "error" : "";
}

// Acepta el id de una foto o una URL de Maps (`!1s<photoId>!`) o de un álbum (`/photo/<photoId>`).
function idsDe(texto) {
  const valor = texto.trim();
  if (fotos.has(valor)) return [valor];
  const photoId = valor.match(/!1s([^!]+)/)?.[1] ?? valor.match(/\/photo\/([^/?#]+)/)?.[1] ?? valor;
  return [...fotos.keys()].filter((id) => id.slice(id.indexOf(":") + 1) === photoId);
}

$("anadir").addEventListener("click", () => {
  const ids = idsDe($("buscar").value);
  if (ids.length === 0) return mensaje("No hay ninguna foto con esa URL o id.", true);
  anadir(ids);
  const f = fotos.get(ids[0]);
  mapa.setView([f.lat, f.lng], Math.max(mapa.getZoom(), 14));
  $("buscar").value = "";
  mensaje(`${ids.length} foto${ids.length === 1 ? "" : "s"} añadida${ids.length === 1 ? "" : "s"} a la selección.`);
});

$("limpiar").addEventListener("click", () => {
  const ids = [...seleccion];
  seleccion.clear();
  refrescarEstilos(ids);
});

async function guardar(autor) {
  const ids = [...seleccion];
  const respuesta = await fetch("/api/autores", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids, autor }),
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) return mensaje(cuerpo.error ?? "No se ha podido guardar.", true);
  seleccion.clear();
  cargar(cuerpo);
  mensaje(
    autor === null
      ? `${ids.length} foto${ids.length === 1 ? "" : "s"} devuelta${ids.length === 1 ? "" : "s"} al autor de la URL.`
      : `${ids.length} foto${ids.length === 1 ? "" : "s"} asignada${ids.length === 1 ? "" : "s"} a ${autor}.`,
  );
}

$("asignar").addEventListener("click", () => guardar($("autor").value));
$("devolver").addEventListener("click", () => guardar(null));

// Selección por área: con el modo activo, arrastrar dibuja un rectángulo en lugar de mover el mapa.
let modoArea = false;
let inicio = null;
let rectangulo = null;
$("area").addEventListener("click", () => {
  modoArea = !modoArea;
  $("area").setAttribute("aria-pressed", String(modoArea));
  if (modoArea) mapa.dragging.disable();
  else mapa.dragging.enable();
});
mapa.on("mousedown", (e) => {
  if (!modoArea) return;
  inicio = e.latlng;
  rectangulo = L.rectangle([inicio, inicio], { color: "#000", weight: 1, dashArray: "4", fill: false }).addTo(mapa);
});
mapa.on("mousemove", (e) => {
  if (inicio) rectangulo.setBounds([inicio, e.latlng]);
});
mapa.on("mouseup", () => {
  if (!inicio) return;
  const limites = rectangulo.getBounds();
  rectangulo.remove();
  inicio = null;
  anadir([...fotos.values()].filter((f) => limites.contains([f.lat, f.lng])).map((f) => f.id));
  modoArea = false;
  $("area").setAttribute("aria-pressed", "false");
  mapa.dragging.enable();
});

fetch("/api/estado")
  .then((r) => r.json())
  .then(cargar)
  .catch((error) => mensaje(`No se ha podido cargar el estado: ${error.message}`, true));
