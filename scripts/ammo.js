/**
 * Fire to Fire: special ammunition in attack and damage rolls (Foundry v11, dnd4e)
 *
 * The dnd4e attack and damage dialogs get an "Ammunition" drop-down listing the character's
 * ammunition consumables (consumableType "ammo", quantity above 0).
 *   - Attack: adds the ammo's name and property to the chat flavor, and applies what the property
 *     says where it can: "roll twice and use either" sets two d20s (keep highest), "grants combat
 *     advantage" ticks Combat Advantage. Rolling uses up one piece of ammunition.
 *   - Damage: the drop-down starts on the ammo used for that power's attack. "takes XdY extra <type>
 *     damage per plus" is added to Normal and Critical Hit rolls, typed.
 *   - Enhancement: ammunition doesn't stack with the bow's bonus; when the ammo's plus is higher
 *     than the equipped weapon's, the difference is added to attack and damage.
 */

const MOD = "f2f-tools";
const setting = key => game.settings.get(MOD, key);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const strip = html => String(html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&rsquo;/g, "'").replace(/\s+/g, " ").trim();

/** What a piece of ammunition does, read from its name and Property text. */
export function ammoInfo(item) {
  const text = strip(item?.system?.description?.value);
  const plus = Number(item?.name?.match(/\+(\d+)/)?.[1]) || 0;
  const property = text.match(/Property:\s*(.*?)(?:\s+(?:Power|Level|Published)\b.*)?$/i)?.[1]?.trim() ?? "";
  const info = { id: item.id, name: item.name, plus, property, quantity: Number(item.system?.quantity) || 0 };
  const dmg = property.match(/(\d+)d(\d+) extra (\w+) damage per plus/i);
  if (dmg && plus) info.damage = `${Number(dmg[1]) * plus}d${dmg[2]}[${dmg[3].toLowerCase()}]`;
  info.rollTwice = /roll twice and use either/i.test(property);
  info.comAdv = /grants? combat advantage to you for that attack/i.test(property);
  // Areas on the target: "creates a zone in a burst N centered on the target" (hit or miss),
  // "that enemy and each creature adjacent to it" (on a hit).
  const burst = property.match(/burst (\d+) centered on the target/i);
  if (burst) info.area = { size: Number(burst[1]), onMiss: /whether the attack hits or misses/i.test(property) };
  else if (/each creature adjacent to it/i.test(property)) info.area = { size: 1, onMiss: false };
  return info;
}

export function ammoList(actor) {
  return (actor?.items ?? []).filter(i => i.type === "consumable" && i.system?.consumableType === "ammo" && (Number(i.system?.quantity) || 0) > 0).map(ammoInfo);
}

/** Extra enhancement from ammo whose plus beats the equipped weapon's (they don't stack). */
export function enhanceDiff(actor, info) {
  if (!info?.plus) return 0;
  const weapons = (actor?.items ?? []).filter(i => i.type === "weapon" && i.system?.equipped);
  const best = Math.max(0, ...weapons.map(w => Number(w.system?.enhance) || 0));
  return Math.max(0, info.plus - best);
}

// Which actor/power opened the dialog; and which ammo the last attack used, for its damage roll.
let pendingAttack = null, pendingDamage = null, pendingArea = null;
const lastUsed = new Map(); // actorId -> { itemId, ammoId, at }

function dropdown(list, selected) {
  const opts = [`<option value="">None</option>`, ...list.map(a => `<option value="${a.id}" ${a.id === selected ? "selected" : ""}>${esc(a.name)} (${a.quantity})</option>`)];
  const row = document.createElement("div");
  row.className = "form-group f2f-ammo";
  row.innerHTML = `<label>Ammunition</label><select name="f2fAmmo">${opts.join("")}</select><p class="f2f-ammo-note notes"></p>`;
  return row;
}

function noteFor(info, kind) {
  if (!info) return "";
  const bits = [];
  if (kind === "attack" && info.rollTwice) bits.push("rolls two d20s, keeps the higher");
  if (kind === "attack" && info.comAdv) bits.push("adds combat advantage");
  if (kind === "damage" && info.damage) bits.push(`adds ${info.damage} on a hit`);
  return [bits.join("; "), info.property].filter(Boolean).join(" · ");
}

