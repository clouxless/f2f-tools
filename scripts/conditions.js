/**
 * Fire to Fire: Conditions with durations (Foundry v11, dnd4e)
 *
 * A token HUD button opens a dialog: pick conditions, pick how long they last.
 * The effects are created the way the dnd4e system creates power effects
 * (flags.dnd4e.effectData.durationType + duration.rounds/startRound), so the system
 * itself removes turn-based ones as turns pass and prompts saving throws for "save ends".
 */

const MOD = "f2f-tools";

// 4e conditions offered, in this order (ids from the dnd4e status effects).
const CONDITIONS = [
  "blinded", "dazed", "deafened", "dominated", "grabbed", "immobilized", "mark_1", "petrified",
  "prone", "restrained", "slowed", "stunned", "unconscious", "weakened", "insubstantial", "invisible",
  "ongoing_1", "attack_down", "defDown", "attack_up", "defUp", "regen"
];

export const DURATIONS = [
  { id: "endOfTargetTurn", label: "Until the end of its next turn", short: "end of its next turn" },
  { id: "endOfUserTurn", label: "Until the end of the applier's next turn", short: "end of {who}'s next turn", needsSource: true },
  { id: "startOfTargetTurn", label: "Until the start of its next turn", short: "start of its next turn" },
  { id: "saveEnd", label: "Save ends", short: "save ends" },
  { id: "endOfEncounter", label: "Until the end of the encounter", short: "end of encounter" },
  { id: "", label: "Until removed", short: "until removed" }
];
const TURN_TYPES = ["endOfTargetTurn", "endOfUserTurn", "startOfTargetTurn", "startOfUserTurn"];

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const setting = key => game.settings.get(MOD, key);
const loc = s => game.i18n.localize(s ?? "");

function statusList() {
  const all = CONFIG.statusEffects ?? [];
  return CONDITIONS.map(id => all.find(s => s.id === id)).filter(Boolean)
    .map(s => ({ id: s.id, name: s.id === "mark_1" ? "Marked" : s.id === "ongoing_1" ? "Ongoing damage" : loc(s.label ?? s.name), icon: s.icon, description: s.description }));
}

const initiativeOf = tokenId => game.combat?.turns.find(t => t.tokenId === tokenId)?.initiative ?? null;
const currentInit = () => game.combat?.turns[game.combat.turn]?.initiative ?? 0;

/**
 * Build the ActiveEffect data for one condition, with dnd4e duration flags.
 * Mirrors dnd4e Helper.applyEffectsToTokens so the system's own turn handling expires it.
 */
export function effectData({ status, name, icon, durationType, targetToken, sourceToken }) {
  const combat = game.combat;
  const round = combat?.round ?? 0;
  const cur = currentInit();
  const targetInit = initiativeOf(targetToken?.id) ?? cur;
  const sourceInit = initiativeOf(sourceToken?.id) ?? cur;
  let rounds = 0, turnInit = null;
  if (durationType === "endOfTargetTurn" || durationType === "startOfTargetTurn") {
    rounds = combat ? (cur > targetInit ? round : round + 1) : 0;
    turnInit = targetInit;
  } else if (durationType === "endOfUserTurn" || durationType === "startOfUserTurn") {
    rounds = combat ? (cur > sourceInit ? round : round + 1) : 0;
    turnInit = sourceInit;
  }
  const d = DURATIONS.find(x => x.id === durationType) ?? DURATIONS.at(-1);
  const suffix = d.short.replace("{who}", sourceToken?.name ?? "the applier");
  const effectData = { durationType, startTurnInit: cur };
  if (turnInit !== null) effectData.durationTurnInit = turnInit;
  return {
    name: `${name} (${suffix})`,
    icon: icon ?? "icons/svg/aura.svg",
    origin: sourceToken?.actor?.uuid ?? null,
    statuses: status ? [status.id] : [],
    description: status?.description ? loc(status.description) : "",
    duration: { rounds, startRound: round, ...(combat ? { combat: combat.id } : {}) },
    flags: { dnd4e: { effectData }, [MOD]: { condition: true, ...(status ? {} : { custom: true }) } }
  };
}

/** Apply conditions to tokens. picks = [{ status?, name, icon }] */
export async function applyConditions(tokens, picks, durationType, sourceToken) {
  for (const t of tokens) {
    const actor = t.actor;
    if (!actor) continue;
    const data = picks.map(p => effectData({ ...p, durationType, targetToken: t.document ?? t, sourceToken }));
    if (data.length) await actor.createEmbeddedDocuments("ActiveEffect", data);
  }
}

