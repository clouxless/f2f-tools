// Mock of the Foundry v11/v12 combat/token surfaces used by minion-groups-5e, plus scenarios.
// Run: node tests/minion-test.mjs ../scripts/minion-groups-5e.js  (path relative to this file)
import assert from "node:assert/strict";

const log = { chat: [], warn: [] };
class Hooksys {
  constructor() { this.h = {}; }
  on(n, f) { (this.h[n] ??= []).push(f); }
  once(n, f) { this.on(n, f); }
  async callAll(n, ...a) { for (const f of this.h[n] ?? []) await f(...a); }
  call(n, ...a) { for (const f of this.h[n] ?? []) if (f(...a) === false) return false; return true; }
}
globalThis.Hooks = new Hooksys();
globalThis.ChatMessage = { create: async d => log.chat.push(d) };
globalThis.ui = { notifications: { warn: m => log.warn.push(m) } };

class Coll extends Map {
  get contents() { return [...this.values()]; }
  filter(f) { return this.contents.filter(f); } map(f) { return this.contents.map(f); } find(f) { return this.contents.find(f); } some(f) { return this.contents.some(f); }
  [Symbol.iterator]() { return this.values(); }
}

let idn = 0;
const actors = new Coll();
class Actor {
  constructor(name, minion = true, hp = 1, how = "flag") {
    this.id = "act" + idn++; this.name = name; this.type = "npc"; this.system = { attributes: { hp: { value: hp } } };
    this.flags = minion && how === "flag" ? { "minion-groups-5e": { minion: true } } : {};
    this.items = minion && how === "feature" ? [{ name: "Minion" }] : [];
    actors.set(this.id, this);
  }
  async update(diff) {
    for (const [path, v] of Object.entries(diff)) {
      const parts = path.split("."); let o = this;
      for (const k of parts.slice(0, -1)) o = o[k] ??= {};
      const last = parts.at(-1);
      if (last.startsWith("-=")) delete o[last.slice(2)]; else o[last] = v;
    }
    // synthetic token actors see the base actor's flags
    for (const sc of game.scenes) for (const t of sc.tokens) if (t.actorId === this.id) t.actor.flags = structuredClone(this.flags);
  }
}
class TokenDoc {
  constructor(scene, actor, name) {
    this.id = "tok" + idn++; this.parent = scene; this.actorId = actor.id; this.actorLink = false; this.name = name ?? actor.name;
    // unlinked: each token gets its own synthetic actor
    this.actor = { type: actor.type, items: actor.items, flags: structuredClone(actor.flags), system: structuredClone(actor.system), isToken: true, token: this, name: actor.name };
    this.flags = {};
  }
  async update(diff) {
    for (const [path, v] of Object.entries(diff)) {
      const parts = path.split("."); let o = this;
      for (const k of parts.slice(0, -1)) o = o[k] ??= {};
      const last = parts.at(-1);
      if (last.startsWith("-=")) delete o[last.slice(2)]; else o[last] = v;
    }
    await Hooks.callAll("updateToken", this, diff);
  }
  async setHp(v) { this.actor.system.attributes.hp.value = v; await Hooks.callAll("updateActor", this.actor, { system: { attributes: { hp: { value: v } } } }); }
}
class Scene {
  constructor() { this.id = "scn" + idn++; this.tokens = new Coll(); }
  add(actor, name) { const t = new TokenDoc(this, actor, name); this.tokens.set(t.id, t); return t; }
  async place(actor, name) { const t = this.add(actor, name); await Hooks.callAll("createToken", t); return t; }
  async deleteToken(t, coreDeletesCombatant) {
    if (Hooks.call("preDeleteToken", t) === false) return;
    this.tokens.delete(t.id);
    if (coreDeletesCombatant) for (const c of game.combats) for (const cb of c.combatants) if (cb.tokenId === t.id) c.combatants.delete(cb.id);
    await Hooks.callAll("deleteToken", t);
  }
}
class Combatant {
  constructor(combat, d) { Object.assign(this, { initiative: null, hidden: false, defeated: false, name: null, img: null }, d); this.id = "cbt" + idn++; this.parent = combat; }
  get token() { return game.scenes.get(this.sceneId)?.tokens.get(this.tokenId) ?? null; }
  async update(diff) {
    const real = Object.fromEntries(Object.entries(diff).filter(([k, v]) => this[k] !== v));
    if (!Object.keys(real).length) return;
    Object.assign(this, real);
    await Hooks.callAll("updateCombatant", this, real);
  }
}
class Combat {
  constructor(scene) { this.id = "cmb" + idn++; this.scene = scene; this.combatants = new Coll(); }
  async createEmbeddedDocuments(type, list) {
    const options = {}; const made = [];
    for (const d of list) {
      const c = new Combatant(this, { sceneId: d.sceneId ?? this.scene.id, ...d });
      if (Hooks.call("preCreateCombatant", c, d, options) === false) continue;
      this.combatants.set(c.id, c); made.push(c);
    }
    for (const c of made) await Hooks.callAll("createCombatant", c);
    return made;
  }
}