function wrapButtons(app, fn) {
  for (const [key, b] of Object.entries(app.data.buttons ?? {})) {
    const original = b.callback;
    if (!original || original.f2fAmmo) continue;
    b.callback = (h, ev) => { fn(key); return original(h, ev); };
    b.callback.f2fAmmo = true;
  }
}

function onRenderDialog(app, html) {
  if (!setting("ammoDropdown")) return;
  const root = html?.[0] ?? html;
  const form = root?.querySelector?.("form.roll-dialogue");
  if (!form || form.querySelector(".f2f-ammo") || !form.querySelector('input[name="bonus"]')) return;
  const isAttack = !!form.querySelector("#multibonus-toggle");
  const isDamage = !isAttack && !!app.data?.buttons?.critical && !form.querySelector("#d20");
  const pending = isAttack ? pendingAttack : isDamage ? pendingDamage : null;
  if (!pending || Date.now() - pending.at > 5000) return;
  if (isAttack) pendingAttack = null; else pendingDamage = null;
  const { actor, item } = pending;
  const list = ammoList(actor);
  const last = lastUsed.get(actor.id);
  const preset = isDamage && last && last.itemId === item?.id && Date.now() - last.at < 10 * 60 * 1000 ? last.ammoId : "";
  // The attack may have used the last one; its damage still needs it.
  if (preset && !list.some(a => a.id === preset)) {
    const used = actor.items.get(preset);
    if (used) list.unshift(ammoInfo(used));
  }
  if (!list.length) return;
  const row = dropdown(list, preset);
  // dnd4e reads attack-dialog fields by position, so the drop-down goes last in the form.
  form.append(row);
  const select = row.querySelector("select");
  const current = () => list.find(a => a.id === select.value) ?? null;
  const showNote = () => (row.querySelector(".f2f-ammo-note").textContent = noteFor(current(), isAttack ? "attack" : "damage"));
  select.addEventListener("change", showNote);
  showNote();
  app.setPosition?.({ height: "auto" });

  wrapButtons(app, key => {
    const info = current();
    if (!info) return;
    const f = root.querySelector("form.roll-dialogue");
    const add = s => (f.bonus.value = f.bonus.value.trim() ? `${s} + ${f.bonus.value.trim()}` : s);
    const diff = enhanceDiff(actor, info);
    if (isAttack) {
      if (info.rollTwice && f.d20 && (!f.d20.value || f.d20.value == 1)) f.d20.value = 2;
      if (info.comAdv) f.querySelectorAll('input[type="checkbox"][name$=".comAdv"]').forEach(c => (c.checked = true));
      if (diff) add(String(diff));
      if (f.flavor && !f.flavor.value) f.flavor.value = `${f.flavor.placeholder || item?.name || "Attack"} · ${info.name}${info.property ? `: ${info.property}` : ""}`;
      lastUsed.set(actor.id, { itemId: item?.id, ammoId: info.id, at: Date.now() });
      pendingArea = info.area ? { actor, info, at: Date.now() } : null;
      const ammo = actor.items.get(info.id);
      if (ammo) ammo.update({ "system.quantity": Math.max(0, info.quantity - 1) });
    } else {
      const hit = key !== "miss";
      // Typed dice go first so dnd4e's damage-type handling only types the ammo's dice.
      if (hit && info.damage) add(info.damage);
      if (diff) f.bonus.value = f.bonus.value.trim() ? `${f.bonus.value.trim()} + ${diff}` : String(diff);
      if (f.flavor && !f.flavor.value) f.flavor.value = `${f.flavor.placeholder || item?.name || "Damage"} · ${info.name}`;
    }
  });
}

/* ---------------- area ammunition: place a template on the target ---------------- */