function describeDuration(e) {
  const type = e.flags?.dnd4e?.effectData?.durationType;
  if (!type) return "until removed";
  const m = e.name?.match(/\(([^)]+)\)$/);
  return m ? m[1] : (CONFIG.DND4EBETA?.durationType?.[type] ?? type);
}

/* ---------------- hover card for custom effects ---------------- */

// Effects typed into "Other" all share one generic icon, so their text shows in a card under the token on hover.
export function customEffects(actor) {
  return (actor?.effects ?? []).filter(e => !e.disabled && e.flags?.[MOD]?.condition && (e.flags[MOD].custom || !(e.statuses?.size ?? e.statuses?.length)));
}

let effCard = null, effShown = null;
function effCardEl() {
  if (effCard?.isConnected) return effCard;
  effCard = document.createElement("div");
  effCard.id = "f2f-effcard";
  effCard.className = "f2f-effcard";
  document.body.append(effCard);
  return effCard;
}
function placeEffCard(token) {
  const view = canvas.app.view.getBoundingClientRect();
  const p = canvas.stage.worldTransform.apply({ x: token.x + token.w / 2, y: token.y + token.h });
  effCard.style.left = `${view.left + p.x}px`;
  effCard.style.top = `${view.top + p.y + 6}px`;
}
export function showEffectCard(token) {
  const list = token?.visible === false ? [] : customEffects(token?.actor);
  if (!list.length) return hideEffectCard();
  const el = effCardEl();
  el.innerHTML = list.map(e => `<div>${esc(e.name)}</div>`).join("");
  placeEffCard(token);
  el.classList.add("on");
  effShown = token;
}
export function hideEffectCard() {
  effShown = null;
  effCard?.classList.remove("on");
}
Hooks.on("hoverToken", (token, hovered) => {
  if (!game.settings.get(MOD, "conditionsHoverCard")) return;
  if (hovered) showEffectCard(token);
  else if (effShown === token) hideEffectCard();
});
Hooks.on("canvasPan", () => { if (effShown) placeEffCard(effShown); });
Hooks.on("canvasTearDown", () => hideEffectCard());
for (const h of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(h, effect => { if (effShown && effect.parent === effShown.actor) showEffectCard(effShown); });
}

/* ---------------- dialog ---------------- */

