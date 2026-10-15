/**
 * Fire to Fire: power names on area templates (Foundry v11, dnd4e)
 *
 * When a power's "Place Measured Template" makes a template, the template shows the power's name
 * in the middle of its area (and while it's being placed). dnd4e already stores the item on the
 * template (flags.dnd4e.item); we also save the name and the power's uuid in flags.f2f-tools.
 * Clicking the name pops up the power's text (the same power card the system posts to chat).
 */

const MOD = "f2f-tools";
const setting = key => game.settings.get(MOD, key);

export function labelFor(doc, item) {
  const f = doc?.flags ?? {};
  const stored = f.dnd4e?.item;
  return f[MOD]?.label ?? item?.name ?? stored?.name ?? stored?._source?.name ?? "";
}

// dnd4e's placement preview object carries the item (AbilityTemplate.item); remember it for creation.
let lastPreview = null;

/** Middle of the template's shape, in the template's own coordinates. */
function shapeCenter(shape) {
  if (!shape) return { x: 0, y: 0 };
  if (shape.radius !== undefined) return { x: shape.x ?? 0, y: shape.y ?? 0 };
  if (shape.width !== undefined) return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
  const p = shape.points ?? [];
  if (!p.length) return { x: 0, y: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < p.length; i += 2) { minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]); minY = Math.min(minY, p[i + 1]); maxY = Math.max(maxY, p[i + 1]); }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export function drawLabel(template) {
  if (!template || template.destroyed) return;
  if (template.item && !template.document?.id) lastPreview = { item: template.item, at: Date.now() };
  const name = setting("templateLabels") ? labelFor(template.document, template.item) : "";
  let text = template.f2fLabel;
  if (!name) {
    if (text && !text.destroyed) text.destroy();
    template.f2fLabel = null;
    return;
  }
  if (!text || text.destroyed) {
    const size = Math.max(18, Math.round((canvas?.dimensions?.size ?? 100) * 0.28));
    const style = globalThis.PreciseText?.getTextStyle?.({ fontSize: size, strokeThickness: 4 })
      ?? new PIXI.TextStyle({ fontFamily: "Signika, Arial, sans-serif", fontSize: size, fill: 0xffffff, stroke: 0x000000, strokeThickness: 4 });
    style.fontWeight = "bold";
    style.align = "center";
    style.wordWrap = true;
    style.wordWrapWidth = (canvas?.dimensions?.size ?? 100) * 4;
    text = new (globalThis.PreciseText ?? PIXI.Text)(name, style);
    text.anchor.set(0.5, 0.5);
    text.eventMode = "none";
    template.f2fLabel = text;
  }
  if (text.parent !== template) template.addChild(text);
  if (text.text !== name) text.text = name;
  const c = shapeCenter(template.shape);
  text.position.set(c.x, c.y);
}

function onPreCreate(doc, data, options, userId) {
  if (data?.flags?.[MOD]?.label || !data?.flags?.dnd4e?.templateType) return;
  const recent = userId === game.user.id && lastPreview && Date.now() - lastPreview.at < 120000 ? lastPreview.item : null;
  const name = recent?.name ?? labelFor(doc);
  if (!name) return;
  doc.updateSource({ [`flags.${MOD}.label`]: name, [`flags.${MOD}.itemUuid`]: recent?.uuid ?? null });
  lastPreview = null;
}

/* ---------------- click the name to read the power ---------------- */

