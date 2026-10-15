# Fire to Fire: Table Tools (f2f-tools)

Custom Foundry module for the Fire to Fire 4e game: shroud counters, Ven's aegis ring, a conditions pop-up with 4e durations, power names on area templates, special ammunition, power icons, a Rules quick-reference tab, a mark-dead hotkey, the stat-block character sheet, Minion Groups and interface fixes. Foundry v11, dnd4e system.

## Install
In Foundry's setup screen, go to Add-on Modules > Install Module, paste this into **Manifest URL** at the bottom, and click Install:

```
https://github.com/clouxless/f2f-tools/releases/latest/download/module.json
```

Then enable **Fire to Fire: Table Tools** in the world's Manage Modules. New versions appear under Add-on Modules > Check for Updates.

All settings are under Configure Settings > Module Settings > Fire to Fire: Table Tools.

## Releasing a new version
1. Bump `version` (and the `vX.Y.Z` in `title` and in the `download` link) in `module.json`.
2. Commit and push to `main`.
3. The Release workflow sees a version with no release yet, zips the module and publishes release `vX.Y.Z` with `module.json` and `f2f-tools.zip`, which Foundry picks up.

## Character sheet changes (v1.9)
- **Grouping:** the buttons read Power Type, Action, Custom, and Power Type is the default for any character that hasn't picked one. Characters that already chose Action keep it until the player clicks Power Type.
- **Right-hand column:** under Power Type, each row shows its action (Standard, Move, Minor, Free, Interrupt, Reaction, Opportunity, No Action), because the section already says At-Will, Encounter or Daily. Under Action and Custom it shows the usage as before. The text now lines up on the right on every row, whether or not the row has a used box.
- **Clicking a power:** clicking its name uses it, the same as the icon. Clicking anywhere else on its bar opens or closes the text.
- **Custom grouping:** click Custom, then **New group** to make a labelled group. Drag powers into a group, either onto its bar or onto a power already in it, to move them there in that spot. The pencil renames a group, and the bin removes it (its powers go back to Unsorted Powers). Groups can be dragged into any order like the other sections, and **+ Add** in a group creates the new power there. Groups are saved per character and stay when switching between groupings.
- **Defenses:** AC, Fortitude, Reflex and Will now have their own band at the top of the sheet, above HP. Perception and Insight share a line to keep the block the same height.
- **Scrolling:** opening a power, marking it used or any other change no longer jumps the sheet back to the top.

Tested in Chromium with Ven's powers from the world data: 20/20 checks (default grouping, action words, column alignment in two groupings, name and bar clicks, scroll kept while opening a power, used box, defenses band, making, filling, renaming and removing custom groups, + Add in a group, groups kept across grouping changes). The harness uses a stand-in for Foundry and the dnd4e base sheet, not the real ones. Not tested in a live Foundry.

## Character sheet (v1.8)
The Fire to Fire stat-block character sheet now ships inside Table Tools; it works exactly as the separate `f2f-pc-sheet` module did (see its README in `foundry-tools/f2f-pc-sheet/`). It still needs Fox's 4e Styling for its fonts.