/** After the attack roll: a chat card with a "Place template" button per target the area applies to. */
async function onRollAttack(item, targetData) {
  const p = pendingArea;
  if (!p || Date.now() - p.at > 10000) return;
  pendingArea = null;
  const tokens = (p.info.area.onMiss ? targetData?.targets : targetData?.targetHit) ?? [];
  if (!tokens.length) return;
  const scene = canvas.scene?.id;
  const buttons = tokens.map(t => {
    const d = t.document ?? t;
    return `<button type="button" class="f2f-area-btn" data-scene="${scene}" data-token="${d.id}" data-size="${p.info.area.size}" data-ammo="${p.info.id}" data-actor="${p.actor.uuid ?? ""}"><i class="fas fa-ruler-combined"></i> Place burst ${p.info.area.size} on ${esc(d.name)}</button>`;
  }).join("");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: p.actor }),
    content: `<div class="f2f-ammo-area"><p><b>${esc(p.info.name)}:</b> ${esc(p.info.property)}</p>${buttons}</div>`
  });
}

/** A square template covering the target's space plus `size` squares all round, labelled with the ammo. */
export async function placeAreaTemplate({ sceneId, tokenId, size = 1, label, ammoUuid }) {
  const scene = game.scenes.get(sceneId) ?? canvas.scene;
  const tok = scene?.tokens.get(tokenId);
  if (!tok) return ui.notifications.warn("That target isn't on this scene any more.");
  const grid = scene.grid.size, dist = scene.grid.distance;
  const side = Math.max(tok.width, tok.height) + size * 2; // squares
  const data = {
    t: "rect", user: game.user.id,
    x: tok.x - size * grid, y: tok.y - size * grid,
    direction: 45, distance: Math.SQRT2 * side * dist,
    fillColor: game.user.color,
    flags: { [MOD]: { label, itemUuid: ammoUuid ?? null } }
  };
  return scene.createEmbeddedDocuments("MeasuredTemplate", [data]);
}

function onRenderChatMessage(msg, html) {
  const root = html?.[0] ?? html;
  root?.querySelectorAll?.(".f2f-area-btn").forEach(btn => btn.addEventListener("click", async ev => {
    ev.preventDefault();
    const actor = btn.dataset.actor ? await fromUuid(btn.dataset.actor) : null;
    const ammo = actor?.items?.get(btn.dataset.ammo);
    const label = ammo?.name ?? btn.closest(".f2f-ammo-area")?.querySelector("b")?.textContent?.replace(/:$/, "");
    await placeAreaTemplate({ sceneId: btn.dataset.scene, tokenId: btn.dataset.token, size: Number(btn.dataset.size) || 1, label, ammoUuid: ammo?.uuid });
  }));
}

function remember(kind) {
  return function (wrapped, ...args) {
    const rec = { actor: this.actor, item: this, at: Date.now() };
    if (kind === "attack") pendingAttack = rec; else pendingDamage = rec;
    return wrapped(...args);
  };
}

Hooks.once("init", () => {
  game.settings.register(MOD, "ammoDropdown", {
    name: "Ammunition: drop-down in attack and damage rolls",
    hint: "Characters with ammunition consumables get an Ammunition drop-down in the dnd4e attack and damage dialogs. It applies the ammo's extra damage, roll-twice and combat advantage properties, notes its property in chat, and uses up one when the attack is rolled.",
    scope: "world", config: true, type: Boolean, default: true
  });
});

Hooks.once("setup", () => {
  const proto = CONFIG.Item.documentClass?.prototype;
  if (!proto?.rollAttack) return;
  if (globalThis.libWrapper) {
    libWrapper.register(MOD, "CONFIG.Item.documentClass.prototype.rollAttack", remember("attack"), "WRAPPER");
  } else {
    const orig = proto.rollAttack;
    proto.rollAttack = function (...a) { return remember("attack").call(this, orig.bind(this), ...a); };
  }
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MOD);
  mod.api ??= {};
  mod.api.ammo = { ammoInfo, ammoList, enhanceDiff, placeAreaTemplate };
});

Hooks.on("dnd4e.rollDamage", item => (pendingDamage = { actor: item?.actor, item, at: Date.now() }));
Hooks.on("renderDialog", onRenderDialog);
Hooks.on("dnd4e.rollAttack", (item, targetData) => onRollAttack(item, targetData));
Hooks.on("renderChatMessage", onRenderChatMessage);
