// PATCH v0.4.1
// Modifiche da applicare a homepanel-v04.js
// 1) iconFor(entity)
function iconFor(entity) {
  const icon = entity.icon || "button";
  const domain = entity.domain || "";
  if (domain === "light" || icon === "light") {
    return "💡";
  }
  return SVGS?.[icon] || icon;
}

// 2) Dentro buildCard(entity) prima di card.innerHTML
const lightOff =
  (entity.domain === "light" || entity.icon === "light") &&
  entity.state === "off";

// 3) Sostituisci il blocco card.innerHTML con:
card.innerHTML = `
  <span class="remote-icon ${lightOff ? 'icon-off' : ''}">
    ${iconFor(entity)}
  </span>
  <span class="remote-name">
    ${escapeHtml(entity.name)}
  </span>
  ${stateHtml}
`;
