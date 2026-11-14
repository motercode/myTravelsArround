// Página del panel de administración local. Sin dependencias aparte de Leaflet (window.L).
const L = window.L;
const COLORES = ["#1f6feb", "#d1495b", "#2a9d8f", "#e9a23b", "#6a4c93", "#5b6576"];
const $ = (id) => document.getElementById(id);

let estado = null;
const fotos = new Map(); // id → { id, lat, lng, autor, url, miniatura, marcador }
const seleccion = new Set();
const colorDe = new Map();
let seccion = "autores";
let viajeElegido = null; // id del viaje que se ve en la pestaña Viajes
const marcados = new Set(); // ids de viajes marcados para unir

// Zona de clic: el punto mide 4 px de radio; con 4 px más de tolerancia el radio efectivo es el
// doble y el área, 4 veces, sin que el punto se vea más grande.
const mapa = L.map("mapa", { renderer: L.canvas({ tolerance: 4 }) }).setView([40.4, -3.7], 5);

// Leaflet solo mide el contenedor al crearse y al redimensionar la ventana. El aviso de arriba
// aparece después de cargar el estado y cambia la altura del mapa: sin esto, Chrome deja sin
// pintar la franja de abajo hasta el siguiente cambio de tamaño de la ventana.
new ResizeObserver(() => mapa.invalidateSize()).observe(document.getElementById("mapa"));
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
  // En Viajes, con un viaje elegido, el resto de fotos se apagan.
  if (seccion === "viajes" && viajeElegido) {
    const dentro = estado.viajes[foto.viaje]?.id === viajeElegido;
    return dentro
      ? { radius: 5, color: "#000", weight: 1.5, fillColor: colorDe.get(foto.autor), fillOpacity: 0.9, opacity: 1 }
      : { radius: 3, color: "#999", weight: 0, fillColor: "#999", fillOpacity: 0.25, opacity: 0.25 };
  }
  const seleccionada = seleccion.has(foto.id);
  const reasignada = estado.reasignadas[foto.id] !== undefined;
  return {
    radius: seleccionada ? 7 : 4,
    color: seleccionada ? "#000" : reasignada ? "#000" : colorDe.get(foto.autor),
    weight: seleccionada ? 3 : reasignada ? 2 : 1,
    fillColor: colorDe.get(foto.autor),
    fillOpacity: 0.8,
    opacity: 1,
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
  const viaje = estado.viajes[foto.viaje];
  const fecha = document.createElement("div");
  fecha.textContent = `${foto.fecha ? `Fecha: ${foto.fecha.replace("T", " ")}` : "Sin fecha"}${viaje ? ` · viaje ${etiqueta(viaje)}` : ""}`;
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
  if (seccion === "viajes" && viaje) {
    fila.append(
      boton("Ver su viaje", () => {
        elegirViaje(viaje.id);
        mapa.closePopup();
      }),
    );
    if (foto.fecha && foto.fecha.length > 10) {
      fila.append(
        boton("Cortar antes de esta foto", () => {
          elegirViaje(viaje.id, false);
          $("viaje-corte").value = foto.fecha.replace("T", " ");
          mapa.closePopup();
        }),
      );
    }
  }
  div.append(texto, fecha, id, enlace, fila);
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
  for (const [id, lat, lng, autor, url, miniatura, viaje, fecha] of estado.fotos) {
    const existente = fotos.get(id);
    if (existente) {
      Object.assign(existente, { autor, viaje, fecha });
      continue;
    }
    const foto = { id, lat, lng, autor, url, miniatura, viaje, fecha };
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
  // Los ids de viaje cambian al unir o separar: lo que ya no existe se olvida.
  const ids = new Set(estado.viajes.map((v) => v.id));
  if (viajeElegido && !ids.has(viajeElegido)) viajeElegido = null;
  for (const id of [...marcados]) if (!ids.has(id)) marcados.delete(id);
  for (const foto of fotos.values()) foto.marcador.setStyle(estilo(foto));
  pintarPanel();
  pintarViajes();
  pintarAjustes();
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

function mensaje(texto, error = false, donde = "mensaje") {
  $(donde).textContent = texto;
  $(donde).className = error ? "error" : "";
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

// POST a la API del panel; devuelve el estado nuevo o null (y enseña el error en `donde`).
async function enviar(ruta, datos, donde) {
  const respuesta = await fetch(ruta, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(datos),
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) {
    mensaje(cuerpo.error ?? "No se ha podido guardar.", true, donde);
    return null;
  }
  return cuerpo;
}

async function guardar(autor) {
  const ids = [...seleccion];
  const cuerpo = await enviar("/api/autores", { ids, autor }, "mensaje");
  if (!cuerpo) return;
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

// --- Pestañas ---

for (const b of document.querySelectorAll("nav button[data-seccion]")) {
  b.addEventListener("click", () => {
    seccion = b.dataset.seccion;
    for (const otro of document.querySelectorAll("nav button[data-seccion]")) {
      otro.setAttribute("aria-selected", String(otro === b));
      $(`seccion-${otro.dataset.seccion}`).hidden = otro !== b;
    }
    mapa.closePopup();
    for (const foto of fotos.values()) foto.marcador.setStyle(estilo(foto));
  });
}

// --- Viajes ---

const rango = (v) => (v.inicio === v.fin ? v.inicio : `${v.inicio} → ${v.fin}`);
const etiqueta = (v) => (v.nombre ? `${v.nombre} (${rango(v)})` : rango(v));

function elegirViaje(id, encuadrar = true) {
  viajeElegido = id;
  for (const foto of fotos.values()) foto.marcador.setStyle(estilo(foto));
  pintarViajes();
  if (!id || !encuadrar) return;
  const indice = estado.viajes.findIndex((v) => v.id === id);
  const puntos = [...fotos.values()].filter((f) => f.viaje === indice).map((f) => [f.lat, f.lng]);
  if (puntos.length > 0) mapa.fitBounds(L.latLngBounds(puntos), { padding: [30, 30], maxZoom: 15 });
}

function pintarViajes() {
  const { viajes, git } = estado;
  $("num-viajes").textContent = String(viajes.length);

  const selector = $("filtro-autor");
  const autor = selector.value;
  selector.replaceChildren(new Option("Todos los autores", ""), ...estado.autores.map((a) => new Option(a, a)));
  selector.value = autor;
  const busca = $("filtro-nombre").value.trim().toLowerCase();
  const visibles = viajes.filter(
    (v) => (!autor || v.autor === autor) && (!busca || `${v.nombre ?? ""} ${v.inicio} ${v.fin}`.toLowerCase().includes(busca)),
  );

  // Agrupados por año, del más reciente al más antiguo (ya vienen así).
  const porAnio = new Map();
  for (const v of visibles) {
    const anio = v.inicio.slice(0, 4);
    if (!porAnio.has(anio)) porAnio.set(anio, []);
    porAnio.get(anio).push(v);
  }
  const abiertos = new Set([...$("lista-viajes").querySelectorAll("details[open]")].map((d) => d.dataset.anio));
  const elegido = viajes.find((v) => v.id === viajeElegido);
  const anioElegido = elegido?.inicio.slice(0, 4);
  $("lista-viajes").replaceChildren(
    ...[...porAnio].map(([anio, lista], i) => {
      const details = document.createElement("details");
      details.dataset.anio = anio;
      details.open = abiertos.size === 0 ? i === 0 : abiertos.has(anio) || anio === anioElegido || busca !== "";
      const summary = document.createElement("summary");
      summary.textContent = `${anio} · ${lista.length} ${lista.length === 1 ? "viaje" : "viajes"}`;
      const ul = document.createElement("ul");
      ul.append(
        ...lista.map((v) => {
          const li = document.createElement("li");
          li.className = "viaje";
          li.setAttribute("aria-current", String(v.id === viajeElegido));
          const marca = document.createElement("input");
          marca.type = "checkbox";
          marca.checked = marcados.has(v.id);
          marca.setAttribute("aria-label", `Marcar ${etiqueta(v)} · ${v.autor}`);
          marca.addEventListener("change", () => {
            if (marca.checked) marcados.add(v.id);
            else marcados.delete(v.id);
            pintarViajes();
          });
          const ver = boton("", () => elegirViaje(v.id));
          ver.className = "enlace";
          ver.append(
            Object.assign(document.createElement("span"), { textContent: etiqueta(v) }),
            Object.assign(document.createElement("span"), {
              className: "nota",
              textContent: `${v.dias} ${v.dias === 1 ? "día" : "días"} · ${v.fotos} ${v.fotos === 1 ? "foto" : "fotos"} · ${v.autor}`,
            }),
          );
          li.append(marca, ver);
          return li;
        }),
      );
      details.append(summary, ul);
      return details;
    }),
  );

  const dos = [...marcados].map((id) => viajes.find((v) => v.id === id));
  $("unir").disabled = !git.puedeGuardar || dos.length !== 2 || dos[0].autor !== dos[1].autor;
  $("unir").title = dos.length === 2 && dos[0].autor !== dos[1].autor ? "Los dos viajes tienen que ser del mismo autor." : "";

  $("viaje").hidden = !elegido;
  if (elegido) {
    $("viaje-titulo").textContent = `${etiqueta(elegido)} · ${elegido.autor}`;
    $("viaje-rango").textContent = `Primera foto: ${elegido.primera.replace("T", " ")} · última: ${elegido.ultima.replace("T", " ")}`;
    if (document.activeElement !== $("viaje-nombre")) $("viaje-nombre").value = elegido.nombre ?? "";
    $("viaje-nombre").dataset.viaje = elegido.id;
  }
  for (const id of ["guardar-nombre", "separar"]) $(id).disabled = !git.puedeGuardar;

  const huerfanas = estado.reglasHuerfanas;
  $("titulo-reglas-huerfanas").hidden = $("nota-reglas-huerfanas").hidden = huerfanas.length === 0;
  $("reglas-huerfanas").replaceChildren(
    ...huerfanas.map(({ tipo, indice, regla }) => {
      const li = document.createElement("li");
      const descripcion =
        tipo === "nombre"
          ? `Nombre «${regla.name}» en ${regla.at} (${regla.author})`
          : regla.type === "merge"
            ? `Unir ${regla.trips.join(" y ")} (${regla.author})`
            : `Separar en ${regla.at} (${regla.author})`;
      li.className = "fila";
      li.append(descripcion);
      const quitar = boton("Quitar", async () => {
        const nuevo = await enviar("/api/viajes/quitar-regla", { tipo, indice }, "mensaje-viajes");
        if (nuevo) {
          cargar(nuevo);
          mensaje("Regla quitada.", false, "mensaje-viajes");
        }
      });
      quitar.disabled = !git.puedeGuardar;
      li.append(quitar);
      return li;
    }),
  );
}

$("filtro-autor").addEventListener("change", pintarViajes);
$("ver-todas").addEventListener("click", () => elegirViaje(null));
$("filtro-nombre").addEventListener("input", pintarViajes);

$("guardar-nombre").addEventListener("click", async () => {
  const id = viajeElegido;
  const nombre = $("viaje-nombre").value.trim();
  const nuevo = await enviar("/api/viajes/nombre", { id, nombre }, "mensaje-viajes");
  if (!nuevo) return;
  cargar(nuevo);
  mensaje(nombre ? `Nombre guardado: ${nombre}.` : "Nombre quitado.", false, "mensaje-viajes");
});

$("unir").addEventListener("click", async () => {
  const ids = [...marcados];
  const nuevo = await enviar("/api/viajes/unir", { ids }, "mensaje-viajes");
  if (!nuevo) return;
  // El viaje unido empieza donde el más antiguo de los dos.
  const antiguo = ids.map((id) => estado.viajes.find((v) => v.id === id)).sort((a, b) => (a.primera < b.primera ? -1 : 1))[0];
  marcados.clear();
  cargar(nuevo);
  const unido = estado.viajes.find((v) => v.autor === antiguo.autor && v.primera === antiguo.primera);
  elegirViaje(unido?.id ?? null);
  mensaje("Viajes unidos.", false, "mensaje-viajes");
});

$("separar").addEventListener("click", async () => {
  // Acepta «2024-05-03 14:00», «2024-05-03T14:00» o con segundos.
  const valor = $("viaje-corte").value.trim().replace(" ", "T");
  const momento = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor) ? `${valor}:00` : valor;
  const nuevo = await enviar("/api/viajes/separar", { id: viajeElegido, momento }, "mensaje-viajes");
  if (!nuevo) return;
  $("viaje-corte").value = "";
  cargar(nuevo);
  mensaje(`Viaje separado en ${momento.replace("T", " ")}.`, false, "mensaje-viajes");
});

// --- Ajustes ---

function pintarAjustes() {
  if (document.activeElement !== $("dias-vacios")) $("dias-vacios").value = String(estado.ajustes.maxEmptyDaysInTrip);
  $("guardar-ajustes").disabled = !estado.git.puedeGuardar;
}

$("guardar-ajustes").addEventListener("click", async () => {
  const dias = Number($("dias-vacios").value);
  const nuevo = await enviar("/api/ajustes", { maxEmptyDaysInTrip: dias }, "mensaje-ajustes");
  if (!nuevo) return;
  cargar(nuevo);
  mensaje(`Guardado: ${dias} ${dias === 1 ? "día" : "días"}. Ahora hay ${estado.viajes.length} viajes.`, false, "mensaje-ajustes");
});

fetch("/api/estado")
  .then((r) => r.json())
  .then(cargar)
  .catch((error) => mensaje(`No se ha podido cargar el estado: ${error.message}`, true));
