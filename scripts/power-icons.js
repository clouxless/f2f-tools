/**
 * Fire to Fire: standard 4e power icons (Foundry v11, dnd4e + dnd-4e-compendium)
 *
 * The compendium module ships the classic power icons as
 *   modules/dnd-4e-compendium/icons/powers/<usage>_<range>_<style>.png
 * e.g. will_melee_instant, encounter_burst_instant, daily_ranged_instant, encounter_item.
 *   - Actor sheet header "Power icons": every power with a suggested icon (from its usage and range);
 *     tick the ones to change and Apply, or click a suggestion to pick another.
 *   - Power item sheet header "Icon": a grid of all the standard icons, grouped by usage; click one.
 */

const MOD = "f2f-tools";
const DIR = "modules/dnd-4e-compendium/icons/powers";
const setting = key => game.settings.get(MOD, key);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Icons seen on powers in the Fire to Fire world, used if the folder can't be listed.
const KNOWN = `will_melee_round will_melee_instant will_ranged_instant will_ranged_round will_burst_instant will_burst_round
will_blast_instant will_area_instant will_area_round will_personal_instant will_personal_round will_move_instant
will_spirit_instant will_spirit_round will_spirit_stable encounter_melee_instant encounter_ranged_instant
encounter_burst_instant encounter_blast_instant encounter_area_instant encounter_personal_instant encounter_move_instant
encounter_wall_instant encounter_wall_stable encounter_spirit_instant encounter_weapon_instant encounter_item
daily_melee_instant daily_ranged_instant daily_burst_instant daily_burst_short daily_burst_round daily_blast_instant
daily_area_instant daily_personal_instant daily_personal_stable daily_move_instant daily_spirit_instant daily_spirit_stable
daily_wall_instant daily_item augment_melee_instant augment_ranged_instant augment_burst_instant augment_burst_short
augment_blast_instant augment_area_instant augment_area_short augment_personal_instant augment_item simple_melee simple_personal`
  .split(/\s+/).map(n => `${DIR}/${n}.png`);

let iconCache = null;
export async function loadIcons() {
  if (iconCache) return iconCache;
  try {
    const res = await FilePicker.browse("data", DIR);
    const files = (res?.files ?? []).filter(f => /\.(png|webp|jpe?g|svg)$/i.test(f));
    if (files.length) return (iconCache = files.map(f => decodeURIComponent(f)));
  } catch (err) { /* players may not be allowed to browse files */ }
  return (iconCache = KNOWN);
}

const baseName = path => path.split("/").pop().replace(/\.[^.]+$/, "");
const USAGE_LABEL = { will: "At-Will", encounter: "Encounter", daily: "Daily", augment: "Augmentable", simple: "Basic" };

/** The icon base ("daily_burst") and preferred style for a power. */
export function iconKey(item) {
  const s = item?.system ?? {};
  const text = String(s.description?.value ?? "").replace(/<[^>]+>/g, " ");
  const keywords = (text.match(/✦([^\n]{0,80})/)?.[1] ?? "") + " " + Object.keys(s.effectType ?? {}).filter(k => s.effectType[k]).join(" ");
  // Matches how the compendium iconed the Fire to Fire powers: recharge powers use the "augment" frame, other/basic the "simple" one.
  let usage = { atwill: "will", encounter: "encounter", daily: "daily", recharge: "augment", item: "encounter", other: "simple" }[s.useType] ?? "encounter";
  if (usage === "will" && /\baugment\b/i.test(text)) usage = "augment";
  if (s.useType === "item") return { base: `${usage}_item`, style: "" };
  const weapon = String(s.weaponType ?? "");
  let range = {
    melee: "melee", reach: "melee", touch: "melee", range: "ranged",
    closeBurst: "burst", closeBlast: "blast", rangeBurst: "area", rangeBlast: "area", wall: "wall",
    personal: "personal", special: "personal"
  }[s.rangeType] ?? (s.rangeType === "weapon" ? (/ranged/i.test(weapon) && !/melee/i.test(weapon) ? "ranged" : "melee") : (s.attack?.isAttack ? "melee" : "personal"));
  if (s.actionType === "move" && !s.attack?.isAttack) range = "move";
  if (/\bspirit\b/i.test(keywords)) range = "spirit";
  let style = /\b(zone|conjuration|stance)\b/i.test(keywords) ? "stable" : "instant";
  // Monsters' at-will attacks use the round frame in the compendium.
  if (style === "instant" && usage === "will" && s.attack?.isAttack && item?.actor?.type === "NPC") style = "round";
  return { base: `${usage}_${range}`, style };
}

/** The best existing icon for a power. */
export function suggestIcon(item, icons) {
  const { base, style } = iconKey(item);
  const names = icons.map(baseName);
  const pick = n => { const i = names.indexOf(n); return i >= 0 ? icons[i] : null; };
  return pick(style ? `${base}_${style}` : base) ?? pick(`${base}_instant`) ?? pick(base)
    ?? icons[names.findIndex(n => n.startsWith(base + "_"))]
    ?? pick(`${base.split("_")[0]}_personal_instant`) ?? pick(`${base.split("_")[0]}_personal`) ?? null;
}

const isStandard = (img, icons) => icons.includes(img);

/* ---------------- one power: icon grid ---------------- */

