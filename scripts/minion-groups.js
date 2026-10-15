/**
 * Fire to Fire: Minion Groups (Foundry v11, dnd4e)
 *
 * A minion group is every minion token of the same actor on the same scene
 * (dnd4e: system.details.role.secondary === "minion"). The group gets one combatant.
 * When the minion that combatant points at drops to 0 HP or is deleted, the combatant
 * (and its initiative) is handed to a living minion of the group.
 */

const MOD = "f2f-tools";
const RECENT_MS = 3000;
const recentHandoffs = new Map(); // combatant id -> time of our last handoff

const setting = key => game.settings.get(MOD, key);
export const isMinion = actor => actor?.system?.details?.role?.secondary === "minion";
const hp = doc => Number(doc?.actor?.system?.attributes?.hp?.value ?? 1);
const isAlive = doc => hp(doc) > 0;

function responsibleGM() {
  return game.users.filter(u => u.isGM && u.active).sort((a, b) => (a.id > b.id ? 1 : -1))[0];
}
const iAmResponsibleGM = () => responsibleGM()?.id === game.user.id;

/** Removed from its group by hand (token right-click button). */
export const isSolo = tokenDoc => !!tokenDoc?.flags?.[MOD]?.solo;
/** An unlinked minion that hasn't been pulled out of its group. */
export const isGrouped = t => !!t && !t.actorLink && isMinion(t.actor) && !isSolo(t);

/** Every grouped minion token in the same group as this token (including it). */
export function groupOf(tokenDoc) {
  if (!isGrouped(tokenDoc)) return [];
  return (tokenDoc.parent?.tokens ?? []).filter(t => t.actorId === tokenDoc.actorId && isGrouped(t));
}
const groupKey = tokenDoc => `${tokenDoc.parent?.id}.${tokenDoc.actorId}`;

function combatantToken(c) {
  return c.token ?? game.scenes.get(c.sceneId)?.tokens.get(c.tokenId) ?? null;
}

/** Display name for the group's tracker entry, e.g. "Grappling Spirit (3 left)". */
function groupName(tokenDoc, alive) {
  const base = tokenDoc.actor?.name ?? tokenDoc.name;
  return setting("showCount") ? `${base} (${alive} left)` : base;
}

