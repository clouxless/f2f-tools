# Minion Groups (5e)

Keeps one combat tracker entry per group of minions, and keeps that entry (and its initiative) alive while any minion of the group is standing. For the dnd5e system on Foundry v11 and v12. Spun off from Fire to Fire: Table Tools, which keeps its own 4e copy.

## Install
In Foundry's setup screen, go to Add-on Modules > Install Module, paste this into **Manifest URL** at the bottom, and click Install:

```
https://raw.githubusercontent.com/clouxless/f2f-tools/main/minion-groups-5e/module.json
```

Then enable **Minion Groups (5e)** in the world's Manage Modules. New versions appear under Add-on Modules > Check for Updates.

## Which creatures are minions
5e has no minion role, so you choose (Configure Settings > Module Settings > Minion Groups (5e) > "Which NPCs are minions"):
- **Marked minions only** (default). Right-click an NPC in the Actors sidebar and pick **Mark as minion** (or **Unmark minion**). An NPC with a feature named "Minion", as in MCDM's Flee, Mortals!, counts automatically.
- **Every NPC.** All tokens of the same NPC on a scene share one entry, like the DMG's optional grouped initiative.

A group is every unlinked token of the same minion actor on the same scene. Linked tokens are never grouped.

**Taking a token out of its group.** Right-click the token and use the group button in the left column of the token buttons (two people = in a group, one person = on its own). A token on its own is a normal creature: it gets its own tracker entry if you add it, and no handoffs. If it was carrying the group's entry, the entry moves to another minion of the group first. Click again to rejoin.

**Minions arriving mid-fight.** A minion placed on the scene during combat joins its group automatically: the tracker count goes up, and if the group had been wiped out, its entry comes back (not defeated, same initiative) on the new minion.

## At the table
- **Adding to combat.** Select every token and toggle combat as usual. Only the first minion of each group is added; the others are skipped. Adding one by one works too.
- **Tracker name.** The entry is named after the actor with the number still standing, e.g. "Goblin (3 left)".
- **Tracked minion dies.** When the minion the entry points at drops to 0 HP, the entry moves to a living minion of the group with the same initiative and turn position, and the GM gets a whisper saying so. If another module marks the old entry defeated at the same moment, that mark is undone so the group isn't skipped.
- **Tracked minion deleted.** Same handoff when you delete its token.
- **Last minion falls.** The entry stays in the tracker, marked defeated, and the GM gets a whisper.

Each part can be turned off in Module Settings. It only acts from the GM's client, so the GM needs to be logged in.

## Optional: shared turn and group attack
The module only handles the tracker. If you want the minions to fight as one, this is the house rule the Fire to Fire game uses, in 5e terms. Paste it into a "Minion" feature on the stat block (which also marks the NPC as a minion):

> **Shared turn.** Minions that arrive together form one minion group. The group takes a single turn, and on that turn each minion can move and take its action in any order.
> **Group attack.** When the group uses a group attack, any number of its minions use their action to join in. The group makes one attack roll, with a +1 bonus for each participating minion (maximum +5), against every enemy within reach of at least one participating minion, up to one target per participating minion. A target hit takes the listed damage once for each participating minion within reach of it.

## Compatibility and testing
- Needs the dnd5e system; it reads hit points from `system.attributes.hp.value` and nothing else system-specific.
- Group Initiative style modules: with one entry per group they have nothing to collapse, so they don't interfere.
- Foundry v13 is not tested; it may install with a warning.

Tested against a mock of the Foundry v11/v12 combat, token and Actors sidebar APIs (`tests/minion-test.mjs`, run `node tests/minion-test.mjs`), 23 scenarios: batch adds, blocking later adds, count updates, handoff on death with initiative kept, an auto-defeat landing before or after the handoff, a manual defeat being respected, the last minion falling, token deletion (whether or not Foundry also removes the combatant), solo tokens and the token button, mid-fight arrivals, non-minions untouched, the "Minion" feature, the "Every NPC" setting, Mark as minion / Unmark minion, and player clients doing nothing. Not tested in a live Foundry.

## Releasing a new version
Bump `version` and the `vX.Y.Z` in the `download` link in `minion-groups-5e/module.json`, then push to `main`. The "Release Minion Groups (5e)" workflow runs the tests and publishes release `minion-groups-5e-vX.Y.Z`. It is never marked latest, so Table Tools' install link keeps pointing at Table Tools.