export async function pickIcon(item, { current } = {}) {
  const icons = await loadIcons();
  const now = current ?? item?.img;
  const suggested = item ? suggestIcon(item, icons) : null;
  const groups = {};
  for (const path of icons) {
    const [usage] = baseName(path).split("_");
    (groups[usage] ??= []).push(path);
  }
  const order = ["will", "encounter", "daily", "augment", "simple", ...Object.keys(groups)].filter((g, i, a) => groups[g] && a.indexOf(g) === i);
  const cell = p => `<a class="f2f-icon${p === now ? " current" : ""}${p === suggested ? " suggested" : ""}" data-path="${esc(p)}" data-tooltip="${esc(baseName(p).replace(/_/g, " "))}"><img src="${esc(p)}" alt=""></a>`;
  const content = `<div class="f2f-icon-picker">
    ${suggested ? `<p class="f2f-icon-hint">Suggested from its usage and range: <b>${esc(baseName(suggested).replace(/_/g, " "))}</b> (outlined).</p>` : ""}
    ${order.map(g => `<h4>${USAGE_LABEL[g] ?? g}</h4><div class="f2f-icon-grid">${groups[g].map(cell).join("")}</div>`).join("")}
  </div>`;
  return new Promise(resolve => {
    const dlg = new Dialog({
      title: item ? `Icon: ${item.name}` : "Power icon",
      content,
      buttons: { cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve(null) } },
      default: "cancel",
      render: html => {
        const root = html[0] ?? html;
        root.querySelectorAll(".f2f-icon").forEach(a => a.addEventListener("click", async ev => {
          ev.preventDefault();
          const path = a.dataset.path;
          resolve(path);
          dlg.close();
        }));
      },
      close: () => resolve(null)
    }, { width: 520, height: "auto", classes: ["dialog", "f2f-icon-dialog"] });
    dlg.render(true);
  });
}

export async function setItemIcon(item) {
  const path = await pickIcon(item);
  if (path && path !== item.img) await item.update({ img: path });
  return path;
}

/* ---------------- every power on a sheet ---------------- */

export async function openActorIcons(actor) {
  const icons = await loadIcons();
  const powers = actor.items.filter(i => i.type === "power").sort((a, b) => a.name.localeCompare(b.name));
  if (!powers.length) return ui.notifications.info(`${actor.name} has no powers.`);
  const choice = new Map(powers.map(p => [p.id, suggestIcon(p, icons) ?? p.img]));
  const row = p => {
    const s = choice.get(p.id);
    const same = s === p.img;
    const tick = !same && !isStandard(p.img, icons);
    return `<tr data-id="${p.id}">
      <td><input type="checkbox" ${tick ? "checked" : ""} ${same ? "disabled" : ""}></td>
      <td><img class="f2f-now" src="${esc(p.img)}" alt=""></td>
      <td class="f2f-pname">${esc(p.name)}</td>
      <td>→</td>
      <td><a class="f2f-pick" data-tooltip="Click to choose another"><img class="f2f-new" src="${esc(s)}" alt=""></a></td>
    </tr>`;
  };
  const content = `<div class="f2f-icon-bulk">
    <p class="f2f-icon-hint">Ticked powers get the icon on the right. Powers that already use a standard icon start unticked. Click an icon on the right to choose a different one.</p>
    <table><tbody>${powers.map(row).join("")}</tbody></table></div>`;
  new Dialog({
    title: `Power icons: ${actor.name}`,
    content,
    buttons: {
      apply: {
        icon: '<i class="fas fa-check"></i>', label: "Apply to ticked",
        callback: async html => {
          const root = html[0] ?? html;
          const updates = [...root.querySelectorAll("tr[data-id]")]
            .filter(tr => tr.querySelector("input")?.checked)
            .map(tr => ({ _id: tr.dataset.id, img: choice.get(tr.dataset.id) }));
          if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
          ui.notifications.info(`Updated ${updates.length} power icon${updates.length === 1 ? "" : "s"}.`);
        }
      },
      cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
    },
    default: "apply",
    render: html => {
      const root = html[0] ?? html;
      root.querySelectorAll(".f2f-pick").forEach(a => a.addEventListener("click", async ev => {
        ev.preventDefault();
        const tr = a.closest("tr");
        const item = actor.items.get(tr.dataset.id);
        const path = await pickIcon(item, { current: choice.get(item.id) });
        if (!path) return;
        choice.set(item.id, path);
        a.querySelector("img").src = path;
        const box = tr.querySelector("input");
        box.disabled = path === item.img;
        box.checked = path !== item.img;
      }));
    }
  }, { width: 460, height: "auto", classes: ["dialog", "f2f-icon-dialog"] }).render(true);
}

/* ---------------- header buttons ---------------- */

Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  const actor = sheet.actor ?? sheet.object;
  if (!setting("powerIcons") || !actor?.isOwner || !actor.items?.some(i => i.type === "power")) return;
  buttons.unshift({ label: "Power icons", class: "f2f-power-icons", icon: "fas fa-icons", onclick: () => openActorIcons(actor) });
});

Hooks.on("getItemSheetHeaderButtons", (sheet, buttons) => {
  const item = sheet.item ?? sheet.object;
  if (!setting("powerIcons") || item?.type !== "power" || !item.isOwner) return;
  buttons.unshift({ label: "Icon", class: "f2f-power-icon", icon: "fas fa-image", onclick: () => setItemIcon(item) });
});

Hooks.once("init", () => {
  game.settings.register(MOD, "powerIcons", {
    name: "Power icons: header buttons",
    hint: "Adds 'Power icons' to character and monster sheet headers (set standard 4e icons on every power at once) and 'Icon' to power sheets (pick one from a grid). Uses the icons from the D&D 4E Compendium module.",
    scope: "world", config: true, type: Boolean, default: true
  });
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MOD);
  mod.api ??= {};
  mod.api.icons = { loadIcons, iconKey, suggestIcon, pickIcon, setItemIcon, openActorIcons };
});
