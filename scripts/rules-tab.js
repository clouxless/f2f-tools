/**
 * Fire to Fire: quick-reference rules tab (Foundry v11)
 *
 * A "Rules" tab in the sidebar with the 4e glossary (545 entries from the compendium database):
 * search box, filters (Starred, Conditions, Combat, All), click an entry to read its exact text,
 * star the ones you look up often, and post any entry to chat.
 * The tab switching is done here, not by Foundry's sidebar, so it doesn't depend on Sidebar internals.
 */

const MOD = "f2f-tools";
const TAB = "f2f-rules";
const setting = key => game.settings.get(MOD, key);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// "Combat": the rules people look up mid-fight.
const COMBAT = ["Marked", "Combat Advantage", "Ongoing Damage", "Saving Throws", "Flanking", "Cover", "Concealment",
  "Charge", "Opportunity Attack", "Escape", "Grab", "Forced Movement", "Push", "Pull", "Slide", "Shift", "Second Wind",
  "Total Defense", "Aid Another", "Insubstantial", "Invisible", "Regeneration", "Resistance", "Vulnerable",
  "Temporary Hit Points", "Healing Surge", "Zone", "Stance", "Aura", "Conjuration", "Sustained Durations",
  "Dying and Death", "Surprise Round", "Basic Attack", "Ready an Action", "Delay", "Crawl", "Stand Up", "Run",
  "Squeeze", "Phasing", "Falling", "Line of Sight", "Line of Effect", "Threatening Reach", "Teleportation"];

let entries = null;
let state = { filter: "conditions", query: "", open: new Set() };

async function loadEntries() {
  if (entries) return entries;
  const res = await fetch(`modules/${MOD}/data/glossary.json`);
  entries = await res.json();
  return entries;
}

const starred = () => new Set(game.settings.get(MOD, "rulesStarred") ?? []);
async function toggleStar(id) {
  const s = starred();
  s.has(id) ? s.delete(id) : s.add(id);
  await game.settings.set(MOD, "rulesStarred", [...s]);
}

const plain = html => String(html).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").toLowerCase();

export function filterEntries(list, { filter, query }, stars = new Set()) {
  const q = query.trim().toLowerCase();
  const combat = new Set(COMBAT.map(n => n.toLowerCase()));
  let out = list;
  if (!q) {
    if (filter === "starred") out = list.filter(e => stars.has(e.id));
    else if (filter === "conditions") out = list.filter(e => e.type === "Rules Condition" || e.name === "Marked");
    else if (filter === "combat") out = list.filter(e => combat.has(e.name.toLowerCase()));
    return out;
  }
  // Searching looks through everything: name matches first, then text matches.
  const byName = list.filter(e => e.name.toLowerCase().includes(q));
  const names = new Set(byName.map(e => e.id));
  const byText = list.filter(e => !names.has(e.id) && plain(e.html).includes(q));
  byName.sort((a, b) => (a.name.toLowerCase().startsWith(q) ? 0 : 1) - (b.name.toLowerCase().startsWith(q) ? 0 : 1) || a.name.localeCompare(b.name));
  return [...byName, ...byText];
}

function entryHtml(e, stars) {
  const open = state.open.has(e.id);
  return `<li class="f2f-rule${open ? " open" : ""}" data-id="${e.id}">
    <div class="f2f-rule-head">
      <a class="f2f-star${stars.has(e.id) ? " on" : ""}" data-tooltip="Star"><i class="${stars.has(e.id) ? "fas" : "far"} fa-star"></i></a>
      <span class="f2f-rule-name">${esc(e.name)}</span>
      <span class="f2f-rule-type">${esc(e.type.replace(/^Rules /, ""))}</span>
    </div>
    ${open ? `<div class="f2f-rule-body">${e.html}
      <div class="f2f-rule-actions"><a class="f2f-rule-chat"><i class="fas fa-comment"></i> Post to chat</a></div></div>` : ""}
  </li>`;
}

async function renderList(section) {
  const list = section.querySelector(".f2f-rules-list");
  const all = await loadEntries();
  const stars = starred();
  const shown = filterEntries(all, state, stars);
  const empty = state.filter === "starred" && !state.query
    ? `<p class="f2f-rules-empty">Nothing starred yet. Click the ☆ next to an entry to keep it here.</p>`
    : `<p class="f2f-rules-empty">No matches.</p>`;
  list.innerHTML = shown.length ? `<ol>${shown.slice(0, 200).map(e => entryHtml(e, stars)).join("")}</ol>${shown.length > 200 ? `<p class="f2f-rules-empty">${shown.length - 200} more; keep typing to narrow it down.</p>` : ""}` : empty;
  section.querySelector(".f2f-rules-count").textContent = `${shown.length} ${shown.length === 1 ? "entry" : "entries"}`;
  section.querySelectorAll(".f2f-rules-filters a").forEach(a => a.classList.toggle("active", a.dataset.filter === state.filter && !state.query));
}

