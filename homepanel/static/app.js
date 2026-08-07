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
  }, 3500);
}

function iconFor(icon) {
  const map = {
    gate: "🚪",
    garage: "🚗",
    home: "🏠",
    door: "🚪",
    light: "💡",
    switch: "🔘",
    lock: "🔐",
    button: "🔘"
  };
  return map[icon] || icon || "🔘";
}

function colorClass(color) {
  const allowed = ["primary", "danger", "warning", "success", "dark", "light"];
  return allowed.includes(color) ? color : "primary";
}

async function loadConfig() {
  try {
    const response = await fetch("api/config");
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const config = await response.json();
    titleBox.textContent = config.title || "Controlli Casa";
    userBox.textContent = config.user ? `Accesso: ${config.user}` : "";
  } catch (error) {
    showStatus("Errore caricamento configurazione", "error");
  }
}

async function loadEntities() {

  entitiesBox.innerHTML = "";

  try {

    const response = await fetch("api/entities");

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const entities = await response.json();

    const groups = {};

    for (const entity of entities) {

      const group = entity.group || "Generale";

      if (!groups[group]) {
        groups[group] = [];
      }

      groups[group].push(entity);
    }

    for (const [group, items] of Object.entries(groups)) {

      const title = document.createElement("div");

      title.className = "group-title";

      title.innerHTML = `
        <h2>${group}</h2>
      `;

      entitiesBox.appendChild(title);

      const groupGrid = document.createElement("div");

      groupGrid.className = "grid";

      for (const entity of items) {

        const card = document.createElement("article");

        card.className = "card";

        const stateLabel = entity.state || "unknown";

        const buttonColor = colorClass(entity.color);

        card.innerHTML = `
          <div class="icon">${escapeHtml(iconFor(entity.icon))}</div>

          <div class="card-body">
            <h3>${escapeHtml(entity.name)}</h3>
            <p class="entity">${escapeHtml(entity.entity_id)}</p>
            <p class="state">
              Stato:
              <strong>${escapeHtml(stateLabel)}</strong>
            </p>
          </div>

          <button class="action-button ${buttonColor}">
            Esegui
          </button>
        `;

        const button = card.querySelector("button");

        button.addEventListener("click", async () => {

          if (entity.confirm) {

            const ok = confirm(
              `Confermi l'azione su "${entity.name}"?`
            );

            if (!ok) {
              return;
            }
          }

          await pressEntity(
            entity.entity_id,
            entity.name
          );
        });

        groupGrid.appendChild(card);
      }

      entitiesBox.appendChild(groupGrid);
    }

  } catch (error) {

    console.error(error);

    entitiesBox.innerHTML = `
      <div class="empty error-text">
        Errore caricamento entità.
      </div>
    `;
  }
}

async function pressEntity(entityId, name) {
  showStatus(`Esecuzione comando: ${name}`, "info");
  try {
    const response = await fetch(`api/press/${encodeURIComponent(entityId)}`, { method: "POST" });
    if (!response.ok) {
      throw new Error(await response.text());
    }
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
    if (!response.ok) {
      throw new Error(await response.text());
    }
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
    auditList.innerHTML = `<div class="audit-empty error-text">Errore caricamento audit.</div>`;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
