/**
 * Fire to Fire: easier removal from the Theatre Inserts tray (Foundry v11, Theatre Inserts 2.x).
 *
 * Theatre only removes a portrait from its tray with Ctrl + right-click, or from the actor's
 * right-click menu in the Actors tab. This adds two quicker ways:
 *   - hover a portrait in the tray and click the small × that appears on its corner;
 *   - middle-click (click the mouse wheel on) a portrait.
 * Removing takes the actor off the stage entirely, the same as Theatre's own "Remove from Stage".
 */

const MOD = "f2f-tools";
const ITEM = ".theatre-control-nav-bar-item";
let btn = null, current = null, hideTimer = null, quietUntil = 0;

const theatre = () => {
  try { return typeof Theatre !== "undefined" ? Theatre : globalThis.Theatre; } catch (e) { return null; }
};

export function removeFromTray(item) {
  const T = theatre();
  const id = item?.getAttribute?.("imgId");
  if (!T?.instance || !id) return false;
  T.instance._removeFromStage(id);
  hideBtn(true);
  // The next portrait slides under the mouse; don't offer its × straight away, so a double-click can't remove two.
  quietUntil = Date.now() + 600;
  return true;
}

function button() {
  if (btn?.isConnected) return btn;
  btn = document.createElement("a");
  btn.className = "f2f-tray-x";
  btn.textContent = "×";
  btn.dataset.tooltip = "Remove from the stage";
  btn.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  btn.addEventListener("mouseleave", () => hideBtn());
  btn.addEventListener("mousedown", ev => { ev.preventDefault(); ev.stopPropagation(); });
  btn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); removeFromTray(current); });
  document.body.append(btn);
  return btn;
}

function showBtn(item) {
  clearTimeout(hideTimer);
  current = item;
  const b = button();
  const r = item.getBoundingClientRect();
  b.style.left = `${r.right - 8}px`;
  b.style.top = `${r.top - 6}px`;
  b.classList.add("on");
}

function hideBtn(now = false) {
  clearTimeout(hideTimer);
  const go = () => { btn?.classList.remove("on"); current = null; };
  if (now) go(); else hideTimer = setTimeout(go, 250);
}

function wire() {
  if (document.body.f2fTrayWired) return;
  document.body.f2fTrayWired = true;
  document.addEventListener("mouseover", ev => {
    if (!game.settings.get(MOD, "theatreTrayRemove")) return;
    const item = ev.target.closest?.(ITEM);
    if (item && Date.now() >= quietUntil) showBtn(item);
  });
  document.addEventListener("mouseout", ev => {
    if (ev.target.closest?.(ITEM) && !ev.relatedTarget?.closest?.(".f2f-tray-x")) hideBtn();
  });
  // Middle-click a portrait. Capture phase, so Theatre's own handlers never see it.
  document.addEventListener("mousedown", ev => { if (ev.button === 1 && ev.target.closest?.(ITEM) && game.settings.get(MOD, "theatreTrayRemove")) ev.preventDefault(); }, true);
  document.addEventListener("mouseup", ev => {
    if (ev.button !== 1 || !game.settings.get(MOD, "theatreTrayRemove")) return;
    const item = ev.target.closest?.(ITEM);
    if (!item) return;
    ev.preventDefault(); ev.stopPropagation();
    removeFromTray(item);
  }, true);
}

Hooks.once("init", () => {
  game.settings.register(MOD, "theatreTrayRemove", {
    name: "Theatre: quick remove from the tray",
    hint: "Hover a portrait in the Theatre Inserts tray and click its ×, or middle-click it, to take that actor off the stage.",
    scope: "client", config: true, type: Boolean, default: true
  });
});

Hooks.once("ready", () => {
  if (game.modules.get("theatre")?.active) wire();
  const mod = game.modules.get(MOD);
  mod.api ??= {};
  mod.api.theatreTray = { removeFromTray };
});