function buildSection() {
  const section = document.createElement("section");
  section.id = TAB;
  section.className = "tab sidebar-tab f2f-rules-tab";
  section.dataset.tab = TAB;
  section.style.display = "none";
  section.innerHTML = `
    <header class="f2f-rules-header">
      <div class="f2f-rules-search"><i class="fas fa-search"></i><input type="search" placeholder="Search the 4e glossary" autocomplete="off"></div>
      <nav class="f2f-rules-filters">
        <a data-filter="starred"><i class="fas fa-star"></i> Starred</a>
        <a data-filter="conditions">Conditions</a>
        <a data-filter="combat">Combat</a>
        <a data-filter="all">All</a>
      </nav>
      <div class="f2f-rules-count"></div>
    </header>
    <div class="f2f-rules-list"></div>`;
  const input = section.querySelector("input");
  let timer;
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { state.query = input.value; renderList(section); }, 150); });
  section.querySelector(".f2f-rules-filters").addEventListener("click", ev => {
    const a = ev.target.closest("[data-filter]");
    if (!a) return;
    ev.preventDefault();
    state.filter = a.dataset.filter;
    state.query = input.value = "";
    renderList(section);
  });
  section.querySelector(".f2f-rules-list").addEventListener("click", async ev => {
    const li = ev.target.closest(".f2f-rule");
    if (!li) return;
    const id = li.dataset.id;
    if (ev.target.closest(".f2f-star")) { ev.preventDefault(); await toggleStar(id); return renderList(section); }
    if (ev.target.closest(".f2f-rule-chat")) { ev.preventDefault(); return postToChat(entries.find(e => e.id === id)); }
    if (ev.target.closest(".f2f-rule-head")) {
      state.open.has(id) ? state.open.delete(id) : state.open.add(id);
      renderList(section);
    }
  });
  return section;
}

export async function postToChat(e) {
  if (!e) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `<div class="f2f-rule-card"><h3>${esc(e.name)}</h3>${e.html}</div>`
  });
}

/* ---------------- the tab itself ---------------- */

let previous = null; // the core tab that was showing before ours

function activate() {
  const sidebar = document.getElementById("sidebar");
  const nav = document.getElementById("sidebar-tabs");
  const section = document.getElementById(TAB);
  if (!sidebar || !nav || !section) return;
  if (ui.sidebar?._collapsed) ui.sidebar.expand?.();
  const cur = nav.querySelector(".item.active:not([data-tab='" + TAB + "'])");
  if (cur) previous = cur.dataset.tab;
  nav.querySelectorAll(".item").forEach(i => i.classList.toggle("active", i.dataset.tab === TAB));
  sidebar.querySelectorAll(":scope > .sidebar-tab, :scope > .tab").forEach(s => { if (s !== section) s.classList.remove("active"); });
  section.classList.add("active");
  section.style.display = "";
  renderList(section);
  section.querySelector("input")?.focus();
}

function deactivate() {
  const section = document.getElementById(TAB);
  if (!section || !section.classList.contains("active")) return;
  section.classList.remove("active");
  section.style.display = "none";
  document.querySelector(`#sidebar-tabs .item[data-tab="${TAB}"]`)?.classList.remove("active");
  // Put back what Foundry thinks is showing, so clicking that same tab works as normal.
  if (previous) {
    document.querySelector(`#sidebar-tabs .item[data-tab="${previous}"]`)?.classList.add("active");
    document.querySelector(`#sidebar > [data-tab="${previous}"]`)?.classList.add("active");
  }
}

export function install() {
  if (!setting("rulesTab")) return;
  const nav = document.getElementById("sidebar-tabs");
  const sidebar = document.getElementById("sidebar");
  if (!nav || !sidebar || nav.querySelector(`[data-tab="${TAB}"]`)) return;
  const item = document.createElement("a");
  item.className = "item f2f-rules-nav";
  item.dataset.tab = TAB;
  item.dataset.tooltip = "Rules quick reference";
  item.setAttribute("aria-label", "Rules quick reference");
  item.innerHTML = `<i class="fas fa-book-open-reader"></i>`;
  const settingsTab = nav.querySelector('[data-tab="settings"]');
  settingsTab ? settingsTab.before(item) : nav.append(item);
  sidebar.append(buildSection());
  // Capture phase: handle ours before Foundry's tab controller sees the click.
  nav.addEventListener("click", ev => {
    const a = ev.target.closest(".item[data-tab]");
    if (!a) return;
    if (a.dataset.tab === TAB) { ev.preventDefault(); ev.stopImmediatePropagation(); activate(); }
    else deactivate();
  }, true);
}

/** Open the tab and search for something, e.g. game.modules.get("f2f-tools").api.rules.lookup("dazed"). */
export async function lookup(query = "") {
  install();
  activate();
  const section = document.getElementById(TAB);
  if (!section) return;
  state.query = query;
  section.querySelector("input").value = query;
  const shown = filterEntries(await loadEntries(), state, starred());
  const exact = shown.find(e => e.name.toLowerCase() === query.toLowerCase()) ?? shown[0];
  if (exact) state.open.add(exact.id);
  renderList(section);
}

Hooks.once("init", () => {
  game.settings.register(MOD, "rulesTab", {
    name: "Rules: quick-reference sidebar tab",
    hint: "Adds a Rules tab to the sidebar with the 4e glossary: conditions, common combat rules, search, stars and post to chat. Reload after changing.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MOD, "rulesStarred", { scope: "client", config: false, type: Array, default: [] });
});

Hooks.on("renderSidebar", () => install());
Hooks.once("ready", () => {
  install();
  const mod = game.modules.get(MOD);
  mod.api ??= {};
  mod.api.rules = { lookup, filterEntries, postToChat, open: activate };
});
