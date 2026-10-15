/**
 * Fire to Fire: a pop-out Theatre Inserts cast window (Foundry v11, Theatre Inserts 2.x).
 *
 * The tray under the chat box only fits a few small portraits. This window shows them large:
 *   On the tray  - everyone in Theatre's tray. Click: speak as them (brings them on screen),
 *                  the same as a left-click in the tray. Right-click: show or hide their
 *                  portrait on screen. ×: take them off the tray.
 *   Add to tray  - actors with a Theatre portrait set, or any actor you own via the search box.
 *                  Click: put them on the tray and speak as them. Shift-click: tray only.
 * Open it with the button next to Theatre's tray, or a key set in Configure Controls.
 */

const MOD = "f2f-tools";
const theatre = () => { try { return typeof Theatre !== "undefined" ? Theatre : globalThis.Theatre; } catch (e) { return null; } };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tid = actor => theatre()?._getTheatreId?.(actor) ?? `theatre-${actor.id}`;
const portraitOf = actor => actor.flags?.theatre?.baseinsert || actor.img || "icons/svg/mystery-man.svg";
const nameOf = actor => actor.flags?.theatre?.name || actor.name;

export class TheatreCast extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "f2f-theatre-cast", title: "Theatre cast", classes: ["f2f-cast"],
      width: 460, height: 520, resizable: true, popOut: true
    });
  }

  constructor(...args) { super(...args); this.query = ""; }

  get staged() {
    const T = theatre();
    const bar = T?.instance?.theatreNavBar;
    if (!bar) return [];
    return [...bar.querySelectorAll(".theatre-control-nav-bar-item")].map(el => {
      const id = el.getAttribute("imgId");
      return {
        id, src: el.getAttribute("src"), name: el.getAttribute("name") || el.title,
        onScreen: el.classList.contains("theatre-control-nav-bar-item-active"),
        speaking: el.classList.contains("theatre-control-nav-bar-item-speakingas")
      };
    });
  }

  get candidates() {
    const onTray = new Set(this.staged.map(s => s.id));
    const q = this.query.trim().toLowerCase();
    return (game.actors ?? []).filter(a => a.isOwner && !onTray.has(tid(a)))
      .filter(a => q ? (nameOf(a).toLowerCase().includes(q) || a.name.toLowerCase().includes(q)) : !!a.flags?.theatre?.baseinsert)
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
      .slice(0, 60)
      .map(a => ({ id: tid(a), actorId: a.id, src: portraitOf(a), name: nameOf(a) }));
  }

  async _renderInner() {
    const tile = (t, staged) => `<div class="f2f-cast-tile${t.onScreen ? " on" : ""}${t.speaking ? " speaking" : ""}" data-id="${esc(t.id)}"${t.actorId ? ` data-actor="${esc(t.actorId)}"` : ""} title="${esc(t.name)}">
        <img src="${esc(t.src)}" alt=""><span class="nm">${esc(t.name)}</span>${staged ? '<a class="x" title="Take off the tray">×</a>' : ""}</div>`;
    const staged = this.staged, cands = this.candidates;
    return $(`<div class="f2f-cast">
      <h3>On the tray <span class="hint">click: speak as · right-click: show/hide · ×: remove</span></h3>
      <div class="f2f-cast-grid staged">${staged.map(t => tile(t, true)).join("") || '<p class="none">Nobody is on the tray yet.</p>'}</div>
      <h3>Add to tray <span class="hint">click: add and speak · shift-click: add only</span></h3>
      <input type="search" class="f2f-cast-search" placeholder="Search your actors by name" value="${esc(this.query)}">
      <div class="f2f-cast-grid add">${cands.map(t => tile(t, false)).join("") || `<p class="none">${this.query ? "No matching actors." : "Actors with a Theatre portrait set show here. Search to find any other."}</p>`}</div>
    </div>`);
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0];
    const T = theatre();
    const navItem = id => T?.instance?.getNavItemById?.(id);
    // Reuse Theatre's own tray handler, so a click here does exactly what the same click in the tray does.
    const trayClick = (id, button, ev) => {
      const el = navItem(id);
      if (!el) return;
      el.dispatchEvent(new MouseEvent("mouseup", { button, bubbles: false, ctrlKey: !!ev?.ctrlKey, shiftKey: false, altKey: !!ev?.altKey }));
      this._later();
    };
    root.querySelectorAll(".staged .f2f-cast-tile").forEach(el => {
      el.addEventListener("click", ev => {
        if (ev.target.closest(".x")) { ev.preventDefault(); T?.instance?._removeFromStage(el.dataset.id); return this._later(); }
        trayClick(el.dataset.id, 0, ev);
      });
      el.addEventListener("contextmenu", ev => { ev.preventDefault(); trayClick(el.dataset.id, 2, ev); });
    });
    root.querySelectorAll(".add .f2f-cast-tile").forEach(el => el.addEventListener("click", async ev => {
      const actor = game.actors.get(el.dataset.actor);
      if (!actor || !T) return;
      T.addToNavBar(actor);
      if (!ev.shiftKey) await T.instance.activateInsertById(el.dataset.id, ev);
      this._later();
    }));
    const search = root.querySelector(".f2f-cast-search");
    search?.addEventListener("input", () => {
      this.query = search.value;
      clearTimeout(this._q);
      this._q = setTimeout(async () => {
        await this.render(false);
        const s = this.element?.[0]?.querySelector(".f2f-cast-search");
        if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
      }, 200);
    });
  }

  // Re-draw after Theatre has finished its own changes.
  _later() { setTimeout(() => this.rendered && this.render(false), 150); }

  // Follow the tray: any portrait added, removed or changing state re-draws this window.
  async _render(...args) {
    await super._render(...args);
    const bar = theatre()?.instance?.theatreNavBar;
    if (bar && !this._obs) {
      this._obs = new MutationObserver(() => { clearTimeout(this._t); this._t = setTimeout(() => this.rendered && this.render(false), 100); });
      this._obs.observe(bar, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }
  }

  async close(...args) {
    this._obs?.disconnect(); this._obs = null;
    return super.close(...args);
  }
}

let cast = null;
export function openCast() {
  if (!theatre()?.instance) return ui.notifications.warn("Theatre Inserts isn't running.");
  cast ??= new TheatreCast();
  return cast.rendered ? cast.bringToTop() : cast.render(true);
}

function addTrayButton() {
  const T = theatre();
  const bar = T?.instance?.theatreNavBar;
  if (!bar || bar.parentElement?.querySelector(".f2f-cast-btn")) return;
  const btn = document.createElement("div");
  btn.className = "theatre-control-btn f2f-cast-btn";
  btn.title = "Open the Theatre cast window";
  btn.innerHTML = '<i class="fas fa-users"></i>';
  btn.addEventListener("click", ev => { ev.preventDefault(); openCast(); });
  bar.after(btn);
}

Hooks.once("init", () => {
  game.keybindings.register(MOD, "theatreCast", {
    name: "Open the Theatre cast window",
    hint: "A larger pop-out of the Theatre Inserts tray.",
    editable: [], onDown: () => { openCast(); return true; }
  });
});

Hooks.once("ready", () => {
  if (game.modules.get("theatre")?.active) setTimeout(addTrayButton, 500);
  const mod = game.modules.get(MOD);
  mod.api ??= {};
  mod.api.theatreCast = { open: openCast, TheatreCast };
});
Hooks.on("renderChatLog", () => { if (game.modules.get("theatre")?.active) setTimeout(addTrayButton, 500); });
