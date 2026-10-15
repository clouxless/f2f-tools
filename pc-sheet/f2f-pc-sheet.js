// Fire to Fire: Character Sheet
// A player character sheet laid out like a 4e stat block, styled to match Fox's 4e Styling NPC sheet.
// It extends the dnd4e system's own character sheet, so every roll, rest and dialog is the system's.
import ActorSheet4e from "../../../systems/dnd4e/module/actor/actor-sheet.js";
import { Helper } from "../../../systems/dnd4e/module/helper.js";
import { ACTIONS, ACTION_SECTIONS } from "./actions.js";

const MOD = "f2f-tools";
const OLD_MOD = "f2f-pc-sheet";
const TPL = `modules/${MOD}/pc-sheet/templates`;

/** Read a sheet flag, falling back to what the old standalone sheet module saved. */
function sheetFlag(doc, key) {
	const v = foundry.utils.getProperty(doc.flags?.[MOD] ?? {}, key);
	return v !== undefined ? v : foundry.utils.getProperty(doc.flags?.[OLD_MOD] ?? {}, key);
}

const ACTION_GROUPS = {
	standard: { label: "Standard Actions", create: "standard" },
	move: { label: "Move Actions", create: "move" },
	minor: { label: "Minor Actions", create: "minor" },
	free: { label: "Free Actions", create: "free" },
	triggered: { label: "Triggered Actions", create: "reaction" },
	other: { label: "Other Powers", create: "none" }
};
const USAGE_GROUPS = {
	atwill: { label: "At-Will Powers", create: "atwill" },
	encounter: { label: "Encounter Powers", create: "encounter" },
	daily: { label: "Daily Powers", create: "daily" },
	recharge: { label: "Recharge Powers", create: "recharge" },
	item: { label: "Item Powers", create: "item" },
	other: { label: "Other Powers", create: "other" }
};
const ACTION_WORDS = {
	standard: "Standard Action", move: "Move Action", minor: "Minor Action", free: "Free Action",
	reaction: "Immediate Reaction", interrupt: "Immediate Interrupt", opportunity: "Opportunity Action", none: "No Action"
};
const ACTION_SHORT = {
	standard: "Standard", move: "Move", minor: "Minor", free: "Free",
	reaction: "Reaction", interrupt: "Interrupt", opportunity: "Opportunity", none: "No Action"
};
const ACTION_ICONS = {
	standard: "fa-swords", move: "fa-person-running", minor: "fa-hand", free: "fa-bolt",
	reaction: "fa-reply", interrupt: "fa-hand-back-fist", opportunity: "fa-eye", none: "fa-circle"
};
const INVENTORY_TYPES = ["weapon", "equipment", "consumable", "tool", "backpack", "loot"];
const DEFENCE_NAMES = { ac: "AC", fort: "Fortitude", ref: "Reflex", wil: "Will" };
const TYPE_NAMES = { weapon: "Weapon", equipment: "Gear", consumable: "Consumable", tool: "Tool", backpack: "Container", loot: "Treasure" };