const settings = new Map();
const gm = { id: "gm", isGM: true, active: true };
globalThis.game = {
  user: gm, users: [gm], combats: new Coll(), scenes: new Coll(), actors,
  settings: { register: (m, k, o) => settings.set(k, o.default), get: (m, k) => settings.get(k), set: (m, k, v) => settings.set(k, v) },
  modules: { get: (() => { const m = {}; return () => m; })() },
};
globalThis.canvas = { scene: null };

await import(new URL(process.argv[2] ?? "../scripts/minion-groups-5e.js", import.meta.url));
await Hooks.callAll("init"); await Hooks.callAll("ready");

const scene = new Scene(); game.scenes.set(scene.id, scene); canvas.scene = scene;
const spirit = new Actor("Grappling Spirit"), wolf = new Actor("Winter Spirit", true, 1, "feature"), boss = new Actor("Andelier", false, 480);
const sp = [1, 2, 3, 4].map(i => scene.add(spirit, `Grappling Spirit ${i}`));
const wf = [1, 2].map(i => scene.add(wolf, `Winter Spirit ${i}`));
const bossTok = scene.add(boss);
const combat = new Combat(scene); game.combats.set(combat.id, combat);
const entry = actor => combat.combatants.filter(c => c.token?.actorId === actor.id || c.actorId === actor.id);
let api_, soloTok;
const refreshAll = async () => {};
const settle = () => new Promise(r => setTimeout(r, 0));

const tests = [];
const check = (n, f) => tests.push([n, f]);

check("adding all six minions plus the boss in one go gives one entry per group", async () => {
  await combat.createEmbeddedDocuments("Combatant", [...sp, ...wf, bossTok].map(t => ({ tokenId: t.id, actorId: t.actorId })));
  assert.equal(combat.combatants.size, 3);
  assert.equal(entry(spirit)[0].tokenId, sp[0].id);
  assert.equal(entry(spirit)[0].name, "Grappling Spirit (4 left)");
  assert.equal(entry(boss)[0].name, null, "non-minions untouched");
});

check("adding another spirit later is blocked", async () => {
  await combat.createEmbeddedDocuments("Combatant", [{ tokenId: sp[2].id, actorId: spirit.id }]);
  assert.equal(entry(spirit).length, 1);
});

check("killing an untracked spirit just updates the count", async () => {
  entry(spirit)[0].initiative = 17;
  await sp[3].setHp(0);
  const c = entry(spirit)[0];
  assert.equal(c.tokenId, sp[0].id); assert.equal(c.name, "Grappling Spirit (3 left)");
});

check("killing the tracked spirit moves the entry with its initiative to a living one", async () => {
  await sp[0].setHp(-2);
  const c = entry(spirit)[0];
  assert.equal(c.tokenId, sp[1].id); assert.equal(c.initiative, 17); assert.equal(c.defeated, false);
  assert.equal(c.name, "Grappling Spirit (2 left)");
  assert.match(log.chat.at(-1).content, /initiative 17 moved/);
  assert.deepEqual(log.chat.at(-1).whisper, ["gm"]);
});

check("another module's auto-defeat marking the entry defeated right after the move is undone", async () => {
  const c = entry(spirit)[0];
  await c.update({ defeated: true });
  await settle();
  assert.equal(c.defeated, false);
});

check("marking a living group defeated by hand later is respected", async () => {
  const c = entry(wolf)[0];
  await c.update({ defeated: true });
  assert.equal(c.defeated, true);
  await c.update({ defeated: false });
});

