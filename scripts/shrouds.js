/**
 * Fire to Fire: Shroud counters (Foundry v11)
 *
 * A plain 0-4 shroud counter on any token, shown as a large numbered badge on the token's top-right corner.
 *   - Anyone: hover a token and press ] to add a shroud, [ to remove one (rebindable in Configure Controls).
 *   - GM (and token owners): right-click a token, use the + / - shroud buttons in the token HUD.
 * Stored on the TokenDocument: flags.f2f-tools.shrouds = n. Players can't edit enemy tokens,
 * so their changes go through the first active GM over the module socket.
 */

const MOD = "f2f-tools";
const SOCKET = `module.${MOD}`;
const ICON_DIR = `modules/${MOD}/icons/`;
const MAX = 4;

const setting = key => game.settings.get(MOD, key);
export const getShrouds = doc => Math.max(0, Math.min(MAX, Number((doc?.document ?? doc)?.flags?.[MOD]?.shrouds) || 0));

function responsibleGM() {
  return game.users.filter(u => u.isGM && u.active).sort((a, b) => (a.id > b.id ? 1 : -1))[0];
}
const iAmResponsibleGM = () => responsibleGM()?.id === game.user.id;

function shroudUpdate(doc, n) {
  // Older versions put a small status icon on the token; strip it. The count is drawn as a badge instead.
  const effects = (doc.effects ?? []).filter(e => !String(e).startsWith(ICON_DIR));
  return n > 0 ? { [`flags.${MOD}.shrouds`]: n, effects } : { [`flags.${MOD}.-=shrouds`]: null, effects };
}

/** Apply a change on this client, one at a time per token, so quick key presses all count. */
const queues = new Map();
function writeShrouds(uuid, { set, delta = 0 }) {
  const run = async () => {
    const doc = await fromUuid(uuid);
    if (!doc) return;
    const n = Math.max(0, Math.min(MAX, (set ?? getShrouds(doc)) + delta));
    if (n !== getShrouds(doc)) await doc.update(shroudUpdate(doc, n));
  };
  const next = (queues.get(uuid) ?? Promise.resolve()).then(run, run);
  queues.set(uuid, next);
  return next;
}

function request(token, change) {
  const doc = token?.document ?? token;
  if (!doc) return;
  if (doc.isOwner || game.user.isGM) return writeShrouds(doc.uuid, change);
  if (!responsibleGM()) return ui.notifications.warn("Shrouds can only change while the GM is connected.");
  game.socket.emit(SOCKET, { type: "shrouds", uuid: doc.uuid, ...change });
}

/** Set the shroud count on a token (Token or TokenDocument). */
export const setShrouds = (token, n) => request(token, { set: Number(n) || 0 });
/** Add (+1) or remove (-1) shrouds on a token. */
export const changeShrouds = (token, delta) => request(token, { delta });

/** The token a keypress applies to: the one under the mouse, else your selected tokens. */
function keyTargets() {
  const hover = canvas?.tokens?.hover;
  if (hover) return [hover];
  return canvas?.tokens?.controlled ?? [];
}

function onKey(delta) {
  const tokens = keyTargets();
  if (!tokens.length) return false;
  for (const t of tokens) changeShrouds(t, delta);
  return true;
}

/* ---------------- token HUD buttons ---------------- */

function onRenderTokenHUD(hud, html) {
  const token = hud.object;
  const root = html?.[0] ?? html;
  if (!token || !root?.append) return;
  root.querySelector(".f2f-shroud-hud")?.remove();
  const wrap = document.createElement("div");
  wrap.className = "f2f-shroud-hud";
  wrap.innerHTML = `
    <div class="control-icon" data-act="down" data-tooltip="Remove a shroud (or hover the token and press [)"><i class="fas fa-minus"></i></div>
    <div class="f2f-shroud-count" data-tooltip="Shrouds">${getShrouds(token)}</div>
    <div class="control-icon" data-act="up" data-tooltip="Add a shroud (or hover the token and press ])"><i class="fas fa-plus"></i></div>`;
  wrap.addEventListener("click", async ev => {
    const act = ev.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    ev.preventDefault();
    await changeShrouds(token, act === "up" ? 1 : -1);
    hud.render();
  });
  root.append(wrap);
  placeAboveToken(root, wrap);
}