const esc = s => foundry.utils.escapeHTML ? foundry.utils.escapeHTML(String(s ?? "")) : String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export class F2FCharacterSheet extends ActorSheet4e {

	constructor(...args) {
		super(...args);
		// Which power rows are opened, per sheet window. Kept across re-renders.
		this._f2fOpen = new Set();
	}

	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			classes: ["dnd4e", "sheet", "actor", "fox4e", "f2f-pc"],
			width: 480,
			height: 820,
			tabs: [{ navSelector: ".f2f-tabs", contentSelector: ".f2f-body", initial: "main" }],
			dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }],
			scrollY: [".f2f-form"]
		});
	}

	// Keep the sheet where the player has scrolled it whenever it redraws
	// (opening a power, marking it used, changing grouping and so on).
	async _render(force, options) {
		const scrollOf = () => this.element?.[0]?.querySelector?.(".f2f-form");
		const top = scrollOf()?.scrollTop ?? 0;
		await super._render(force, options);
		if (!top) return;
		const form = scrollOf();
		if (!form) return;
		form.scrollTop = top;
		requestAnimationFrame(() => { if (form.isConnected && Math.abs(form.scrollTop - top) > 1) form.scrollTop = top; });
	}

	get template() {
		if (!game.user.isGM && this.actor.limited) return `${TPL}/limited.hbs`;
		return `${TPL}/pc-sheet.hbs`;
	}

	/* ---------- Grouping and ordering ---------- */

	// Power Type is the default; a player's saved choice wins.
	get groupBy() {
		const g = sheetFlag(this.actor, "groupBy");
		return ["action", "custom"].includes(g) ? g : "usage";
	}

	// The player's own power groups for Custom mode: [{ id, label }]
	get customGroups() {
		const g = sheetFlag(this.actor, "customGroups");
		return Array.isArray(g) ? g.filter(x => x?.id) : [];
	}

	_customGroupOf(power) {
		const item = this.actor.items.get(power._id ?? power.id) ?? power;
		const id = sheetFlag(item, "customGroup");
		return this.customGroups.some(g => g.id === id) ? id : "unsorted";
	}

	_generatePowerGroups() {
		if (this.groupBy === "custom") {
			const groups = {};
			for (const g of this.customGroups) groups[g.id] = { key: g.id, label: g.label, custom: true, items: [], dataset: { type: g.id } };
			groups.unsorted = { key: "unsorted", label: "Unsorted Powers", items: [], dataset: { type: "unsorted" } };
			return groups;
		}
		const defs = this.groupBy === "usage" ? USAGE_GROUPS : ACTION_GROUPS;
		const groups = {};
		for (const [key, def] of Object.entries(defs)) {
			groups[key] = { key, label: def.label, items: [], dataset: { type: def.create } };
		}
		return groups;
	}

	_groupPowers(power, groups) {
		const sys = power.system;
		if (this.groupBy === "custom") return this._customGroupOf(power);
		if (this.groupBy === "usage") {
			return groups[sys.useType] ? sys.useType : "other";
		}
		if (["reaction", "interrupt", "opportunity"].includes(sys.actionType) || (sys.trigger && sys.actionType !== "standard" && sys.actionType !== "move" && sys.actionType !== "minor")) return "triggered";
		return groups[sys.actionType] ? sys.actionType : "other";
	}

	// Powers always follow the player's own drag-and-drop order on this sheet.
	_sortPowers(powers) {
		for (const group of Object.values(powers)) {
			group.items.sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
		}
	}

	_sectionOrder(keys) {
		const saved = sheetFlag(this.actor, `sectionOrder.${this.groupBy}`) ?? [];
		const order = saved.filter(k => keys.includes(k));
		// Sections the player hasn't placed yet go back to their usual spot
		keys.forEach((k, i) => { if (!order.includes(k)) order.splice(Math.min(i, order.length), 0, k); });
		return order;
	}

	// New powers made with "+ Add" in Power Type mode get the right usage.
	_onPowerItemCreate(event) {
		event.preventDefault();
		const type = event.currentTarget.dataset.type;
		const system = { autoGenChatPowerCard: game.settings.get("dnd4e", "powerAutoGenerateLableOption") };
		if (this.groupBy === "custom") {
			const flags = type && type !== "unsorted" ? { [MOD]: { customGroup: type } } : {};
			return this.actor.createEmbeddedDocuments("Item", [{ name: "New Power", type: "power", system, flags }]);
		}
		if (this.groupBy === "usage") {
			system.useType = type;
			if (["encounter", "daily", "recharge", "item"].includes(type)) {
				system.uses = { value: 1, max: 1, per: ["encounter", "recharge"].includes(type) ? "enc" : "day" };
			}
		} else {
			system.actionType = type;
		}
		return this.actor.createEmbeddedDocuments("Item", [{ name: "New Power", type: "power", system }]);
	}

	/* ---------- Data ---------- */

	async getData(options) {
		const data = await super.getData(options);
		const actor = this.actor;
		const sys = actor.system;
		const cfg = CONFIG.DND4EBETA;
		const f2f = {};

		// Header
		const loc = v => (v ? game.i18n.localize(v) : "");
		const typeBits = [loc(cfg.actorSizes?.[sys.details.size]), loc(cfg.creatureOrigin?.[sys.details.origin]), loc(cfg.creatureType?.[sys.details.type])].filter(Boolean);
		const sub = [sys.details.race, sys.details.other].filter(Boolean).join(", ");
		f2f.typeLine = typeBits.join(" ").toLowerCase().replace(/^./, c => c.toUpperCase()) + (sub ? ` (${sub})` : "");
		f2f.classLine = [sys.details.paragon, sys.details.epic, sys.details.deity].filter(Boolean).join(" · ");
		f2f.defNames = DEFENCE_NAMES;
		// Free-text field; ignore leftovers like a lone comma
		const align = String(sys.details.alignment ?? "").trim();
		f2f.alignment = /[\p{L}\p{N}]/u.test(align) ? align : "";

		// Abilities in stat-block form: score (check bonus)
		f2f.abilities = ["str", "dex", "wis", "con", "int", "cha"].map(a => ({
			key: a,
			label: a.charAt(0).toUpperCase() + a.slice(1),
			value: sys.abilities[a].value,
			check: sys.abilities[a].modHalf ?? sys.abilities[a].mod
		}));

		// Trained skills for the Skills line
		f2f.trainedSkills = Object.entries(sys.skills)
			.filter(([k, s]) => (s.value ?? 0) > 0)
			.map(([k, s]) => ({ key: k, label: s.label, total: s.total }))
			.sort((a, b) => a.label.localeCompare(b.label));
		f2f.skillRows = Object.entries(sys.skills).map(([k, s]) => ({
			key: k, label: s.label, total: s.total, value: s.value, icon: s.icon, hover: s.hover,
			trained: (s.value ?? 0) > 0,
			ability: (sys.abilities[s.ability]?.label ?? s.ability ?? "").toString().slice(0, 3)
		})).sort((a, b) => a.label.localeCompare(b.label));

		// Languages and senses
		f2f.languages = [...Object.values(sys.languages?.spoken?.selected ?? {}), ...Object.values(sys.languages?.script?.selected ?? {})].filter(Boolean).map(l => game.i18n.localize(l)).join(", ");
		const senses = [...Object.values(sys.senses?.vision?.selected ?? {}), ...Object.values(sys.senses?.special?.selected ?? {})].filter(Boolean).map(l => game.i18n.localize(l));
		if (sys.senses?.notes) senses.push(sys.senses.notes);
		f2f.senses = senses.length ? senses.join(", ") : "Normal vision";

		// Resistances and vulnerabilities (the system stores both; negative values are vulnerabilities)
		const resist = [], vuln = [];
		for (const [k, r] of Object.entries(sys.resistances ?? {})) {
			const label = loc(cfg.damageTypes?.[k]) || k;
			if (r.immune) resist.push(`immune ${label}`);
			else if (r.value > 0) resist.push(`${r.value} ${label}`);
			else if (r.value < 0) vuln.push(`${-r.value} ${label}`);
		}
		f2f.resist = resist.join(", ");
		f2f.vuln = vuln.join(", ");

		// Death saves and second wind
		const fails = Number(sys.details.deathsavefail) || 0;
		f2f.deathPips = [1, 2, 3].map(n => ({ n, on: fails >= n }));
		f2f.magicUses = sys.magicItemUse?.perDay ?? 0;
		f2f.halfLevel = Math.floor((sys.details.level ?? 0) / 2);

		// Equipment line: equipped weapons and implements always, plus whatever the player pinned.
		const inv = actor.items.filter(i => INVENTORY_TYPES.includes(i.type)).sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
		const autoEq = inv.filter(i => i.type === "weapon" && i.system.equipped);
		const pinned = inv.filter(i => !(i.type === "weapon" && i.system.equipped) && sheetFlag(i, "pinned"));
		f2f.equipment = [...autoEq.map(i => ({ id: i.id, name: i.name, auto: true })), ...pinned.map(i => ({ id: i.id, name: i.name }))];

		// Gear tab: equipped, carried, consumables, everything else
		const row = i => ({
			id: i.id, name: i.name, img: i.img, qty: i.system.quantity ?? 1, equipped: !!i.system.equipped,
			canEquip: ["weapon", "equipment"].includes(i.type),
			auto: i.type === "weapon" && i.system.equipped,
			pinned: !!sheetFlag(i, "pinned"),
			slot: i.type === "weapon" ? (i.system.properties?.imp || i.system.properties?.impA || i.system.properties?.impD ? "Implement" : "Weapon")
				: (i.type === "equipment" && loc(cfg.equipmentTypes?.[i.system.armour?.type])) || TYPE_NAMES[i.type] || i.type
		});
		f2f.gear = [
			{ label: "Equipped", type: "equipment", items: inv.filter(i => ["weapon", "equipment"].includes(i.type) && i.system.equipped).map(row) },
			{ label: "Weapons and Gear Carried", type: "weapon", items: inv.filter(i => ["weapon", "equipment", "tool", "backpack"].includes(i.type) && !i.system.equipped).map(row) },
			{ label: "Consumables", type: "consumable", qty: true, items: inv.filter(i => i.type === "consumable").map(row) },
			{ label: "Treasure", type: "loot", qty: true, items: inv.filter(i => i.type === "loot").map(row) }
		];
		f2f.currency = Object.entries(sys.currency ?? {}).filter(([k, v]) => v).map(([k, v]) => `${v} ${k}`).join(", ");

		// Features: pinned ones become Traits on Main
		f2f.features = data.features.filter(s => s.dataset.type !== "ritual").map(s => ({
			label: game.i18n.localize(s.label), type: s.dataset.type,
			items: s.items.map(i => ({ id: i.id, name: i.name, img: i.img, pinned: !!sheetFlag(i, "pinned") }))
		}));
		f2f.rituals = data.features.find(s => s.dataset.type === "ritual")?.items ?? [];
		f2f.traits = actor.items.filter(i => !INVENTORY_TYPES.includes(i.type) && i.type !== "power" && i.type !== "ritual" && sheetFlag(i, "pinned"))
			.sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name))
			.map(i => ({ id: i.id, name: i.name, img: i.img, open: this._f2fOpen.has(i.id), body: i.system.description?.value ?? "" }));

		// Powers, in the player's section order
		const groups = Object.fromEntries(data.powers.map(g => [g.key, g]));
		const order = this._sectionOrder(["traits", ...Object.keys(groups)]);
		const actorObj = actor.toObject(false);
		f2f.powerSections = [];
		for (const key of order) {
			if (key === "traits") { f2f.powerSections.push({ key, isTraits: true }); continue; }
			const g = groups[key];
			if (!g) continue;
			const items = g.items.map(p => this._powerRow(p, actorObj));
			if (!items.length && ["other", "recharge", "item"].includes(key)) continue;
			if (!items.length && key === "unsorted" && this.customGroups.length) continue;
			f2f.powerSections.push({ key, label: g.label, dataset: g.dataset, items, custom: !!g.custom, isCustomMode: this.groupBy === "custom", usage: this.groupBy === "usage" ? key : "" });
		}
		f2f.groupBy = this.groupBy;
		f2f.isCustom = this.groupBy === "custom";
		f2f.hasTraits = f2f.traits.length > 0;

		// Actions tab: the actions every character has
		f2f.actionSections = this._actionSections();

		data.f2f = f2f;
		return data;
	}

	_actionCheck(roll) {
		const sys = this.actor.system;
		const ab = sys.abilities[roll.ability];
		let v = ab.modHalf ?? (ab.mod + Math.floor((sys.details.level ?? 0) / 2));
		if (!roll.check) v += Number(sys.modifiers?.attack?.value) || 0;
		return v;
	}

	_actionText(a) {
		const m = this.actor.system.movement;
		const vars = { speed: m.walk.value, run: m.run.value, shift: m.shift.value, shiftS: Number(m.shift.value) === 1 ? "" : "s" };
		const fill = t => t.replace(/\{(\w+)\}/g, (x, k) => vars[k] ?? x);
		const lines = a.lines.map(([label, text]) => ({ label, text: fill(text) }));
		if (a.roll) {
			const v = this._actionCheck(a.roll);
			const what = a.roll.check ? "Strength check" : "Strength attack";
			lines.push({ label: "Roll", text: `${what} ${v >= 0 ? "+" : ""}${v} vs. ${a.roll.vs}` });
		}
		return lines;
	}

	_actionSections() {
		const skills = this.actor.system.skills;
		return ACTION_SECTIONS.map(sec => ({
			...sec,
			items: ACTIONS.filter(a => a.action === sec.key).map(a => {
				const open = this._f2fOpen.has(`act-${a.key}`);
				return {
					key: a.key, name: a.name, source: a.source, sys: a.sys ?? "", rolls: !!a.roll, open,
					icon: ACTION_ICONS[a.action === "triggered" ? "opportunity" : a.action],
					lines: open ? this._actionText(a) : [],
					skills: open ? (a.skills ?? []).map(k => ({ key: k, label: skills[k]?.label ?? k, total: skills[k]?.total })) : []
				};
			})
		}));
	}

	async _useAction(key, event) {
		const a = ACTIONS.find(x => x.key === key);
		if (!a) return;
		if (a.sys === "second-wind") return this._onSecondWind(event);
		if (a.sys === "action-point") return this._onActionPointDialog(event);
		const lines = this._actionText(a);
		const word = { standard: "Standard Action", move: "Move Action", minor: "Minor Action", free: "Free Action", triggered: "Triggered Action" }[a.action];
		const content = `<div class="f2f-chat-action"><h3>${esc(a.name)}</h3><p><em>${word}</em></p>${lines.map(l => `<p><b>${esc(l.label)}:</b> ${esc(l.text)}</p>`).join("")}</div>`;
		const speaker = ChatMessage.getSpeaker({ actor: this.actor });
		if (a.roll) {
			const v = this._actionCheck(a.roll);
			const roll = await new Roll(`1d20 + ${v}`).evaluate({ async: true });
			return roll.toMessage({ speaker, flavor: content });
		}
		return ChatMessage.create({ speaker, content });
	}

	_powerRow(p, actorObj) {
		const sys = p.system;
		const use = sys.useType || "other";
		const open = this._f2fOpen.has(p.id);
		const hasUses = !!sys.uses?.per && (sys.preparedMaxUses > 0);
		const useLabel = game.i18n.localize(CONFIG.DND4EBETA.powerUseType?.[use] ?? "") || "";
		const row = {
			id: p.id, name: p.name, img: p.img, use,
			// Grouped by Power Type, the section already says the usage, so the row shows the action instead.
			typeLabel: this.groupBy === "usage" ? (ACTION_SHORT[sys.actionType] ?? useLabel) : useLabel,
			actionWord: ACTION_WORDS[sys.actionType] ?? "",
			icon: ACTION_ICONS[sys.actionType] ?? "fa-circle",
			hasUses,
			// Encounter and daily powers always get a used box; one with no uses set gets them on first click.
			trackUse: hasUses || ["encounter", "daily"].includes(use),
			spent: hasUses && !(sys.uses.value > 0),
			multiUse: hasUses && sys.preparedMaxUses > 1,
			uses: sys.uses?.value, maxUses: sys.preparedMaxUses,
			notAvailable: !!sys.notAvailable,
			recharge: use === "recharge" && sys.rechargeRoll ? `${sys.rechargeRoll}+` : "",
			open
		};
		if (open) row.body = this._powerBody(p, actorObj);
		return row;
	}

	_attackBonus(p) {
		const sys = p.system;
		if (!sys.attack?.isAttack || !sys.attack.formula) return null;
		try {
			const weapon = Helper.getWeaponUse(sys, this.actor);
			const formula = Helper.commonReplace(sys.attack.formula, this.actor, sys, weapon?.system);
			const v = Roll.safeEval(formula);
			return Number.isFinite(v) ? v : null;
		} catch (e) {
			return null;
		}
	}

	_keywords(sys) {
		const cfg = CONFIG.DND4EBETA;
		const tags = [];
		if (sys.powersource) tags.push(game.i18n.localize(cfg.powerSource[sys.powersource] ?? sys.powersource));
		if (sys.secondPowersource && sys.secondPowersource !== sys.powersource) tags.push(game.i18n.localize(cfg.powerSource[sys.secondPowersource] ?? sys.secondPowersource));
		if (["melee", "meleeRanged", "ranged"].includes(sys.weaponType)) tags.push("Weapon");
		else if (sys.weaponType === "implement") tags.push("Implement");
		for (const [k, on] of Object.entries(sys.damageType ?? {})) if (on && k !== "physical" && cfg.damageTypes[k]) tags.push(game.i18n.localize(cfg.damageTypes[k]));
		for (const [k, on] of Object.entries(sys.effectType ?? {})) if (on && cfg.effectTypes[k]) tags.push(game.i18n.localize(cfg.effectTypes[k]));
		return [...new Set(tags)].sort();
	}

	_rangeText(sys) {
		const area = sys.area ?? "";
		switch (sys.rangeType) {
			case "weapon": return sys.weaponType === "ranged" ? "Ranged weapon" : "Melee weapon";
			case "melee": return `Melee ${sys.rangePower ?? ""}`.trim();
			case "reach": return `Reach ${sys.rangePower ?? ""}`.trim();
			case "range": return `Ranged ${sys.rangePower ?? ""}`.trim();
			case "closeBurst": return `Close burst ${area}`;
			case "closeBlast": return `Close blast ${area}`;
			case "rangeBurst": return `Area burst ${area} within ${sys.rangePower}`;
			case "rangeBlast": return `Area blast ${area} within ${sys.rangePower}`;
			case "wall": return `Area wall ${area} within ${sys.rangePower}`;
			case "touch": return "Melee touch";
			case "personal": return "Personal";
			case "special": return "Special";
			default: return "";
		}
	}

	// The power as a stat-block entry. Built only for opened rows.
	_powerBody(p, actorObj) {
		const sys = p.system;
		const cfg = CONFIG.DND4EBETA;
		const L = k => game.i18n.localize(k);
		const out = [];
		const line = (label, text) => { if (text) out.push(`<p class="hang"><b>${label}:</b> ${text}</p>`); };

		// Powers with structured details are shown as a stat-block entry with worked-out attack bonuses.
		// Powers with only written text show that text.
		const structured = sys.attack?.isAttack || sys.hit?.detail || sys.effect?.detail || sys.miss?.detail;
		if (!structured) return `<div class="f2f-desc">${sys.description?.value ?? ""}</div>`;
		const flavour = sys.chatFlavor || (sys.description?.value ?? "").match(/<p class="flavou?r">([\s\S]*?)<\/p>/)?.[1]?.replace(/<[^>]+>/g, "").trim();
		if (flavour) out.push(`<p class="flavour">${esc(flavour)}</p>`);
		const kw = this._keywords(sys);
		const useLabel = L(cfg.powerUseType?.[sys.useType] ?? "");
		out.push(`<p><b>${esc(useLabel)}${kw.length ? " ✦ " + esc(kw.join(", ")) : ""}</b></p>`);
		out.push(`<p><b>${esc(ACTION_WORDS[sys.actionType] ?? "")}</b></p>`);
		line(L("DND4EBETA.Requirements"), esc(sys.requirement));
		line(L("DND4EBETA.Trigger"), esc(sys.trigger));

		const range = this._rangeText(sys);
		const target = typeof sys.target === "string" ? sys.target : "";
		if (sys.attack?.isAttack) {
			const bonus = this._attackBonus(p);
			const vs = DEFENCE_NAMES[sys.attack.def] ?? sys.attack.def ?? "";
			const hit = bonus === null ? `${esc(L(cfg.abilities?.[sys.attack.ability] ?? "") || "Attack")} vs. ${esc(vs)}` : `${bonus >= 0 ? "+" : ""}${bonus} vs. ${esc(vs)}`;
			line(L("DND4EBETA.Attack"), `${esc(range)}${target ? ` (${esc(target)})` : ""}${range || target ? "; " : ""}${hit}`);
		} else if (range && sys.rangeType !== "personal") {
			line(L("DND4EBETA.Target"), `${esc(range)}${target ? ` (${esc(target)})` : ""}`);
		} else if (target) {
			line(L("DND4EBETA.Target"), esc(target));
		}
		if (!sys.postEffect) line(L("DND4EBETA.Effect"), esc(sys.effect?.detail));
		line(L("DND4EBETA.Hit"), esc(sys.hit?.detail));
		line(L("DND4EBETA.Miss"), esc(sys.miss?.detail));
		if (sys.postEffect) line(L("DND4EBETA.Effect"), esc(sys.effect?.detail));
		if (sys.sustain?.actionType && sys.sustain.actionType !== "none") line(`${L("DND4EBETA.Sustain")} ${esc(ACTION_WORDS[sys.sustain.actionType] ?? "")}`, esc(sys.sustain.detail));
		line(L("DND4EBETA.Special"), esc(sys.special));

		let html = out.join("");
		try { html = Helper.commonReplace(html, actorObj); } catch (e) { /* keep text as written */ }
		return html;
	}

	/* ---------- Listeners ---------- */

	activateListeners(html) {
		super.activateListeners(html);
		const el = html[0];

		// A power's heading bar opens and closes it; its name, icon and controls do their own thing.
		html.find(".f2f-power > .f2f-ph").on("click", ev => {
			if (ev.target.closest("a, input, button, .f2f-handle, .item-control, .rollable")) return;
			ev.preventDefault();
			const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
			if (this._f2fOpen.has(id)) this._f2fOpen.delete(id); else this._f2fOpen.add(id);
			this.render(false);
		});

		// Clicking a power's name uses it, the same as its icon (owners only; others just open it).
		html.find(".f2f-power .f2f-use-name").on("click", ev => {
			ev.preventDefault();
			ev.stopPropagation();
			if (this.isEditable) return this._onItemRoll(ev);
			const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
			if (this._f2fOpen.has(id)) this._f2fOpen.delete(id); else this._f2fOpen.add(id);
			this.render(false);
		});

		// Open and close trait and action rows (anyone who can see the sheet)
		html.find(".f2f-row-toggle").on("click", ev => {
			ev.preventDefault();
			const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId ?? ev.currentTarget.closest("[data-act]")?.dataset.act;
			if (!id) return;
			if (this._f2fOpen.has(id)) this._f2fOpen.delete(id); else this._f2fOpen.add(id);
			this.render(false);
		});

		if (!this.isEditable) return;

		// Actions tab: post the action to chat, roll its check, or run the system's own dialog
		html.find(".f2f-act-use").on("click", ev => {
			ev.preventDefault();
			const key = ev.currentTarget.closest("[data-act]")?.dataset.act?.replace(/^act-/, "");
			this._useAction(key, ev);
		});

		// Group powers by
		html.find(".f2f-group button").on("click", ev => {
			ev.preventDefault();
			this.actor.setFlag(MOD, "groupBy", ev.currentTarget.dataset.group);
		});

		// Custom groups: make, rename and remove
		html.find(".f2f-newgroup").on("click", ev => { ev.preventDefault(); this._editCustomGroup(); });
		html.find(".f2f-group-rename").on("click", ev => {
			ev.preventDefault(); ev.stopPropagation();
			this._editCustomGroup(ev.currentTarget.closest("[data-sec]").dataset.sec);
		});
		html.find(".f2f-group-delete").on("click", ev => {
			ev.preventDefault(); ev.stopPropagation();
			this._deleteCustomGroup(ev.currentTarget.closest("[data-sec]").dataset.sec);
		});

		// Used box on encounter, daily, item and recharge powers
		html.find(".f2f-spent").on("click", ev => {
			ev.preventDefault();
			ev.stopPropagation();
			const item = this.actor.items.get(ev.currentTarget.closest("[data-item-id]").dataset.itemId);
			if (!item) return;
			if (!item.system.uses?.per || !(item.system.preparedMaxUses > 0)) {
				// No uses set on this power yet: give it the standard 1 per encounter or per day, already used.
				return item.update({ "system.uses": { value: 0, max: 1, per: item.system.useType === "daily" ? "day" : "enc" } });
			}
			const max = item.system.preparedMaxUses;
			item.update({ "system.uses.value": item.system.uses.value > 0 ? 0 : max });
		});

		// Pins: gear onto the Equipment line, features into Traits
		html.find(".f2f-pin").on("click", ev => {
			ev.preventDefault();
			ev.stopPropagation();
			const item = this.actor.items.get(ev.currentTarget.closest("[data-item-id]").dataset.itemId);
			if (item) item.setFlag(MOD, "pinned", !sheetFlag(item, "pinned"));
		});

		// Death save pips set the number of failed saves
		html.find(".f2f-death .pip").on("click", ev => {
			ev.preventDefault();
			const n = Number(ev.currentTarget.dataset.n);
			const cur = Number(this.actor.system.details.deathsavefail) || 0;
			this.actor.update({ "system.details.deathsavefail": cur >= n ? n - 1 : n });
		});

		// Section bars drag to reorder sections
		for (const bar of el.querySelectorAll(".f2f-sec[data-sec]")) {
			bar.setAttribute("draggable", "true");
			bar.addEventListener("dragstart", ev => {
				ev.stopPropagation();
				ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "f2fSection", key: bar.dataset.sec }));
				bar.closest(".f2f-secwrap")?.classList.add("dragging");
			});
			bar.addEventListener("dragend", () => bar.closest(".f2f-secwrap")?.classList.remove("dragging"));
		}
		for (const wrap of el.querySelectorAll(".f2f-secwrap[data-sec]")) {
			wrap.addEventListener("dragover", ev => {
				if (!ev.dataTransfer.types.includes("text/plain")) return;
				ev.preventDefault();
				wrap.classList.add("over");
			});
			wrap.addEventListener("dragleave", () => wrap.classList.remove("over"));
			wrap.addEventListener("drop", ev => {
				wrap.classList.remove("over");
				let data;
				try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; }
				if (data?.type !== "f2fSection") return;
				ev.preventDefault();
				ev.stopPropagation();
				const keys = [...el.querySelectorAll(".f2f-secwrap[data-sec]")].map(w => w.dataset.sec);
				const from = keys.indexOf(data.key);
				if (from < 0 || data.key === wrap.dataset.sec) return;
				keys.splice(from, 1);
				keys.splice(keys.indexOf(wrap.dataset.sec), 0, data.key);
				this.actor.setFlag(MOD, `sectionOrder.${this.groupBy}`, keys);
			});
		}
	}

	/* ---------- Custom groups ---------- */

	async _editCustomGroup(id) {
		const groups = foundry.utils.deepClone(this.customGroups);
		const g = groups.find(x => x.id === id);
		const label = await new Promise(resolve => new Dialog({
			title: g ? "Rename power group" : "New power group",
			content: `<form><div class="form-group"><label>Name</label><input type="text" name="label" value="${esc(g?.label ?? "")}" placeholder="e.g. Opening moves" autofocus></div></form>`,
			buttons: {
				ok: { icon: '<i class="fas fa-check"></i>', label: g ? "Rename" : "Create", callback: html => resolve(html.find("[name=label]").val()?.trim()) },
				cancel: { label: "Cancel", callback: () => resolve(null) }
			},
			default: "ok",
			close: () => resolve(null)
		}).render(true));
		if (!label) return;
		if (g) g.label = label;
		else groups.push({ id: foundry.utils.randomID(8), label });
		return this.actor.setFlag(MOD, "customGroups", groups);
	}

	async _deleteCustomGroup(id) {
		const g = this.customGroups.find(x => x.id === id);
		if (!g) return;
		const ok = await Dialog.confirm({ title: "Remove power group", content: `<p>Remove the group <b>${esc(g.label)}</b>? Its powers move to Unsorted Powers.</p>` });
		if (!ok) return;
		await this.actor.setFlag(MOD, "customGroups", this.customGroups.filter(x => x.id !== id));
		const moved = this.actor.items.filter(i => i.type === "power" && sheetFlag(i, "customGroup") === id).map(i => ({ _id: i.id, [`flags.${MOD}.customGroup`]: null }));
		if (moved.length) await this.actor.updateEmbeddedDocuments("Item", moved);
	}

	// Powers dropped onto another power's row take its place in the order.
	// In Custom mode, a power dropped anywhere in a group also joins that group.
	async _onSortItem(event, itemData) {
		const source = this.actor.items.get(itemData._id);
		if (!source) return;
		const dropTarget = event.target.closest("[data-item-id]");
		const target = dropTarget ? this.actor.items.get(dropTarget.dataset.itemId) : null;
		let groupUpdate = null;
		if (this.groupBy === "custom" && source.type === "power") {
			const sec = event.target.closest(".f2f-secwrap[data-sec]")?.dataset.sec;
			if (sec && sec !== "traits") {
				const want = sec === "unsorted" ? null : sec;
				const have = this._customGroupOf(source) === "unsorted" ? null : this._customGroupOf(source);
				if (want !== have) groupUpdate = { [`flags.${MOD}.customGroup`]: want };
			}
		}
		if (!target || target.id === source.id || target.type !== "power" && groupUpdate) {
			if (groupUpdate) return source.update(groupUpdate);
			return;
		}
		// Features and traits sort among all non-inventory feature types
		const sameKind = i => source.type === "power" ? i.type === "power"
			: INVENTORY_TYPES.includes(source.type) ? INVENTORY_TYPES.includes(i.type)
			: (!INVENTORY_TYPES.includes(i.type) && i.type !== "power");
		if (!sameKind(target)) return;
		const siblings = this.actor.items.filter(i => sameKind(i) && i.id !== source.id);
		const updates = SortingHelpers.performIntegerSort(source, { target, siblings, sortBefore: true }).map(u => ({ _id: u.target.id, ...u.update }));
		if (groupUpdate) {
			const own = updates.find(u => u._id === source.id);
			if (own) Object.assign(own, groupUpdate); else updates.push({ _id: source.id, ...groupUpdate });
		}
		return this.actor.updateEmbeddedDocuments("Item", updates);
	}
}

