const entitiesBox = document.getElementById("entities");
const statusBox = document.getElementById("statusBox");
const titleBox = document.getElementById("title");
const userBox = document.getElementById("user");
const refreshBtn = document.getElementById("refreshBtn");

const SVGS = {
  light: `
    <svg viewBox="0 0 24 24" class="svg-icon" aria-hidden="true">
      <path fill="currentColor" d="M9 21h6v-1H9v1m3-19A7 7 0 0 0 5 9c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7m2.85 11.1-.85.6V17h-4v-3.3l-.85-.6A5 5 0 1 1 17 9c0 1.63-.8 3.15-2.15 4.1Z"/>
    </svg>`,
  gate: `
    <svg viewBox="0 0 24 24" class="svg-icon" aria-hidden="true">
      <path fill="currentColor" d="M3 4h2v17H3V4m16 0h2v17h-2V4M7 6h4v15H7V6m6 0h4v15h-4V6M8.5 8v2h1V8h-1m6 0v2h1V8h-1M8.5 12v2h1v-2h-1m6 0v2h1v-2h-1M8.5 16v2h1v-2h-1m6 0v2h1v-2h-1Z"/>
    </svg>`,
  garage: `
    <svg viewBox="0 0 24 24" class="svg-icon" aria-hidden="true">
      <path fill="currentColor" d="M3 11 12 4l9 7v9h-2v-7H5v7H3v-9m4 4h10v2H7v-2m0 3h10v2H7v-2Z"/>
    </svg>`,
  door: `
    <svg viewBox="0 0 24 24" class="svg-icon" aria-hidden="true">
      <path fill="currentColor" d="M6 2h11a1 1 0 0 1 1 1v18h-2V4H8v17H6V2m7 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>
    </svg>`,
  home: `
    <svg viewBox="0 0 24 24" class="svg-icon" aria-hidden="true">
      <path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5Z"/>
    </svg>`,
  switch: `
    <svg viewBox="0 0 24 24" class="svg-icon" aria-hidden="true">
      <path fill="currentColor" d="M17 7H7a5 5 0 0 0 0 10h10a5 5 0 0 0 0-10m0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/>
    </svg>`,
  button: `
    <svg viewBox="0 0 24 24" class="svg-icon" aria-hidden="true">
      <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"/>
    </svg>`
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showStatus(message, type = "info") {
  statusBox.textContent = message;
  statusBox.className = `toast ${type}`;
  window.clearTimeout(showStatus._timer);
  showStatus._timer = window.setTimeout(() => {
    statusBox.className = "toast hidden";
  }, 2800);
}

function colorClass(color) {
  const allowed = ["primary", "danger", "warning", "success", "dark", "neutral"];
  return allowed.includes(color) ? color : "primary";
}

function iconFor(entity) {
  const icon = entity.icon || entity.domain || "button";
  return SVGS[icon] || SVGS[entity.domain] || SVGS.button;
}

function stateLabel(entity) {
  if (!entity.show_state) return "";
  const state = entity.state || "unknown";
  if (entity.domain === "light" || entity.icon === "light") {
    if (state === "on") return "Accesa";
    if (state === "off") return "Spenta";
  }
  if (state === "on") return "Attivo";
  if (state === "off") return "Non attivo";
  if (state === "open") return "Aperto";
  if (state === "closed") return "Chiuso";
  if (state === "locked") return "Bloccata";
  if (state === "unlocked") return "Sbloccata";
  return state;
}

function stateClass(entity) {
  if (!entity.show_state) return "hidden-state";
  const state = entity.state || "unknown";
  if (["on", "open", "unlocked"].includes(state)) return "positive";
  if (["off", "closed", "locked"].includes(state)) return "negative";
  return "unknown";
}

function groupEntities(entities) {
  const groups = {};
  for (const entity of entities) {
    const groupName = entity.group || "Generale";
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(entity);
  }
  return groups;
}

function buildCard(entity) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `remote-card ${colorClass(entity.color)}`;
  card.dataset.entityId = entity.entity_id;

  const label = stateLabel(entity);
  const stateCss = stateClass(entity);
  const stateHtml = entity.show_state
    ? `<span class="state-pill ${stateCss}">${escapeHtml(label)}</span>`
    : `<span class="state-spacer" aria-hidden="true"></span>`;

  const lightOff =
    (entity.domain === "light" || entity.icon === "light") &&
    entity.state === "off";

  card.innerHTML = `
    <span class="remote-icon ${lightOff ? 'icon-off' : ''}">${iconFor(entity)}</span>
    <span class="remote-name">${escapeHtml(entity.name)}</span>
    ${stateHtml}
  `;

  card.addEventListener("click", async () => {
    if (entity.confirm) {
      const ok = window.confirm(`Confermi l'azione su "${entity.name}"?`);
      if (!ok) return;
    }
    await pressEntity(entity.entity_id, entity.name);
  });

  return card;
}

async function loadConfig() {
  try {
    const response = await fetch("api/config", { credentials: "include" });
    if (!response.ok) throw new Error(await response.text());
    const config = await response.json();
    titleBox.textContent = config.title || "Controlli Casa";
    userBox.textContent = config.user ? `Accesso: ${config.user}` : "";
  } catch (error) {
    console.error(error);
    showStatus("Errore caricamento configurazione", "error");
  }
}

let entitiesLoading = false;

async function loadEntities() {
  if (entitiesLoading) return false;
  entitiesLoading = true;
  refreshBtn.disabled = true;

  try {
    const response = await fetch(`api/entities?_=${Date.now()}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (!response.ok) throw new Error(await response.text());

    const entities = await response.json();
    const fragment = document.createDocumentFragment();

    if (!entities.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Nessuna entità disponibile per questo utente.";
      fragment.appendChild(empty);
    } else {
      const groups = groupEntities(entities);
      for (const [groupName, items] of Object.entries(groups)) {
        const section = document.createElement("section");
        section.className = "entity-group";
        const title = document.createElement("h2");
        title.className = "group-title";
        title.textContent = groupName;
        const grid = document.createElement("div");
        grid.className = "remote-grid";
        for (const entity of items) {
          grid.appendChild(buildCard(entity));
        }
        section.appendChild(title);
        section.appendChild(grid);
        fragment.appendChild(section);
      }
    }

    entitiesBox.replaceChildren(fragment);
    return true;
  } catch (error) {
    console.error(error);
    showStatus("Errore caricamento entità", "error");
    return false;
  } finally {
    entitiesLoading = false;
    refreshBtn.disabled = false;
  }
}

async function pressEntity(entityId, name) {
  showStatus(`Comando in corso: ${name}`, "info");
  try {
    const response = await fetch("api/action", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "fetch"
      },
      body: JSON.stringify({ entity_id: entityId })
    });
    if (!response.ok) throw new Error(await response.text());
    showStatus(`Comando eseguito: ${name}`, "success");
    window.setTimeout(loadEntities, 3000);
  } catch (error) {
    console.error(error);
    showStatus(`Errore comando: ${name}`, "error");
  }
}

refreshBtn.addEventListener("click", async () => {
  const ok = await loadEntities();
  if (ok) showStatus("Stato aggiornato", "success");
});

auditBtn.addEventListener("click", async () => {
  const hidden = auditList.classList.contains("hidden");
  if (hidden) {
    auditList.classList.remove("hidden");
    auditBtn.textContent = "Nascondi";
    await loadAudit();
  } else {
    auditList.classList.add("hidden");
    auditBtn.textContent = "Mostra";
  }
});

loadConfig();
loadEntities();