/** Sit the row centred above the token, clear of the top resource bar box. */
export function placeAboveToken(root, wrap) {
  const place = () => {
    const hudTop = root.getBoundingClientRect?.().top ?? 0;
    let top = hudTop;
    for (const el of root.querySelectorAll?.(".col.middle > *, .attribute.bar2") ?? []) {
      if (el === wrap) continue;
      const r = el.getBoundingClientRect();
      if (r.height && r.top < top) top = r.top;
    }
    wrap.style.top = `${top - hudTop - (wrap.offsetHeight || 40) - 4}px`;
  };
  place();
  (globalThis.requestAnimationFrame ?? (f => setTimeout(f, 0)))(place);
}

/* ---------------- badge on the token ---------------- */

/** Draw (or remove) the shroud badge on a placed Token. */
export function drawBadge(token) {
  if (!token || token.destroyed) return;
  const n = getShrouds(token);
  let badge = token.f2fShroudBadge;
  if (!n || !setting("showBadge")) {
    if (badge && !badge.destroyed) badge.destroy({ children: true });
    token.f2fShroudBadge = null;
    return;
  }
  if (!badge || badge.destroyed) {
    badge = token.addChild(new PIXI.Container());
    badge.eventMode = "none";
    token.f2fShroudBadge = badge;
  }
  const key = `${n}|${token.w}|${token.h}`;
  if (badge.f2fKey === key && badge.parent === token) return; // refreshToken fires often; only redraw on change
  badge.f2fKey = key;
  if (badge.parent !== token) token.addChild(badge);
  for (const c of badge.removeChildren()) c.destroy();
  const size = Math.min(token.w, token.h);
  const r = Math.max(14, size * 0.22);
  const ring = new PIXI.Graphics();
  ring.lineStyle(Math.max(2, r * 0.16), 0xffffff, 1).beginFill(0x4b1678, 1).drawCircle(0, 0, r).endFill();
  const text = new PIXI.Text(String(n), {
    fontFamily: "Signika, Arial, sans-serif", fontSize: Math.round(r * 1.45), fontWeight: "bold",
    fill: 0xffffff, stroke: 0x000000, strokeThickness: Math.max(3, Math.round(r * 0.22))
  });
  text.anchor.set(0.5, 0.52);
  badge.addChild(ring, text);
  badge.position.set(token.w - r * 0.55, r * 0.55);
}

const redraw = doc => drawBadge(canvas?.tokens?.get?.(doc?.id));

/* ---------------- shroud clicker in the damage roll dialog ---------------- */

/** Per-shroud damage: 1d6 (+3 at 11, +6 at 21); Lethal Shroud makes it 1d8 (+5 at 11, +10 at 21). */
export function shroudDamage(actor) {
  const lvl = Number(actor?.system?.details?.level) || 1;
  const lethal = !!actor?.items?.some(i => i.name === "Lethal Shroud");
  const die = lethal ? 8 : 6;
  const per = lethal ? (lvl >= 21 ? 10 : lvl >= 11 ? 5 : 0) : (lvl >= 21 ? 6 : lvl >= 11 ? 3 : 0);
  return { die, per, lethal };
}

/** Extra damage for n invoked shrouds. A miss deals one die fewer. */
export function shroudFormula(actor, n, miss = false) {
  const dice = Math.max(0, n - (miss ? 1 : 0));
  if (!dice) return "";
  const { die, per } = shroudDamage(actor);
  return per ? `${dice}d${die} + ${dice * per}` : `${dice}d${die}`;
}

// dnd4e fires dnd4e.rollDamage just before it opens the damage dialog; remember whose roll it is.
let lastDamage = null;
const isAssassin = actor => !!actor?.items?.some(i => i.name === "Assassin's Shroud");
const hasItem = (actor, name) => !!actor?.items?.some(i => i.name === name);

/**
 * Everything the shrouds add to this damage roll, as [{ label, formula }].
 * n = shrouds invoked, onTarget = shrouds on the target, hit = "normal" | "crit" | "miss".
 * Known modifiers (from Vokun's sheet): Lethal Shroud, Shadesilk Guild, Leaping Shade, Skyshard Finisher.
 */
