/**
 * Fire to Fire: Ven's aegis ring (Foundry v11)
 *
 * A one-press on/off marker for a Swordmage's aegis: a blue band drawn around the whole token.
 *   - Anyone: hover a token and press \ to toggle it (rebindable in Configure Controls).
 *   - GM (and token owners): right-click a token, use the shield button in the token HUD.
 * Click the blue band to read the aegis power (e.g. Ven's Aegis of Assault).
 * Stored on the TokenDocument: flags.f2f-tools.aegis = true (and aegisBy = the swordmage's actor uuid, when known). Players can't edit enemy tokens,
 * so their changes go through the first active GM over the module socket.
 */

const MOD = "f2f-tools";
const SOCKET = `module.${MOD}`;
const COLOR = 0x2f8cff;

const setting = key => game.settings.get(MOD, key);
export const hasAegis = doc => !!(doc?.document ?? doc)?.flags?.[MOD]?.aegis;

function responsibleGM() {
  return game.users.filter(u => u.isGM && u.active).sort((a, b) => (a.id > b.id ? 1 : -1))[0];
}
const iAmResponsibleGM = () => responsibleGM()?.id === game.user.id;

const aegisUpdate = (on, by) => (on
  ? { [`flags.${MOD}.aegis`]: true, ...(by ? { [`flags.${MOD}.aegisBy`]: by } : {}) }
  : { [`flags.${MOD}.-=aegis`]: null, [`flags.${MOD}.-=aegisBy`]: null });

/** An aegis power on an actor: a power whose name includes "Aegis". */
export const aegisPower = actor => actor?.items?.find(i => i.type === "power" && /aegis/i.test(i.name)) ?? null;

/** The swordmage applying the aegis from this client: your character, else a selected token's actor. */
function applier() {
  const mine = [game.user.character, ...(canvas?.tokens?.controlled ?? []).map(t => t.actor)].find(a => aegisPower(a));
  return mine?.uuid ?? null;
}

/** One change at a time per token, so two quick presses toggle on and back off. */
const queues = new Map();
function writeAegis(uuid, { set, toggle, by }) {
  const run = async () => {
    const doc = await fromUuid(uuid);
    if (!doc) return;
    const on = toggle ? !hasAegis(doc) : !!set;
    if (on !== hasAegis(doc)) await doc.update(aegisUpdate(on, by));
  };
  const next = (queues.get(uuid) ?? Promise.resolve()).then(run, run);
  queues.set(uuid, next);
  return next;
}

function request(token, change) {
  const doc = token?.document ?? token;
  if (!doc) return;
  change = { ...change, by: change.by ?? applier() };
  if (doc.isOwner || game.user.isGM) return writeAegis(doc.uuid, change);
  if (!responsibleGM()) return ui.notifications.warn("The aegis can only change while the GM is connected.");
  game.socket.emit(SOCKET, { type: "aegis", uuid: doc.uuid, ...change });
}

/** Turn the aegis ring on or off on a token (Token or TokenDocument). */
export const setAegis = (token, on) => request(token, { set: !!on });
export const toggleAegis = token => request(token, { toggle: true });

function onKey() {
  const hover = canvas?.tokens?.hover;
  const tokens = hover ? [hover] : canvas?.tokens?.controlled ?? [];
  if (!tokens.length) return false;
  for (const t of tokens) toggleAegis(t);
  return true;
}

/* ---------------- token HUD button ---------------- */

function onRenderTokenHUD(hud, html) {
  const token = hud.object;
  const root = html?.[0] ?? html;
  const col = root?.querySelector?.(".col.left");
  if (!token || !col) return;
  const btn = document.createElement("div");
  btn.className = `control-icon f2f-aegis-btn${hasAegis(token) ? " active" : ""}`;
  btn.dataset.tooltip = "Ven's aegis on/off (or hover the token and press \\)";
  btn.innerHTML = `<i class="fas fa-shield-halved"></i>`;
  btn.addEventListener("click", async ev => {
    ev.preventDefault();
    await toggleAegis(token);
    btn.classList.toggle("active", hasAegis(token));
  });
  col.append(btn);
}

/* ---------------- ring around the token ---------------- */

/** Draw (or remove) the blue aegis band on a placed Token. */
export function drawRing(token) {
  if (!token || token.destroyed) return;
  let ring = token.f2fAegisRing;
  if (!hasAegis(token)) {
    if (ring && !ring.destroyed) ring.destroy();
    token.f2fAegisRing = null;
    return;
  }
  if (!ring || ring.destroyed) {
    ring = new PIXI.Graphics();
    ring.eventMode = "none";
    token.f2fAegisRing = ring;
  }
  if (ring.parent !== token) token.addChildAt(ring, 0);
  const key = `${token.w}|${token.h}`;
  if (ring.f2fKey === key) return;
  ring.f2fKey = key;
  const size = Math.max(token.w, token.h);
  const band = Math.max(4, size * 0.06);
  const r = size / 2 + band / 2 - 1; // hugs the outside edge of the token art
  ring.clear()
    .lineStyle(band * 2.2, COLOR, 0.25).drawCircle(0, 0, r)   // soft glow
    .lineStyle(band, COLOR, 0.95).drawCircle(0, 0, r)         // the band
    .lineStyle(Math.max(1, band * 0.25), 0xffffff, 0.8).drawCircle(0, 0, r - band / 2); // thin inner edge
  ring.position.set(token.w / 2, token.h / 2);
}