async function whisperGM(content) {
  if (!setting("notify")) return;
  return ChatMessage.create({ content, whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Minion Groups" } });
}

/**
 * Move a combatant off a dead/removed minion onto a living one of its group.
 * @param {Combatant} c
 * @param {TokenDocument} [from]   the minion it is leaving (defaults to the combatant's token)
 */
export async function handOff(c, from = combatantToken(c)) {
  if (!isGrouped(from)) return false;
  const living = groupOf(from).filter(t => t.id !== from.id && isAlive(t));
  const takenIds = new Set(c.parent.combatants.filter(o => o.id !== c.id).map(o => o.tokenId));
  const next = living.find(t => !takenIds.has(t.id));
  const label = from.actor?.name ?? from.name;
  if (!next) {
    if (groupOf(from).length > 1 || from.parent?.tokens.get(from.id) === undefined) {
      if (c.parent.combatants.has(c.id) && !c.defeated) await c.update({ defeated: true });
      await whisperGM(`<b>${label}</b>: the last minion of the group is down.`);
    }
    return false;
  }
  recentHandoffs.set(c.id, Date.now());
  await c.update({ tokenId: next.id, actorId: next.actorId, defeated: false, name: groupName(next, living.length), img: null });
  await whisperGM(`<b>${label}</b>: initiative ${c.initiative ?? "(not rolled)"} moved to another minion of the group (${living.length} left).`);
  return true;
}

/** Combatants (in any combat) that track a token of this group. */
function groupCombatants(tokenDoc) {
  const key = groupKey(tokenDoc);
  const out = [];
  for (const combat of game.combats ?? []) {
    for (const c of combat.combatants) {
      const t = combatantToken(c);
      if (isGrouped(t) && groupKey(t) === key) out.push(c);
    }
  }
  return out;
}

/** Living grouped minions of an actor on a scene, optionally ignoring tokens that are being deleted. */
function livingMembers(scene, actorId, skip = new Set()) {
  return (scene?.tokens ?? []).filter(t => t.actorId === actorId && isGrouped(t) && isAlive(t) && !skip.has(t.id));
}

/** Update the "(N left)" name on every tracker entry of this group. Works after a member was deleted. */
async function refreshGroup(scene, actorId) {
  if (!setting("showCount") || !scene) return;
  const alive = livingMembers(scene, actorId).length;
  if (!alive) return;
  for (const combat of game.combats ?? []) {
    for (const c of combat.combatants) {
      if (c.sceneId !== scene.id) continue;
      const t = combatantToken(c);
      if (!isGrouped(t) || t.actorId !== actorId) continue;
      if (c.name !== groupName(t, alive)) await c.update({ name: groupName(t, alive) });
    }
  }
}
const refreshCounts = tokenDoc => refreshGroup(tokenDoc?.parent, tokenDoc?.actorId);

/* ---------------- hooks ---------------- */

// One entry per group: block extra minions of a group that is already in the combat.
function onPreCreateCombatant(combatant, data, options) {
  if (!setting("oneEntry")) return true;
  const combat = combatant.parent;
  const scene = game.scenes.get(data.sceneId ?? combat?.scene?.id ?? canvas.scene?.id);
  const tok = scene?.tokens.get(data.tokenId);
  if (!isGrouped(tok)) return true;
  const key = groupKey(tok);
  options.f2fMinionGroups ??= [];
  const already = options.f2fMinionGroups.includes(key) ||
    combat.combatants.some(c => { const t = combatantToken(c); return isGrouped(t) && groupKey(t) === key; });
  if (already) return false;
  options.f2fMinionGroups.push(key);
  return true;
}

async function onCreateCombatant(c) {
  if (!iAmResponsibleGM()) return;
  const t = combatantToken(c);
  if (!t || groupOf(t).length < 2) return;
  if (setting("showCount")) await c.update({ name: groupName(t, groupOf(t).filter(isAlive).length) });
}

async function onUpdateActor(actor, change) {
  if (!iAmResponsibleGM()) return;
  if (change?.system?.attributes?.hp?.value === undefined) return;
  const tok = actor.isToken ? actor.token : null;
  if (!isGrouped(tok)) return;
  if (!isAlive(tok)) {
    for (const combat of game.combats ?? []) {
      const c = combat.combatants.find(x => x.tokenId === tok.id);
      if (c) await handOff(c);
    }
  }
  await refreshCounts(tok);
}

async function onUpdateCombatant(c, change) {
  if (!iAmResponsibleGM() || change.defeated !== true) return;
  const t = combatantToken(c);
  if (!isGrouped(t)) return;
  if (!isAlive(t)) return handOff(c);
  // Another module (Drac's auto-dead) marked the old minion defeated just after we moved the entry.
  if (Date.now() - (recentHandoffs.get(c.id) ?? 0) < RECENT_MS) await c.update({ defeated: false });
}

/*
 * Deleting minions. Foundry also removes a deleted token's combatant, so the group's entry is
 * moved to a living minion *before* the deletion reaches the server (requests are handled in
 * order). If the entry was removed anyway, it is re-created with the same initiative.
 * Several tokens deleted together are handled as one batch.
 */
const lastBatches = [];
let deleteBatch = null; // { ids:Set, groups:Map(key->{scene,actorId}), snaps:[], done:Promise }

function onPreDeleteToken(tokenDoc) {
  if (!game.user.isGM || !isGrouped(tokenDoc)) return;
  if (!deleteBatch) {
    deleteBatch = { ids: new Set(), groups: new Map(), snaps: [] };
    const batch = deleteBatch;
    lastBatches.unshift(batch); lastBatches.length = Math.min(lastBatches.length, 5);
    batch.done = Promise.resolve().then(() => processDeletes(batch));
  }
  deleteBatch.ids.add(tokenDoc.id);
  deleteBatch.groups.set(groupKey(tokenDoc), { scene: tokenDoc.parent, actorId: tokenDoc.actorId, name: tokenDoc.actor?.name ?? tokenDoc.name });
  for (const combat of game.combats ?? [])
    for (const c of combat.combatants)
      if (c.tokenId === tokenDoc.id && c.sceneId === tokenDoc.parent?.id)
        deleteBatch.snaps.push({ combatId: combat.id, combatantId: c.id, initiative: c.initiative, hidden: c.hidden, key: groupKey(tokenDoc) });
}

async function processDeletes(batch) {
  if (deleteBatch === batch) deleteBatch = null;
  for (const snap of batch.snaps) {
    const g = batch.groups.get(snap.key);
    const c = game.combats.get(snap.combatId)?.combatants.get(snap.combatantId);
    if (!c) continue;
    const taken = new Set(c.parent.combatants.filter(o => o.id !== c.id).map(o => o.tokenId));
    const living = livingMembers(g.scene, g.actorId, batch.ids);
    const next = living.find(t => !taken.has(t.id));
    if (!next) continue; // last of the group: let the entry go with the token
    snap.movedTo = next.id;
    recentHandoffs.set(c.id, Date.now());
    await c.update({ tokenId: next.id, actorId: next.actorId, defeated: false, name: groupName(next, living.length), img: null });
    await whisperGM(`<b>${g.name}</b>: initiative ${c.initiative ?? "(not rolled)"} moved to another minion of the group (${living.length} left).`);
  }
}

async function onDeleteToken(tokenDoc) {
  const batch = [deleteBatch].find(b => b?.ids.has(tokenDoc.id)) ?? lastBatches.find(b => b.ids.has(tokenDoc.id));
  if (!batch) return;
  await batch.done;
  batch.handled ??= new Set();
  if (batch.handled.has(tokenDoc.id)) return;
  batch.handled.add(tokenDoc.id);
  // Entry removed with the token anyway: put the group back with the same initiative.
  for (const snap of batch.snaps) {
    if (snap.readded) continue;
    const combat = game.combats.get(snap.combatId);
    if (!combat || combat.combatants.get(snap.combatantId)) continue;
    const g = batch.groups.get(snap.key);
    const living = livingMembers(g.scene, g.actorId, batch.ids);
    if (!living.length) continue;
    if (combat.combatants.some(c => c.sceneId === g.scene.id && isGrouped(combatantToken(c)) && combatantToken(c).actorId === g.actorId)) continue;
    snap.readded = true;
    await combat.createEmbeddedDocuments("Combatant", [{
      tokenId: living[0].id, sceneId: g.scene.id, actorId: g.actorId,
      initiative: snap.initiative, hidden: snap.hidden, name: groupName(living[0], living.length)
    }]);
    await whisperGM(`<b>${g.name}</b>: initiative ${snap.initiative ?? "(not rolled)"} moved to another minion of the group (${living.length} left).`);
  }
  for (const g of batch.groups.values()) await refreshGroup(g.scene, g.actorId);
}

/** A minion placed mid-fight joins its group: the count updates, and a wiped-out group's entry comes back on it. */
async function onCreateToken(tokenDoc) {
  if (!iAmResponsibleGM() || !isGrouped(tokenDoc)) return;
  const living = groupOf(tokenDoc).filter(isAlive);
  for (const c of groupCombatants(tokenDoc)) {
    const t = combatantToken(c);
    if (c.defeated || !t || !isAlive(t)) {
      recentHandoffs.set(c.id, Date.now());
      await c.update({ tokenId: tokenDoc.id, actorId: tokenDoc.actorId, defeated: false, name: groupName(tokenDoc, living.length), img: null });
      await whisperGM(`<b>${tokenDoc.actor?.name ?? tokenDoc.name}</b>: a new minion joined; the group is back in the fight with initiative ${c.initiative ?? "(not rolled)"}.`);
    }
  }
  await refreshCounts(tokenDoc);
}

/* ---------------- removing a token from its group ---------------- */

/**
 * Pull a minion out of its group (solo) or put it back. A solo minion is a normal
 * creature: its own tracker entry, no handoffs. If it was the one carrying the
 * group's tracker entry, the entry moves to another living minion of the group first.
 */
export async function setSolo(tokenDoc, solo) {
  if (!tokenDoc || tokenDoc.actorLink || !isMinion(tokenDoc.actor)) return;
  if (solo === isSolo(tokenDoc)) return;
  if (solo) {
    for (const combat of game.combats ?? []) {
      const c = combat.combatants.find(x => x.tokenId === tokenDoc.id && x.sceneId === tokenDoc.parent?.id);
      if (!c) continue;
      const living = groupOf(tokenDoc).filter(t => t.id !== tokenDoc.id && isAlive(t));
      const taken = new Set(combat.combatants.map(o => o.tokenId));
      const next = living.find(t => !taken.has(t.id));
      if (next) {
        await c.update({ tokenId: next.id, actorId: next.actorId, name: groupName(next, living.length), img: null });
        await whisperGM(`<b>${tokenDoc.name}</b> left its group; the group's initiative ${c.initiative ?? "(not rolled)"} moved to another minion. Add ${tokenDoc.name} to combat on its own if it fights.`);
      } else {
        await c.update({ name: null });
      }
    }
    await tokenDoc.update({ [`flags.${MOD}.solo`]: true });
  } else {
    await tokenDoc.update({ [`flags.${MOD}.-=solo`]: null });
  }
  await refreshCounts(tokenDoc);
  const mate = (tokenDoc.parent?.tokens ?? []).find(t => t.id !== tokenDoc.id && isGrouped(t) && t.actorId === tokenDoc.actorId);
  if (mate) await refreshCounts(mate);
}

function onRenderTokenHUD(hud, html) {
  if (!game.user.isGM) return;
  const doc = hud.object?.document;
  if (!doc || doc.actorLink || !isMinion(doc.actor)) return;
  const solo = isSolo(doc);
  const btn = document.createElement("div");
  btn.className = `control-icon f2f-minion-solo${solo ? " active" : ""}`;
  btn.dataset.tooltip = solo ? "Not in a minion group: click to rejoin" : "In a minion group: click to remove this token";
  btn.innerHTML = `<i class="fas ${solo ? "fa-user" : "fa-users"}"></i>`;
  btn.addEventListener("click", async ev => {
    ev.preventDefault();
    await setSolo(doc, !isSolo(doc));
    hud.render();
  });
  (html[0] ?? html).querySelector(".col.left")?.append(btn);
}

Hooks.once("init", () => {
  const reg = (key, name, hint) => game.settings.register(MOD, key, { name, hint, scope: "world", config: true, type: Boolean, default: true });
  reg("oneEntry", "Minion groups: one tracker entry per group", "Adding several minions of the same actor to combat adds only the first; the rest share its initiative.");
  reg("showCount", "Minion groups: show minions left", "Name the group's tracker entry after the actor with the number of living minions, e.g. \"Grappling Spirit (3 left)\".");
  reg("notify", "Minion groups: whisper handoffs to the GM", "Whisper a short note when the group's entry moves to another minion or the group is wiped out.");
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MOD);
  mod.api ??= {};
  mod.api.minions = { handOff, groupOf, isMinion, isSolo, setSolo };
});

Hooks.on("preCreateCombatant", onPreCreateCombatant);
Hooks.on("renderTokenHUD", onRenderTokenHUD);
Hooks.on("createCombatant", c => onCreateCombatant(c));
Hooks.on("updateActor", (a, ch) => onUpdateActor(a, ch));
Hooks.on("updateCombatant", (c, ch) => onUpdateCombatant(c, ch));
Hooks.on("preDeleteToken", t => { onPreDeleteToken(t); });
Hooks.on("deleteToken", t => onDeleteToken(t));
Hooks.on("createToken", t => onCreateToken(t));