Hooks.once("init", () => {
	// The standalone sheet module registers the same class; let it win until it is turned off.
	if (game.modules.get(OLD_MOD)?.active) {
		Hooks.once("ready", () => {
			if (game.user.isGM) ui.notifications.warn("Fire to Fire: the character sheet is now part of Table Tools. Disable the old \"Fire to Fire: Character Sheet\" module.", { permanent: true });
		});
		return;
	}
	Actors.registerSheet("dnd4eBeta", F2FCharacterSheet, {
		types: ["Player Character"],
		label: "Fire to Fire character (stat block)",
		makeDefault: false
	});
	Handlebars.registerHelper("f2fSigned", v => {
		const n = Number(v);
		if (!Number.isFinite(n)) return v ?? "";
		return n >= 0 ? `+${n}` : `${n}`;
	});
	Handlebars.registerHelper("f2fEq", (a, b) => a === b);
	loadTemplates([
		`${TPL}/parts/main.hbs`,
		`${TPL}/parts/power-section.hbs`,
		`${TPL}/parts/skills.hbs`,
		`${TPL}/parts/gear.hbs`,
		`${TPL}/parts/features.hbs`,
		`${TPL}/parts/manage.hbs`,
		`${TPL}/parts/actions.hbs`
	]);
});

// One-time copy of the old module's saved flags into this module's scope (GM only).
Hooks.once("ready", async () => {
	if (!game.user.isGM || game.modules.get(OLD_MOD)?.active) return;
	const copy = doc => {
		const old = doc.flags?.[OLD_MOD];
		if (!old || doc.flags?.[MOD]?.sheetMigrated) return null;
		return { _id: doc.id, [`flags.${MOD}`]: foundry.utils.mergeObject(foundry.utils.deepClone(old), { ...(doc.flags?.[MOD] ?? {}), sheetMigrated: true }) };
	};
	for (const actor of game.actors) {
		const items = actor.items.map(copy).filter(Boolean);
		if (items.length) await actor.updateEmbeddedDocuments("Item", items);
		const a = copy(actor);
		if (a) { delete a._id; await actor.update(a); }
	}
});