const redraw = doc => drawRing(canvas?.tokens?.get?.(doc?.id));

/* ---------------- click the band to read the aegis power ---------------- */

/** The token whose aegis band is under this canvas point, if any. */
export function ringAt(point) {
  for (const t of canvas.tokens?.placeables ?? []) {
    const ring = t.f2fAegisRing;
    if (!ring || ring.destroyed || !t.visible || !hasAegis(t)) continue;
    const size = Math.max(t.w, t.h), band = Math.max(4, size * 0.06), r = size / 2 + band / 2 - 1;
    const d = Math.hypot(point.x - (t.document.x + t.w / 2), point.y - (t.document.y + t.h / 2));
    if (Math.abs(d - r) <= band / 2 + 5) return t;
  }
  return null;
}

async function findAegisPower(doc) {
  const by = doc.flags?.[MOD]?.aegisBy;
  const actor = by ? await fromUuid(by).catch(() => null) : null;
  return aegisPower(actor)
    ?? aegisPower(game.user.character)
    ?? game.actors.filter(a => a.type === "Player Character").map(aegisPower).find(Boolean)
    ?? null;
}

export async function showAegis(token) {
  const item = await findAegisPower(token.document ?? token);
  const show = game.modules.get(MOD).api?.templates?.showItem;
  if (!item) return ui.notifications.info("No character with an Aegis power was found.");
  if (show) return show(item);
  item.sheet?.render(true);
}

function onBoardClick(ev) {
  if (ev.button !== 0) return;
  const point = canvas.canvasCoordinatesFromClient?.({ x: ev.clientX, y: ev.clientY });
  const t = point && ringAt(point);
  if (t) showAegis(t);
}

/* ---------------- cleanup ---------------- */

async function onUpdateActor(actor, change) {
  if (!iAmResponsibleGM() || !setting("aegisAutoClear")) return;
  const hp = change?.system?.attributes?.hp?.value;
  if (hp === undefined || hp > 0) return;
  const docs = actor.isToken ? [actor.token] : actor.getActiveTokens(true, true);
  for (const doc of docs) if (hasAegis(doc)) await doc.update(aegisUpdate(false));
}

async function onDeleteCombat(combat) {
  if (!iAmResponsibleGM() || !setting("aegisAutoClear")) return;
  const scene = combat.scene ?? canvas.scene;
  const updates = (scene?.tokens ?? []).filter(hasAegis).map(d => ({ _id: d.id, ...aegisUpdate(false) }));
  if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
}

/* ---------------- registration ---------------- */

Hooks.once("init", () => {
  game.settings.register(MOD, "aegisAutoClear", {
    name: "Aegis: clear at 0 HP and when combat ends",
    hint: "Remove the aegis ring from a token that drops to 0 hit points, and from every token when the combat is deleted.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.keybindings.register(MOD, "aegisToggle", {
    name: "Ven's aegis on/off", hint: "Toggles the blue aegis ring on the token under the mouse (or your selected tokens).",
    editable: [{ key: "Backslash" }], onDown: () => onKey(), restricted: false
  });
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MOD);
  mod.api ??= {};
  mod.api.aegis = { hasAegis, setAegis, toggleAegis, drawRing, ringAt, showAegis, aegisPower };
  game.socket.on(SOCKET, msg => {
    if (msg?.type === "aegis" && iAmResponsibleGM()) writeAegis(msg.uuid, { set: msg.set, toggle: msg.toggle, by: msg.by });
  });
});

// Token HUD controls removed in v1.10: the hotkeys do this job. onRenderTokenHUD is kept for reference.
Hooks.on("canvasReady", () => {
  const view = canvas.app?.view;
  if (view && !view.f2fAegisClicks) {
    // Only a real click counts, not the end of a drag.
    let down = null;
    view.addEventListener("pointerdown", ev => (down = { x: ev.clientX, y: ev.clientY }));
    view.addEventListener("click", ev => { if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 6) onBoardClick(ev); });
    view.f2fAegisClicks = true;
  }
});
Hooks.on("drawToken", token => drawRing(token));
Hooks.on("refreshToken", token => drawRing(token));
Hooks.on("updateToken", doc => redraw(doc));
Hooks.on("updateActor", (a, ch) => onUpdateActor(a, ch));
Hooks.on("deleteCombat", c => onDeleteCombat(c));