async function findItem(doc) {
  const uuid = doc.flags?.[MOD]?.itemUuid;
  const item = uuid ? await fromUuid(uuid).catch(() => null) : null;
  if (item) return item;
  const stored = doc.flags?.dnd4e?.item;
  const data = stored?._source ?? stored;
  if (!data?.system) return null;
  try { return new CONFIG.Item.documentClass(data); } catch { return null; }
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** The power's text as HTML: dnd4e's own power card when possible, otherwise built from the fields. */
/** The power's text as HTML: dnd4e's own power-card lines, then the full description folded away. */
export async function powerHtml(item) {
  const s = item.system ?? {};
  let lines = "", desc = s.description?.value ?? "";
  if (!item.type || item.type === "power") {
    try {
      const { Helper } = await import("../../../systems/dnd4e/module/helper.js");
      const chat = await item.getChatData();
      lines = Helper._preparePowerCardData(chat, CONFIG, item.actor);
      if (item.actor) lines = Helper.commonReplace(lines, item.actor, item, Helper.getWeaponUse(s, item.actor)?.system, 1);
      desc = chat.description?.value ?? desc;
    } catch (err) {
      const line = (label, v) => (v ? `<p><b>${label}:</b> ${v}</p>` : "");
      lines = `${line("Requirement", s.requirement)}${line("Trigger", s.trigger)}${typeof s.target === "string" ? line("Target", s.target) : ""}
        ${s.attack?.isAttack ? line("Attack", `${esc(s.attack.ability ?? "")} vs. ${esc(String(s.attack.def ?? "").toUpperCase())}`) : ""}
        ${line("Hit", s.hit?.detail)}${line("Miss", s.miss?.detail)}${line("Effect", s.effect?.detail)}${line("Special", s.special)}
        ${s.sustain?.detail ? line("Sustain", s.sustain.detail) : ""}`;
    }
  }
  const hasLines = lines.replace(/<[^>]+>/g, "").trim().length > 0;
  const full = desc ? (hasLines ? `<details class="f2f-pc-full"><summary>Full text</summary>${desc}</details>` : `<div class="f2f-pc-full">${desc}</div>`) : "";
  return `${hasLines ? `<div class="f2f-pc-lines">${lines}</div>` : ""}${full}`;
}

/** Show a power (or any item) in a readable pop-up. */
export async function showItem(item, fallbackName = "") {
  const name = item?.name ?? fallbackName;
  const body = item ? await powerHtml(item) : "<p>That power can't be found any more.</p>";
  const who = item?.actor?.name ? ` <span class="f2f-power-owner">${esc(item.actor.name)}</span>` : "";
  new Dialog({
    title: name || "Power",
    content: `<div class="f2f-power-text f2f-usage-${esc(item?.system?.useType ?? "other")}">
      <h3 class="f2f-power-name">${esc(name)}${who}</h3>${body}</div>`,
    buttons: { close: { icon: '<i class="fas fa-times"></i>', label: "Close" } },
    default: "close"
  }, { width: 440, classes: ["dialog", "f2f-power-dialog"] }).render(true);
}

export async function showPower(template) {
  const doc = template.document ?? template;
  const item = template.item ?? await findItem(doc);
  return showItem(item, labelFor(doc, item));
}

/** Which labelled template's name is under this canvas point, if any. */
export function labelAt(point) {
  for (const t of [...(canvas.templates?.placeables ?? [])].reverse()) {
    const text = t.f2fLabel;
    if (!text || text.destroyed || !t.visible) continue;
    const x = t.document.x + text.x, y = t.document.y + text.y;
    const pad = 6;
    if (Math.abs(point.x - x) <= text.width / 2 + pad && Math.abs(point.y - y) <= text.height / 2 + pad) return t;
  }
  return null;
}

function onBoardClick(ev) {
  if (!setting("templateLabels") || ev.button !== 0) return;
  if (canvas.templates?.preview?.children?.length) return; // still placing a template
  if (canvas.tokens?.hover) return; // clicks on tokens stay token clicks
  const point = canvas.canvasCoordinatesFromClient?.({ x: ev.clientX, y: ev.clientY });
  const t = point && labelAt(point);
  if (t) showPower(t);
}

Hooks.once("init", () => {
  game.settings.register(MOD, "templateLabels", {
    name: "Templates: show the power's name",
    hint: "Area templates placed from a power show the power's name in the middle of the area. Click the name to read the power.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => canvas?.templates?.placeables?.forEach(drawLabel)
  });
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MOD);
  mod.api ??= {};
  mod.api.templates = { labelFor, drawLabel, showPower, showItem, powerHtml, labelAt };
});

Hooks.on("canvasReady", () => {
  const view = canvas.app?.view;
  if (view && !view.f2fLabelClicks) {
    // Only a real click counts, not the end of a drag.
    let down = null;
    view.addEventListener("pointerdown", ev => (down = { x: ev.clientX, y: ev.clientY }));
    view.addEventListener("click", ev => { if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 6) onBoardClick(ev); });
    view.f2fLabelClicks = true;
  }
});

Hooks.on("preCreateMeasuredTemplate", onPreCreate);
Hooks.on("drawMeasuredTemplate", t => drawLabel(t));
Hooks.on("refreshMeasuredTemplate", t => drawLabel(t));