export function shroudExtras(actor, power, n, onTarget, hit = "normal") {
  const out = [];
  const lvl = Number(actor?.system?.details?.level) || 1;
  const miss = hit === "miss";
  if (n > 0) {
    const f = shroudFormula(actor, n, miss);
    if (f) out.push({ label: `${n} ${n === 1 ? "shroud" : "shrouds"} invoked`, formula: f });
  } else if (onTarget > 0 && !miss) {
    // Not invoked: bonuses that only apply when the shrouds stay on the target.
    if (hasItem(actor, "Shadesilk Guild")) {
      const int = Number(actor?.system?.abilities?.int?.mod) || 0;
      out.push({ label: "Shadesilk Guild", formula: String(onTarget + int) });
    }
    if (power?.name === "Leaping Shade") out.push({ label: "Leaping Shade", formula: String(onTarget * (lvl >= 21 ? 2 : 1)) });
  }
  if (power?.name === "Skyshard Finisher" && onTarget > 0 && !miss) out.push({ label: "Skyshard Finisher", formula: String(onTarget * 2) });
  return out;
}

function onRenderDamageDialog(app, html) {
  const root = html?.[0] ?? html;
  const form = root?.querySelector?.("form.roll-dialogue");
  const buttons = app?.data?.buttons;
  if (!form || !buttons?.critical || !form.querySelector('input[name="bonus"]')) return;
  if (form.querySelector("#multibonus-toggle, #d20") || form.querySelector(".f2f-shroud-invoke")) return; // attack dialog, or already added
  const recent = lastDamage && Date.now() - lastDamage.at < 5000 ? lastDamage : null;
  const actor = recent?.actor ?? null, power = recent?.item ?? null;
  const targets = [...(game.user.targets ?? [])];
  const shrouded = targets.find(t => getShrouds(t) > 0);
  if (!isAssassin(actor) && !shrouded) return;
  if (!setting("damageClicker")) return;
  lastDamage = null;

  const onTarget = shrouded ? getShrouds(shrouded) : 0;
  let n = onTarget;
  const row = document.createElement("div");
  row.className = "form-group f2f-shroud-invoke";
  row.innerHTML = `<label>Shrouds invoked</label>
    <div class="f2f-clicker">
      <a data-act="down" data-tooltip="One fewer (0 = don't invoke)"><i class="fas fa-minus"></i></a>
      <span class="f2f-n"></span>
      <a data-act="up" data-tooltip="One more"><i class="fas fa-plus"></i></a>
      <span class="f2f-dmg"></span>
    </div>`;
  const show = () => {
    row.querySelector(".f2f-n").textContent = n;
    const ex = shroudExtras(actor, power, n, onTarget);
    const el = row.querySelector(".f2f-dmg");
    el.textContent = ex.map(e => `+${e.formula}`).join(" ");
    el.dataset.tooltip = ex.map(e => `${e.label}: ${e.formula}`).join("<br>");
  };
  row.addEventListener("click", ev => {
    const act = ev.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    ev.preventDefault();
    n = Math.max(0, Math.min(MAX, n + (act === "up" ? 1 : -1)));
    show();
    app.setPosition?.({ height: "auto" });
  });
  show();
  form.querySelector('input[name="bonus"]').closest(".form-group").after(row);

  const takeOff = () => { if (n > 0 && shrouded) changeShrouds(shrouded, -n); }; // invoked shrouds vanish
  const noteFlavor = f => {
    if (f.flavor && !f.flavor.value && n > 0) f.flavor.value = `${f.flavor.placeholder || "Damage"} (invoked ${n} ${n === 1 ? "shroud" : "shrouds"})`;
  };

  // Add the extras to the situational bonus just before dnd4e reads it (works for clicks and Enter).
  for (const [key, b] of Object.entries(buttons)) {
    const original = b.callback;
    if (!original || original.f2fWrapped) continue;
    b.callback = (h, ev) => {
      const f = root.querySelector("form.roll-dialogue");
      const extra = shroudExtras(actor, power, n, onTarget, key === "critical" ? "crit" : key).map(e => e.formula).join(" + ");
      if (extra) f.bonus.value = f.bonus.value.trim() ? `${f.bonus.value.trim()} + ${extra}` : extra;
      noteFlavor(f);
      takeOff();
      return original(h, ev);
    };
    b.callback.f2fWrapped = true;
  }

  // Powers with no Miss line get no Miss button from dnd4e; invoked shrouds still deal damage on a miss.
  if (!buttons.miss) {
    const bar = root.querySelector(".dialog-buttons");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dialog-button f2f-shroud-miss";
    btn.innerHTML = `<i class="fas fa-ghost"></i> Missed: shrouds only`;
    btn.dataset.tooltip = "The attack missed: roll just the invoked shrouds (one die fewer)";
    btn.addEventListener("click", async ev => {
      ev.preventDefault();
      const f = root.querySelector("form.roll-dialogue");
      const formula = shroudFormula(actor, n, true);
      const speaker = ChatMessage.getSpeaker({ actor });
      const flavor = `${f.flavor?.placeholder || "Damage"} (miss, invoked ${n} ${n === 1 ? "shroud" : "shrouds"})`;
      if (formula) await new Roll(formula).toMessage({ speaker, flavor }, { rollMode: f.rollMode?.value });
      else if (n > 0) await ChatMessage.create({ speaker, content: `${flavor}: one shroud on a miss deals no damage.` });
      takeOff();
      app.close();
    });
    const sync = () => (btn.style.display = n > 0 ? "" : "none");
    row.addEventListener("click", sync);
    sync();
    bar?.append(btn);
  }
  app.setPosition?.({ height: "auto" });
}