check("an auto-defeat on a dead tracked minion (before our HP hook) also moves it", async () => {
  const c = entry(wolf)[0]; c.initiative = 9;
  wf[0].actor.system.attributes.hp.value = 0; // HP changed, our hook not yet run
  await c.update({ defeated: true });
  assert.equal(c.tokenId, wf[1].id); assert.equal(c.defeated, false); assert.equal(c.initiative, 9);
});

check("last minion of a group dies: entry stays, marked defeated, GM told", async () => {
  await wf[1].setHp(0);
  const c = entry(wolf)[0];
  assert.equal(c.defeated, true);
  assert.match(log.chat.at(-1).content, /last minion of the group is down/);
});

check("deleting the tracked token hands off (combatant kept by core)", async () => {
  const c = entry(spirit)[0];
  await scene.deleteToken(sp[1], false);
  assert.equal(c.tokenId, sp[2].id); assert.equal(c.initiative, 17);
});

check("deleting the tracked token when core also deletes the combatant re-adds the group with the same initiative", async () => {
  const extra = scene.add(spirit, "Grappling Spirit 5");
  await scene.deleteToken(sp[2], true);
  const c = entry(spirit);
  assert.equal(c.length, 1); assert.equal(c[0].tokenId, extra.id); assert.equal(c[0].initiative, 17);
});

check("boss dying does nothing special", async () => {
  const before = log.chat.length;
  await bossTok.setHp(0);
  assert.equal(log.chat.length, before);
});

check("non-GM clients don't act", async () => {
  game.user = { id: "p1", isGM: false, active: true }; game.users.push(game.user);
  const c = entry(spirit)[0]; const before = c.tokenId;
  const t = scene.tokens.get(before); t.actor.system.attributes.hp.value = 0;
  await Hooks.callAll("updateActor", t.actor, { system: { attributes: { hp: { value: 0 } } } });
  assert.equal(c.tokenId, before);
  game.user = gm;
});


check("solo: pulling an untracked spirit out drops the group count", async () => {
  const api = game.modules.get().api; api_ = api;
  const before = entry(spirit)[0].name;
  const loner = scene.add(spirit, "Grappling Spirit Loner");
  await refreshAll();
  await api.setSolo(loner, true);
  assert.equal(loner.flags["minion-groups-5e"].solo, true);
  assert.equal(entry(spirit)[0].name, before);
  soloTok = loner;
});

check("solo minion can be added to combat as its own entry", async () => {
  await combat.createEmbeddedDocuments("Combatant", [{ tokenId: soloTok.id, actorId: spirit.id }]);
  assert.equal(combat.combatants.filter(c => c.tokenId === soloTok.id).length, 1);
});

check("solo minion dying does not touch the group entry", async () => {
  const g = combat.combatants.find(c => c.tokenId !== soloTok.id && c.actorId === spirit.id);
  const before = g.tokenId;
  await soloTok.setHp(0);
  assert.equal(g.tokenId, before);
  assert.equal(combat.combatants.find(c => c.tokenId === soloTok.id).tokenId, soloTok.id, "solo entry stays on its own token");
});

check("making the tracked minion solo moves the group entry to another minion first", async () => {
  const api = game.modules.get().api;
  const a = scene.add(spirit, "Grappling Spirit 6"), b = scene.add(spirit, "Grappling Spirit 7");
  const g = combat.combatants.find(c => c.tokenId !== soloTok.id && c.actorId === spirit.id);
  const tracked = scene.tokens.get(g.tokenId);
  await api.setSolo(tracked, true);
  assert.notEqual(g.tokenId, tracked.id); assert.equal(g.initiative, 17);
  assert.match(log.chat.at(-1).content, /left its group/);
  await api.setSolo(tracked, false);
  assert.equal(tracked.flags["minion-groups-5e"].solo, undefined);
});

check("HUD button only for the GM on minions, and it toggles", async () => {
  const mkHtml = () => { const kids = []; const col = { append: e => kids.push(e) }; return { kids, html: [{ querySelector: () => col }] }; };
  globalThis.document = { createElement: () => { const l = {}; return { dataset: {}, addEventListener: (e, f) => (l[e] = f), click: () => l.click({ preventDefault() {} }) }; } };
  const t = scene.tokens.get(entry(spirit)[0].tokenId);
  let h = mkHtml(); let rendered = 0;
  await Hooks.callAll("renderTokenHUD", { object: { document: t }, render: () => rendered++ }, h.html);
  assert.equal(h.kids.length, 1); assert.match(h.kids[0].innerHTML, /fa-users/);
  await h.kids[0].click(); await settle();
  assert.equal(t.flags["minion-groups-5e"]?.solo, true); assert.equal(rendered, 1);
  await game.modules.get().api.setSolo(t, false);
  h = mkHtml();
  await Hooks.callAll("renderTokenHUD", { object: { document: bossTok }, render() {} }, h.html);
  assert.equal(h.kids.length, 0, "no button on non-minions");
});

