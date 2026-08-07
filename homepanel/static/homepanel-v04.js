const entitiesBox = document.getElementById("entities");
const statusBox = document.getElementById("statusBox");
const titleBox = document.getElementById("title");
const userBox = document.getElementById("user");
const refreshBtn = document.getElementById("refreshBtn");
const auditBtn = document.getElementById("auditBtn");
const auditList = document.getElementById("auditList");

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
  const icon = entity.icon || "button";
  const state = entity.state || "";
  const domain = entity.domain || "";
  if (domain === "light" || icon === "light") {
    return state === "off" ? "🌑" : "💡";
  }
  const map = {
    gate: "🚪",
    garage: "🚗",
    home: "🏠",
    door: "🚪",
    lock: "🔐",
    button: "●",
    switch: "🔘",
    camera: "📷",
    alarm: "🚨",
    garden: "🌿",
    water: "💧",
    climate: "🌡️"
  };
  return map[icon] || icon || "●";
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

  card.innerHTML = `
    <span class="remote-icon">${escapeHtml(iconFor(entity))}</span>
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

async function loadEntities() {
  entitiesBox.innerHTML = "";
  try {
    const response = await fetch("api/entities", { credentials: "include" });
    if (!response.ok) throw new Error(await response.text());
    const entities = await response.json();
    if (!entities.length) {
      entitiesBox.innerHTML = `<div class="empty">Nessuna entità disponibile per questo utente.</div>`;
      return;
    }

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
      entitiesBox.appendChild(section);
    }
  } catch (error) {
    console.error(error);
    entitiesBox.innerHTML = `<div class="empty error-text">Errore caricamento entità.</div>`;
    showStatus("Errore caricamento entità", "error");
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
    window.setTimeout(loadEntities, 650);
  } catch (error) {
    console.error(error);
    showStatus(`Errore comando: ${name}`, "error");
  }
}

async function loadAudit() {
  try {
    const response = await fetch("api/audit", { credentials: "include" });
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    if (!rows.length) {
      auditList.innerHTML = `<div class="audit-empty">Nessuna azione registrata.</div>`;
      return;
    }
    auditList.innerHTML = rows.map(row => {
      const ts = escapeHtml(row.timestamp || "");
      const user = escapeHtml(row.user || "");
      const action = escapeHtml(row.action || "");
      const result = escapeHtml(row.result || "");
      return `
        <div class="audit-row">
          <div class="audit-time">${ts}</div>
          <div><strong>${user}</strong> ${action}</div>
          <div class="audit-result">${result}</div>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error(error);
    auditList.innerHTML = `<div class="audit-empty error-text">Errore caricamento audit.</div>`;
  }
}

refreshBtn.addEventListener("click", async () => {
  await loadEntities();
  showStatus("Stato aggiornato", "success");
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
