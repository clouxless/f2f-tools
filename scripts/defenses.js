/**
 * Fire to Fire: see a token's defenses from the map (Foundry v11, dnd4e).
 *
 * Hover a token and hold E: a small card above it shows AC, Fortitude, Reflex and Will.
 * While E is held, moving to another token shows that one's instead. Let go to hide it.
 * The GM sees every token. Players see their own characters, or every token if the GM allows it
 * ("Defenses: players can see" in Module Settings). Rebind the key in Configure Controls.
 */

const MOD = "f2f-tools";
const DEFS = [["ac", "AC"], ["fort", "Fort"], ["ref", "Ref"], ["wil", "Will"]];
let held = false;
let shown = null;
let card = null;

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function canSee(token) {
  const actor = token?.actor;
  if (!actor) return false;
  if (game.user.isGM) return true;
  if (!token.visible) return false;
  return actor.isOwner || game.settings.get(MOD, "defensesPlayers") === "all";
}

export function defenses(actor) {
  const d = actor?.system?.defences ?? {};
  return DEFS.map(([k, label]) => ({ key: k, label, value: d[k]?.value ?? d[k] ?? "?" }));
}

function cardEl() {
  if (card?.isConnected) return card;
  card = document.createElement("div");
  card.id = "f2f-defcard";
  card.className = "f2f-defcard";
  document.body.append(card);
  return card;
}

function place(token) {
  const el = cardEl();
  const view = canvas.app.view.getBoundingClientRect();
  const wt = canvas.stage.worldTransform;
  const top = wt.apply({ x: token.x + token.w / 2, y: token.y });
  el.style.left = `${view.left + top.x}px`;
  el.style.top = `${view.top + top.y - 6}px`;
}

export function show(token) {
  if (!token || !canSee(token)) return hide();
  const el = cardEl();
  const name = game.user.isGM || token.actor?.isOwner || [CONST.TOKEN_DISPLAY_MODES.HOVER, CONST.TOKEN_DISPLAY_MODES.ALWAYS].includes(token.document.displayName) ? token.name : "";
  el.innerHTML = `${name ? `<div class="nm">${esc(name)}</div>` : ""}<div class="defs">${defenses(token.actor).map(d => `<span><b>${d.label}</b> ${esc(d.value)}</span>`).join("")}</div>`;
  place(token);
  el.classList.add("on");
  shown = token;
}

export function hide() {
  shown = null;
  card?.classList.remove("on");
}

Hooks.once("init", () => {
  game.settings.register(MOD, "defensesPlayers", {
    name: "Defenses: players can see",
    hint: "Holding E over a token shows its defenses. The GM always sees every token; this sets what players see.",
    scope: "world", config: true, type: String, default: "owned",
    choices: { owned: "Only their own characters", all: "Every token they can see" }
  });
  game.keybindings.register(MOD, "showDefenses", {
    name: "Show defenses (hold)",
    hint: "Hold while hovering a token to see its AC, Fortitude, Reflex and Will.",
    editable: [{ key: "KeyE" }],
    onDown: () => { held = true; show(canvas?.tokens?.hover); return false; },
    onUp: () => { held = false; hide(); return false; }
  });
});

Hooks.on("hoverToken", (token, hovered) => {
  if (!held) return;
  if (hovered) show(token);
  else if (shown === token) hide();
});
Hooks.on("canvasPan", () => { if (shown) place(shown); });
Hooks.on("updateActor", actor => { if (shown?.actor === actor) show(shown); });
Hooks.on("canvasTearDown", () => hide());

Hooks.once("ready", () => {
  const mod = game.modules.get(MOD);
  mod.api ??= {};
  mod.api.defenses = { show, hide, defenses, canSee };
});