/* ---------------- cleanup ---------------- */

async function clearScene(scene) {
  const updates = (scene?.tokens ?? []).filter(d => getShrouds(d) > 0).map(d => ({ _id: d.id, ...shroudUpdate(d, 0) }));
  if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
}

async function onUpdateActor(actor, change) {
  if (!iAmResponsibleGM() || !setting("clearOnDeath")) return;
  const hp = change?.system?.attributes?.hp?.value;
  if (hp === undefined || hp > 0) return;
  const docs = actor.isToken ? [actor.token] : actor.getActiveTokens(true, true);
  for (const doc of docs) if (getShrouds(doc) > 0) await doc.update(shroudUpdate(doc, 0));
}

/* ---------------- registration ---------------- */

Hooks.once("init", () => {
  game.settings.register(MOD, "clearOnCombatEnd", {
    name: "Shrouds: clear when combat ends", hint: "Remove every shroud on the scene when the combat is deleted.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MOD, "showBadge", {
    name: "Shrouds: show the badge on tokens", hint: "Draw the shroud count as a large badge on the token's top-right corner.",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => canvas?.tokens?.placeables?.forEach(drawBadge)
  });
  game.settings.register(MOD, "clearOnDeath", {
    name: "Shrouds: clear at 0 HP", hint: "Remove a token's shrouds when it drops to 0 hit points.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MOD, "damageClicker", {
    name: "Shrouds: clicker in the damage roll dialog",
    hint: "When an assassin rolls damage (or the target has shrouds), add a 'Shrouds invoked' clicker that adds the shroud dice to the roll and takes those shrouds off the target.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.keybindings.register(MOD, "shroudUp", {
    name: "Add a shroud", hint: "Adds a shroud to the token under the mouse (or your selected tokens).",
    editable: [{ key: "BracketRight" }], onDown: () => onKey(1), restricted: false
  });
  game.keybindings.register(MOD, "shroudDown", {
    name: "Remove a shroud", hint: "Removes a shroud from the token under the mouse (or your selected tokens).",
    editable: [{ key: "BracketLeft" }], onDown: () => onKey(-1), restricted: false
  });
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MOD);
  mod.api ??= {};
  mod.api.shrouds = { getShrouds, setShrouds, changeShrouds, clearScene, drawBadge, shroudDamage, shroudFormula, shroudExtras };
  game.socket.on(SOCKET, msg => {
    if (msg?.type === "shrouds" && iAmResponsibleGM()) writeShrouds(msg.uuid, { set: msg.set, delta: msg.delta });
  });
});

Hooks.on("renderTokenHUD", onRenderTokenHUD);
Hooks.on("dnd4e.rollDamage", item => (lastDamage = { actor: item?.actor, item, at: Date.now() }));
Hooks.on("renderDialog", onRenderDamageDialog);
Hooks.on("drawToken", token => drawBadge(token));
Hooks.on("refreshToken", token => drawBadge(token));
Hooks.on("updateToken", doc => redraw(doc));
Hooks.on("updateActor", (a, ch) => onUpdateActor(a, ch));
Hooks.on("deleteCombat", combat => (iAmResponsibleGM() && setting("clearOnCombatEnd") ? clearScene(combat.scene ?? canvas.scene) : undefined));