export async function openConditionDialog(tokens) {
  tokens = (tokens ?? canvas.tokens.controlled).filter(t => t.actor);
  if (!tokens.length) return ui.notifications.warn("Select a token first.");
  const statuses = statusList();
  const combatants = game.combat?.turns.filter(c => c.token) ?? [];
  const current = game.combat?.combatant;
  const names = tokens.map(t => esc(t.name)).join(", ");

  const existing = tokens.length === 1
    ? tokens[0].actor.effects.filter(e => !e.disabled && (e.flags?.dnd4e?.effectData?.durationType || e.flags?.[MOD]?.condition))
    : [];

  // Same layout and classes as the dnd4e attack roll dialog (form-group rows, two-column checkboxes).
  const col = (type, name, value, label, checked) =>
    `<div class="column"><label class="rollable"><input type="${type}" name="${name}" value="${esc(value)}" ${checked ? "checked" : ""}/>${esc(label)}</label></div>`;
  const content = `
  <form class="roll-dialogue f2f-conditions">
    <div class="form-group"><label>Target</label><input type="text" value="${names}" disabled/></div>
    <div class="form-group stacked f2f-section"><label class="f2f-heading">Conditions</label>
      ${statuses.map(s => col("checkbox", "status", s.id, s.name)).join("")}
    </div>
    <div class="form-group"><label>Other</label><input type="text" name="custom" placeholder="e.g. -2 to attack rolls, ongoing 5 fire"/></div>
    <div class="form-group stacked f2f-section f2f-lasts"><label class="f2f-heading">Lasts</label>
      ${DURATIONS.map((d, i) => col("radio", "duration", d.id, d.label, i === 0)).join("")}
    </div>
    <div class="form-group f2f-source"><label>Applied by</label>
      <select name="source">${combatants.map(c => `<option value="${c.tokenId}" ${c.id === current?.id ? "selected" : ""}>${esc(c.name)}</option>`).join("") || `<option value="">(no combat running)</option>`}</select>
    </div>
    ${existing.length ? `<div class="form-group stacked f2f-section"><label class="f2f-heading">Current conditions</label>
      ${existing.map(e => `<div class="f2f-row"><span>${esc(e.name)}</span><a data-remove="${e.id}" data-tooltip="Remove"><i class="fas fa-times"></i></a></div>`).join("")}
    </div>` : ""}
  </form>`;

  return new Promise(resolve => {
    const dlg = new Dialog({
      title: "Add condition",
      content,
      buttons: {
        apply: {
          icon: '<i class="fas fa-check"></i>', label: "Apply",
          callback: async html => {
            const root = html[0] ?? html;
            const form = root.querySelector("form");
            const picked = [...form.querySelectorAll('input[name="status"]:checked')].map(i => statuses.find(s => s.id === i.value));
            const custom = form.querySelector('input[name="custom"]').value.trim();
            const durationType = form.querySelector('input[name="duration"]:checked')?.value ?? "";
            const sourceId = form.querySelector('select[name="source"]')?.value;
            const sourceToken = sourceId ? canvas.scene?.tokens.get(sourceId) ?? null : null;
            const picks = picked.map(s => ({ status: s, name: s.name, icon: s.icon }));
            if (custom) picks.push({ name: custom, icon: "icons/svg/aura.svg" });
            if (!picks.length) { ui.notifications.warn("Pick a condition or type one in Other."); return resolve(null); }
            await applyConditions(tokens, picks, durationType, sourceToken);
            resolve({ picks, durationType });
          }
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve(null) }
      },
      default: "apply",
      render: html => {
        const root = html[0] ?? html;
        const src = root.querySelector(".f2f-source");
        const sync = () => { if (src) src.style.display = root.querySelector('input[name="duration"]:checked')?.value === "endOfUserTurn" ? "" : "none"; };
        root.querySelectorAll('input[name="duration"]').forEach(r => r.addEventListener("change", sync));
        sync();
        root.querySelectorAll("[data-remove]").forEach(a => a.addEventListener("click", async ev => {
          ev.preventDefault();
          await tokens[0].actor.deleteEmbeddedDocuments("ActiveEffect", [a.dataset.remove]);
          a.closest(".f2f-row")?.remove();
        }));
      },
      close: () => resolve(null)
    }, { width: 460, classes: ["dialog", "f2f-conditions-dialog"] });
    dlg.render(true);
  });
}

/* ---------------- token HUD button ---------------- */

function onRenderTokenHUD(hud, html) {
  const token = hud.object;
  if (!token?.actor?.isOwner) return;
  const root = html?.[0] ?? html;
  const col = root?.querySelector?.(".col.left");
  if (!col) return;
  const btn = document.createElement("div");
  btn.className = "control-icon f2f-condition-btn";
  btn.dataset.tooltip = "Add a condition with a duration";
  btn.innerHTML = `<i class="fas fa-hourglass-half"></i>`;
  btn.addEventListener("click", ev => {
    ev.preventDefault();
    const selected = canvas.tokens.controlled.includes(token) ? canvas.tokens.controlled : [token];
    openConditionDialog(selected);
  });
  col.append(btn);
}

/* ---------------- end of combat ---------------- */

async function onDeleteCombat(combat) {
  if (!setting("conditionsClearOnCombatEnd")) return;
  const gm = game.users.filter(u => u.isGM && u.active).sort((a, b) => (a.id > b.id ? 1 : -1))[0];
  if (gm?.id !== game.user.id) return;
  for (const c of combat.combatants) {
    const actor = c.token?.actor ?? c.actor;
    if (!actor) continue;
    const ids = actor.effects.filter(e => [...TURN_TYPES, "endOfEncounter"].includes(e.flags?.dnd4e?.effectData?.durationType)).map(e => e.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  }
}

Hooks.once("init", () => {
  game.settings.register(MOD, "conditionsHoverCard", {
    name: "Conditions: show custom effects when hovering a token",
    hint: "Effects typed into Other in the conditions pop-up show their text in a small card under the token while the mouse is over it.",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(MOD, "conditionsClearOnCombatEnd", {
    name: "Conditions: clear encounter-long effects when combat ends",
    hint: "When a combat is deleted, remove effects that last until the end of the encounter or until a turn, from everyone who was in it. Save-ends effects stay.",
    scope: "world", config: true, type: Boolean, default: true
  });
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MOD);
  mod.api ??= {};
  mod.api.conditions = { openConditionDialog, applyConditions, effectData, DURATIONS };
});

Hooks.on("renderTokenHUD", onRenderTokenHUD);
Hooks.on("deleteCombat", c => onDeleteCombat(c));