check("a new minion placed mid-fight joins its group and the count goes up", async () => {
  const c = entry(spirit)[0];
  await scene.place(spirit, "Grappling Spirit Reinforcement");
  const living = scene.tokens.filter(t => t.actorId === spirit.id && !t.flags["minion-groups-5e"]?.solo && t.actor.system.attributes.hp.value > 0).length;
  assert.equal(c.name, `Grappling Spirit (${living} left)`);
  console.log("    living spirits:", scene.tokens.filter(t => t.actorId === spirit.id).map(t => `${t.name}:${t.actor.system.attributes.hp.value}${t.flags["minion-groups-5e"]?.solo ? ":solo" : ""}`).join(", "));
});

check("a new minion for a wiped-out group brings its entry back with the old initiative", async () => {
  const c = entry(wolf)[0];
  assert.equal(c.defeated, true);
  const fresh = await scene.place(wolf, "Winter Spirit 3");
  assert.equal(c.tokenId, fresh.id); assert.equal(c.defeated, false); assert.equal(c.initiative, 9);
  assert.equal(c.name, "Winter Spirit (1 left)");
  assert.match(log.chat.at(-1).content, /back in the fight with initiative 9/);
});

check("adding the new minion to combat by hand is still blocked", async () => {
  const fresh = scene.add(wolf, "Winter Spirit 4");
  await combat.createEmbeddedDocuments("Combatant", [{ tokenId: fresh.id, actorId: wolf.id }]);
  assert.equal(entry(wolf).length, 1);
});

check("an unmarked NPC with several tokens is not grouped", async () => {
  const ogre = new Actor("Ogre", false, 59);
  const [o1, o2] = [scene.add(ogre), scene.add(ogre)];
  await combat.createEmbeddedDocuments("Combatant", [o1, o2].map(t => ({ tokenId: t.id, actorId: t.actorId })));
  assert.equal(entry(ogre).length, 2);
  assert.ok(entry(ogre).every(c => c.name === null));
});

check("\"Every NPC\" setting groups unmarked NPCs", async () => {
  game.settings.set("minion-groups-5e", "which", "all");
  const bandit = new Actor("Bandit", false, 11);
  const bs = [scene.add(bandit), scene.add(bandit), scene.add(bandit)];
  await combat.createEmbeddedDocuments("Combatant", bs.map(t => ({ tokenId: t.id, actorId: t.actorId })));
  assert.equal(entry(bandit).length, 1); assert.equal(entry(bandit)[0].name, "Bandit (3 left)");
  game.settings.set("minion-groups-5e", "which", "marked");
});

check("Actors sidebar: Mark as minion / Unmark minion", async () => {
  const kobold = new Actor("Kobold", false, 5);
  const opts = []; await Hooks.callAll("getActorDirectoryEntryContext", null, opts);
  const [mark, unmark] = opts;
  const li = { data: k => (k === "documentId" ? kobold.id : undefined) };
  assert.equal(mark.condition(li), true); assert.equal(unmark.condition(li), false);
  const ks = [scene.add(kobold), scene.add(kobold)];
  await mark.callback(li);
  assert.equal(kobold.flags["minion-groups-5e"].minion, true);
  assert.equal(mark.condition(li), false); assert.equal(unmark.condition(li), true);
  await combat.createEmbeddedDocuments("Combatant", ks.map(t => ({ tokenId: t.id, actorId: t.actorId })));
  assert.equal(entry(kobold).length, 1);
  await unmark.callback(li);
  assert.equal(kobold.flags["minion-groups-5e"]?.minion, undefined);
  game.user = { id: "p1", isGM: false }; assert.equal(mark.condition(li), false); game.user = gm;
});

let fail = 0;
for (const [n, f] of tests) { try { await f(); console.log("PASS", n); } catch (e) { fail++; console.log("FAIL", n, "\n   ", e.message); } }
console.log(`\n${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