Moving over: turn off and delete the old "Fire to Fire: Character Sheet" module. Characters already using the sheet keep it (the sheet's internal name is unchanged), and each player's grouping, section order and pinned gear and features carry over: the sheet reads the old saved choices, and the first time the GM loads the world with v1.8 they are copied across. While the old module is still on, Table Tools leaves the sheet to it and shows the GM a reminder to turn it off.

Tested in Node with a mock (`mock-tests/sheet-test.mjs`, 11/11): every template path resolves inside f2f-tools, the sheet registers under the same name, old choices are read and copied, new choices win over old ones, and nothing registers twice while the old module is on. The character sheet thread also re-ran its full Chromium click-through against the v1.8.0 zip (render, powers, grouping, dragging, pins, Actions tab, skills, HP and death saves, rolls) with no errors. Not tested in a live Foundry.

## Shroud counters (v1.3)
A plain shroud counter (0 to 4) on any token, drawn as a large purple badge with a white number on the token's top-right corner (`shroud-badge.png`). No automation.
- **Anyone:** hover the mouse over a token and press **]** to add a shroud or **[** to remove one. Works for players on enemy tokens. Change the keys in Configure Controls > Fire to Fire: Table Tools.
- **GM:** right-click a token; a row above the token shows **−**, the count, **+** (`shroud-hud.png`).
- **Cleanup:** shrouds clear when a token drops to 0 HP and when the combat is deleted. Turn either off in Module Settings ("Shrouds: ..."). Each person can hide the badge with "Shrouds: show the badge on tokens".

Players' presses go through the GM's client, so the GM must be logged in. Quick repeated presses all count. Tokens that still show the old small icon lose it the next time their count changes.

**Damage roll clicker (v1.4.1):** when Vokun (anyone with Assassin's Shroud) rolls damage, or the target has shrouds, the dnd4e damage dialog gets a "Shrouds invoked" row with − / + . It starts at the target's shroud count and shows what gets added (hover the numbers to see where each comes from). Critical Hit or Normal adds it to the roll; Miss adds one die fewer. The invoked shrouds come off the target. Turn it off with "Shrouds: clicker in the damage roll dialog".

Modifiers it knows, found by searching Vokun's sheet for "shroud":
- **Lethal Shroud:** 1d8 per invoked shroud, +5 each at 11th level, +10 at 21st (1d6, +3 / +6 without it).
- **Shadesilk Guild:** set the clicker to 0 (not invoking) and a hit adds 1 per shroud on the target plus his Intelligence modifier.
- **Leaping Shade:** not invoking adds 1 per shroud (2 at 21st level). The power's own damage formula doesn't include this, so nothing is counted twice.
- **Skyshard Finisher:** adds twice the shrouds on the target. Its text then invokes them all, so leave the clicker at the full count.
- **Missed with a power that has no Miss line** (most of his): a "Missed: shrouds only" button rolls just the invoked shrouds, one die fewer, and takes them off.
- Not automated: **Saeth's Cambion Greatsword** (summons a Burning Devil per invoked shroud; Vokun takes 10 fire + 2 per shroud), **Inexorable Shroud** (move up to 2 shrouds when the target drops: use [ and ]), and **Targeted for Death** / **Skyshard** powers that add shrouds (press ] twice / once).
- Per the Assassin's Shroud text, shroud dice never get damage bonuses; the Flint's Ki Focus +2 and Deadly +3 stay on the attack's own damage and aren't added per shroud.

## Special ammunition (v1.5)
For Theridan (anyone with ammunition consumables): the dnd4e attack and damage dialogs get an **Ammunition** drop-down listing the ammo he still has, with counts. A line under it repeats the ammo's property.
- **Attack:** pick the ammo, press Roll. The ammo's name and property go in the chat flavor, and one is used up from his sheet. Dual Arrow sets two d20s (keep the higher); Surprise Bullet ticks Combat Advantage.
- **Damage:** the drop-down starts on the ammo that power's attack used (even if that was the last one). Normal and Critical Hit add the extra damage, typed: Lightning Arrow +2 adds 2d6 lightning, Firestorm Arrow +2 adds 2d6 fire. Miss adds nothing.
- **Enhancement:** ammo doesn't stack with the bow. The Black Bow's +4 beats all his ammo, so nothing is added; if a future arrow's plus is higher than the equipped weapon's, the difference is added.
- **Area ammo (v1.5.1):** after the attack roll, a chat card offers **Place burst 1 on <target>** for each target the area applies to: Shadowshaft on a hit or miss (its zone), Firestorm Arrow on a hit (the target and everyone adjacent). The button drops a square template over the target's space plus 1 square all round (bigger for Large creatures), labelled with the ammo's name; clicking the label shows the ammo's text. Ammo whose property says "burst N centered on the target" or "each creature adjacent to it" gets this automatically. Target the enemy before rolling, or there's no card.
- **Reminder only** (the property is in chat, apply it yourself): Summoning Bullet, Bolt of Transit, Dispelling Bolt, Onslaught Arrow, Attention-Stealing Bullet's later strikes, and Firestorm's extra fire damage to the adjacent creatures.
- Rapid Shot uses one piece of ammo per roll, not per target. Fix the count on his sheet if needed. Setting: "Ammunition: drop-down in attack and damage rolls".

## Rules quick reference (v1.7)
A **Rules** tab (open-book icon) in the sidebar, next to Settings, with the 4e glossary from the compendium database (545 entries).
- Opens on **Conditions**: the 18 glossary conditions plus Marked. **Combat** lists about 45 rules you look up mid-fight (combat advantage, ongoing damage, saving throws, flanking, cover, grab and escape, forced movement, zones, sustain and so on). **All** lists everything.
- Type in the search box to search every entry; names that match come first, then entries whose text matches.
- Click an entry to read its exact text. Click ☆ to star it; **Starred** keeps your most-used entries one click away (stars are per person). **Post to chat** shares the text with the table.
- Works for players too. Turn off with "Rules: quick-reference sidebar tab" (reload after).

## Mark dead hotkey (v1.7)
GM only. Hover a token and press **K** (or select several and press K).
- Monsters drop to 0 HP, so Drac's dead icon, Minion Groups (the tracker entry moves to a living minion), and the shroud and aegis clean-up all run as they do when you damage it to 0. The dead icon and defeated mark are also set directly, in case nothing else does.
- Player characters get the dead icon and defeated mark only; their HP is not changed.
- Pressed by mistake? Press **K** on the dead token again: the dead icon comes off and a monster gets its HP back.
- Rebind in Configure Controls > Fire to Fire: Table Tools > "Mark dead (or undo)".

## Power icons (v1.6)
Uses the standard 4e icons that come with the D&D 4E Compendium module (`modules/dnd-4e-compendium/icons/powers/`: frame by usage, shape by range, e.g. encounter burst, daily ranged, at-will melee).
- **Every power at once:** open a character or monster sheet and click **Power icons** in the title bar. Each power shows its current icon and a suggested one from its usage and range (at-will/encounter/daily, recharge uses the augment frame; melee, ranged, close burst, close blast, area, wall, personal, move; zones and stances get the "stable" style). Powers without a standard icon start ticked; click **Apply to ticked**. Click a suggested icon to choose a different one.
- **One power:** open the power and click **Icon** in its title bar, then click an icon in the grid (grouped At-Will, Encounter, Daily, Augmentable, Basic; the suggestion is outlined in blue).
- The grid lists the compendium's icon folder (GM). If the folder can't be listed (a player without file-browser permission), it uses the 52 icons already used in the Fire to Fire world.
- Checked against the 511 powers in the world that already had a compendium icon: the suggestion picks the same usage and range for 82% of them and the exact same icon for 72%. Most of the rest are judgment calls where the compendium itself varies.
- Setting: "Power icons: header buttons".

## Ven's aegis (v1.4)
A blue band around the whole token, on or off. **v1.6:** click the band to pop up the aegis power (Ven's Aegis of Assault) from the sheet of whoever applied it, or the first character with an Aegis power.
- **Anyone:** hover a token and press **\\** (backslash) to toggle it. Works for players on enemy tokens. Rebind in Configure Controls.
- **GM:** right-click a token; the shield button in the left column toggles it (lit blue when on).
- Clears at 0 HP and when the combat is deleted ("Aegis: clear at 0 HP and when combat ends"). The GM must be logged in for players' presses.

## Conditions with durations (v1.4)
Right-click a token and press the hourglass button in the left column. Tick conditions (or type one in Other), pick how long they last, press Apply. If several tokens are selected and you right-click one of them, it applies to all of them.
- **Until the end of its next turn / start of its next turn / the applier's next turn:** dnd4e removes the effect itself when Next Turn reaches that point, the same way it handles power effects. "Applied by" picks whose turn counts (defaults to the current combatant).
- **Save ends:** dnd4e prompts the saving throw at the end of the creature's turn if the system setting "Save reminders" is on.
- **Until the end of the encounter:** removed when the combat is deleted (also turn-based leftovers). Save-ends effects stay. Setting: "Conditions: clear encounter-long effects when combat ends".
- **Until removed:** stays until you delete it. The dialog lists the token's current conditions with a ✕ to remove each.
Effect names include the duration, e.g. "Dazed (save ends)", so it shows on hover and on the sheet.

## Power names on templates (v1.4)
"Place Measured Template" from a power labels the template with the power's name in the middle of the area, also while you place it. Click the name (with the mouse not over a token) to pop up the power's text. v1.6: the pop-up shows the power-card lines (usage, keywords, action, range, attack, hit, effect) in plain dark text, with the sheet's full description folded under "Full text"; colored backgrounds from the description are stripped so it stays readable. Turn off with "Templates: show the power's name". Templates placed before v1.4 show the name too, since dnd4e already stores the power on them.

## Minion Groups
Keeps one combat tracker entry per minion group, and keeps that entry (and its initiative) alive while any minion of the group is standing. Foundry v11, dnd4e.

### What counts as a group
Every minion token (dnd4e secondary role "Minion") of the same actor on the same scene. The encounter zips already place minions this way.

**Taking a token out of its group (v1.1).** Right-click the token and use the group button in the left column of the token buttons (two people = in a group, one person = on its own). A token on its own is a normal creature: it gets its own tracker entry if you add it, and no handoffs. If it was carrying the group's entry, the entry moves to another minion of the group first. Click again to rejoin.

**Minions arriving mid-fight (v1.1).** A minion placed on the scene during combat joins its group automatically: the tracker count goes up, and if the group had been wiped out, its entry comes back (not defeated, same initiative) on the new minion. Adding it to combat by hand is still skipped, since the group already has its entry.

### At the table
- **Adding to combat.** Select every token and toggle combat as usual. Only the first minion of each group is added; the others are skipped. Adding one by one works too.
- **Tracker name.** The entry is named after the actor with the number still standing, e.g. "Grappling Spirit (3 left)".
- **Tracked minion dies.** When the minion the entry points at drops to 0 HP, the entry moves to a living minion of the group with the same initiative and turn position, and you get a whisper saying so. Drac's auto-dead marker is undone on the moved entry so the group isn't skipped.
- **Tracked minion deleted.** Same handoff when you delete its token.
- **Last minion falls.** The entry stays in the tracker, marked defeated, and you get a whisper.

Each part can be turned off in Configure Settings > Module Settings. It only acts from the GM's client, so the GM needs to be logged in.

### Compatibility and testing
- **Drac's 4E Tools**: its auto-dead marks the old minion's entry defeated; this module moves the entry and clears that mark, whichever runs first.
- **Group Initiative**: it rolls and collapses groups of same-actor combatants. With one entry per group it has nothing to collapse, so they don't interfere.
- No other enabled module touches combatants or token deletion.

Tested against a mock of the Foundry v11 combat and token APIs (`mock-tests/`), 20 scenarios, including the v1.1 right-click button, solo tokens and mid-fight arrivals, plus: batch adds, blocking later adds, count updates, handoff on death with initiative kept, Drac's defeat landing before or after the handoff, a manual defeat being respected, the last minion falling, token deletion (whether or not Foundry also removes the combatant), non-minions untouched, and player clients doing nothing. Not tested in a live Foundry.

## Interface fixes
Small interface fixes for Fire to Fire. Foundry v11.

### Close button on monster sheets
The Fox NPC sheet opens 420 px wide, and Theatre Inserts adds two header buttons (Theatre, Add to Stage) to every actor sheet you own. With Sheet and Prototype Token that's too much for one line, so Foundry wraps Close onto a hidden second line.

The fix shows actor sheet header buttons as icons only, with the label as a hover tooltip, and keeps Close (with its label) from ever being squeezed out. The sheet title shortens with "..." if space is still tight.

### Long right-click menus (v1.1)
The Actors sidebar menu gets entries from Foundry, Theatre Inserts, Drac's 4E Tools, the 4e Compendium (Adjust Monster Level, MM3 Math Fixes, Find and Replace) and others, which can be taller than the screen.
- **Always on screen.** When a right-click menu would run past the top or bottom of the window, it's shortened to fit and scrolls (mouse wheel) instead. Menus that already fit are untouched. This applies to every right-click menu, not just actors.
- **Compact rows** (on by default, per player in Module Settings) fit more options before scrolling is needed.
- **Hide entries** (Module Settings, GM): type the names of Actors-menu options you never use, separated by commas, for example `Export Data, Import Data`. They disappear from the menu; turn it back by clearing the box.

Compatibility: no other enabled module changes how right-click menus are drawn. It uses libWrapper (already enabled) to add the size check after Foundry draws a menu, and only hides entries you list. Tested in Chromium with a stand-in Actors sidebar and a 14-entry menu (`../table-tweaks/menu-fit.png`): the menu ran 70 px off the top before and fit after; downward menus, already-fitting menus and the hide list were checked too. Not tested in a live Foundry.

### Compatibility and testing
It's one stylesheet plus a tooltip helper. It changes no other module's code and only restyles window header buttons on actor sheets, so Theatre's buttons still work the same (just as icons). Tested in Chromium with a stand-in for the v11 window header at 420 px, at normal and enlarged text: Close was hidden before and visible after (`../table-tweaks/header-before-after.png`). Not tested in a live Foundry.
