/**
 * Fire to Fire: mark a token dead with one key (Foundry v11, dnd4e). GM only.
 *
 * Hover a token (or select some) and press K:
 *   - Monsters: HP goes to 0, so everything that reacts to 0 HP runs as usual (Drac's dead icon and
 *     defeated mark, Minion Groups handing the tracker entry on, shrouds and aegis clearing). The dead
 *     icon and the defeated mark are also set here, in case nothing else does.
 *   - Player characters: the dead icon and defeated mark only; their HP is left alone.
 * Press K again on a dead token to undo it: the dead icon comes off and a monster gets its HP back.
 */

const MOD = "f2f-tools";
const DEAD = () => CONFIG.specialStatusEffects?.DEFEATED ?? "dead";
const deadEffect = () => CONFIG.statusEffects.find(e => e.id === DEAD());

const isDead = doc => !!(doc.actor?.statuses?.has?.(DEAD()) || doc.overlayEffect === deadEffect()?.icon || doc.flags?.[MOD]?.killed);

async function setDeadIcon(doc, on) {
  const effect = deadEffect();
  if (!effect || !doc.object) return;
  const has = !!doc.actor?.statuses?.has?.(effect.id);
  if (has !== on) await doc.object.toggleEffect(effect, { overlay: true, active: on });
}

async function setDefeated(doc, on) {
  for (const combat of game.combats ?? []) {
    const updates = combat.combatants.filter(c => c.tokenId === doc.id && c.sceneId === doc.parent?.id && c.defeated !== on).map(c => ({ _id: c.id, defeated: on }));
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates);
  }
}

export async function kill(token) {
  const doc = token?.document ?? token;
  const actor = doc?.actor;
  if (!actor) return;
  if (doc.flags?.[MOD]?.killed || isDead(doc)) return revive(doc);
  const hp = actor.system?.attributes?.hp;
  const monster = actor.type !== "Player Character";
  await doc.update({ [`flags.${MOD}.killed`]: { hp: monster ? hp?.value ?? null : null } });
  if (monster && hp && hp.value > 0) await actor.update({ "system.attributes.hp.value": 0 });
  await new Promise(r => setTimeout(r, 50)); // let 0-HP reactions (Drac's tools, Minion Groups) run first
  await setDeadIcon(doc, true);
  await setDefeated(doc, true);
}

export async function revive(token) {
  const doc = token?.document ?? token;
  const actor = doc?.actor;
  if (!actor) return;
  const before = doc.flags?.[MOD]?.killed?.hp;
  await doc.update({ [`flags.${MOD}.-=killed`]: null });
  if (before > 0) await actor.update({ "system.attributes.hp.value": before });
  await new Promise(r => setTimeout(r, 50));
  await setDeadIcon(doc, false);
  await setDefeated(doc, false);
}

function onKey() {
  if (!game.user.isGM) return false;
  const hover = canvas?.tokens?.hover;
  const tokens = hover ? [hover] : canvas?.tokens?.controlled ?? [];
  if (!tokens.length) return false;
  // Same action for all: if the hovered/first token is alive, kill them all; otherwise revive them all.
  const killing = !isDead(tokens[0].document);
  for (const t of tokens) (killing ? (isDead(t.document) ? null : kill(t)) : (isDead(t.document) ? revive(t) : null));
  return true;
}

Hooks.once("init", () => {
  game.keybindings.register(MOD, "killToken", {
    name: "Mark dead (or undo)",
    hint: "GM: marks the token under the mouse (or your selected tokens) dead. Monsters drop to 0 HP. Press again on a dead token to undo.",
    editable: [{ key: "KeyK" }], onDown: () => onKey(), restricted: true
  });
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MOD);
  mod.api ??= {};
  mod.api.kill = { kill, revive, isDead };
});
