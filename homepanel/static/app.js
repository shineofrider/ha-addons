const entitiesBox = document.getElementById("entities");
const statusBox = document.getElementById("statusBox");
const titleBox = document.getElementById("title");
const userBox = document.getElementById("user");
const refreshBtn = document.getElementById("refreshBtn");
const auditBtn = document.getElementById("auditBtn");
const auditList = document.getElementById("auditList");

function showStatus(message, type = "info") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
  setTimeout(() => {
    statusBox.className = "status hidden";
  }, 3000);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function colorClass(color) {
  const allowed = ["primary", "danger", "warning", "success", "dark", "light"];
  return allowed.includes(color) ? color : "primary";
}

function iconFor(entity) {
  const icon = entity.icon || "button";
  const state = entity.state || "";
  const domain = entity.domain || "";

  if (domain === "light" || icon === "light") {
    if (state === "on") return "💡";
    if (state === "off") return "🌑";
    return "💡";
  }

  const map = {
    gate: "🚪",
    garage: "🚗",
    home: "🏠",
    door: "🚪",
    lock: "🔐",
    switch: "🔘",
    button: "●",
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
  const state = entity.state || "";
  if (!entity.show_state) return "";

  if (state === "on" || state === "open" || state === "unlocked") return "state-on";
  if (state === "off" || state === "closed" || state === "locked") return "state-off";
  return "state-unknown";
}

async function loadConfig() {
  try {
    const response = await fetch("api/config");
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
    const response = await fetch("api/entities");
    if (!response.ok) throw new Error(await response.text());

    const entities = await response.json();

    if (!entities.length) {
      entitiesBox.innerHTML = `<div class="empty">Nessuna entità disponibile per questo utente.</div>`;
      return;
    }

    const groups = {};
    for (const entity of entities) {
      const groupName = entity.group || "Generale";
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(entity);
    }

    for (const [groupName, items] of Object.entries(groups)) {
      const groupSection = document.createElement("section");
      groupSection.className = "entity-group";

      const groupTitle = document.createElement("h2");
      groupTitle.className = "group-title";
      groupTitle.textContent = groupName;

      const groupGrid = document.createElement("div");
      groupGrid.className = "group-grid";

      groupSection.appendChild(groupTitle);
      groupSection.appendChild(groupGrid);

      for (const entity of items) {
        const card = document.createElement("article");
        card.className = `card clickable ${colorClass(entity.color)}`;

        const label = stateLabel(entity);
        const labelClass = stateClass(entity);

        card.innerHTML = `
          <div class="card-icon">${escapeHtml(iconFor(entity))}</div>
          <div class="card-title">${escapeHtml(entity.name)}</div>
          ${entity.show_state
            ? `<div class="card-state ${labelClass}">${escapeHtml(label)}</div>`
            : `<div class="card-state card-state-hidden">&nbsp;</div>`}
        `;

        card.addEventListener("click", async () => {
          if (entity.confirm) {
            const ok = confirm(`Confermi l'azione su "${entity.name}"?`);
            if (!ok) return;
          }
          await pressEntity(entity.entity_id, entity.name);
        });

        groupGrid.appendChild(card);
      }

      entitiesBox.appendChild(groupSection);
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
    const response = await fetch(`api/press/${encodeURIComponent(entityId)}`, { method: "POST" });
    if (!response.ok) throw new Error(await response.text());

    showStatus(`Comando eseguito: ${name}`, "success");
    setTimeout(loadEntities, 700);
  } catch (error) {
    console.error(error);
    showStatus(`Errore comando: ${name}`, "error");
  }
}

async function loadAudit() {
  try {
    const response = await fetch("api/audit");
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
      const entity = escapeHtml(row.entity_id || "");
      const result = escapeHtml(row.result || "");

      return `
        <div class="audit-row">
          <div class="audit-time">${ts}</div>
          <div class="audit-main">
            <strong>${user}</strong>
            <span>${action}</span>
            <span>${entity}</span>
          </div>
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
