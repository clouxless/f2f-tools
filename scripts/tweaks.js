const MOD = "f2f-tools";

// ---- Sheet headers: icon-only buttons get their label back as a hover tooltip. ----
Hooks.on("renderActorSheet", (app, html) => {
  const root = app.element?.[0] ?? html?.[0]?.closest?.(".window-app");
  for (const a of root?.querySelectorAll(".window-header a.header-button:not(.close)") ?? []) {
    const label = a.textContent.trim();
    if (label && !a.dataset.tooltip) a.dataset.tooltip = label;
  }
});

// ---- Right-click menus: never run off screen. ----
/** If the open context menu sticks out of the window, cap its height and let it scroll. */
export function fitContextMenu(menu = document.getElementById("context-menu")) {
  if (!menu) return;
  menu.style.maxHeight = "";
  menu.style.overflowY = "";
  const r = menu.getBoundingClientRect();
  const margin = 8;
  if (r.top >= margin && r.bottom <= window.innerHeight - margin) return;
  const t = menu.parentElement?.getBoundingClientRect();
  const up = menu.classList.contains("expand-up") || (t && r.bottom <= t.top + 2);
  const avail = up
    ? r.bottom - margin                       // anchored at its bottom edge, grows upward
    : window.innerHeight - margin - r.top;    // anchored at its top edge, grows downward
  menu.style.maxHeight = `${Math.max(120, Math.floor(avail))}px`;
  menu.style.overflowY = "auto";
}

function wrapContextMenu() {
  const after = result => {
    if (result instanceof Promise) result.then(() => fitContextMenu());
    else requestAnimationFrame(() => fitContextMenu());
    return result;
  };
  if (globalThis.libWrapper) {
    libWrapper.register(MOD, "ContextMenu.prototype.render", function (wrapped, ...args) { return after(wrapped(...args)); }, "WRAPPER");
  } else {
    const original = ContextMenu.prototype.render;
    ContextMenu.prototype.render = function (...args) { return after(original.apply(this, args)); };
  }
}

/** Remove actor menu entries whose (translated) name is on the hide list. */
export function hideEntries(entries, list) {
  const hidden = String(list ?? "").split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!hidden.length) return entries;
  for (let i = entries.length - 1; i >= 0; i--) {
    const name = game.i18n.localize(entries[i].name ?? "").trim().toLowerCase();
    if (hidden.includes(name)) entries.splice(i, 1);
  }
  return entries;
}

Hooks.once("init", () => {
  game.settings.register(MOD, "compactMenus", {
    name: "Menus: compact right-click menus",
    hint: "Shorter rows in right-click menus so more options fit on screen.",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: v => document.body.classList.toggle("f2f-compact-menus", v)
  });
  game.settings.register(MOD, "hiddenActorEntries", {
    name: "Menus: hide actor menu entries",
    hint: "Names of right-click options to hide in the Actors sidebar, separated by commas, exactly as they appear in the menu (for example: Export Data, Import Data).",
    scope: "world", config: true, type: String, default: ""
  });
});

Hooks.once("setup", wrapContextMenu);

Hooks.once("ready", () => {
  document.body.classList.toggle("f2f-compact-menus", game.settings.get(MOD, "compactMenus"));
  // Registered at ready so it runs after every other module has added its entries.
  Hooks.on("getActorDirectoryEntryContext", (html, entries) => hideEntries(entries, game.settings.get(MOD, "hiddenActorEntries")));
});
