/* ===========================================================================
   Panetti — content page controller (about.html / guides.html).
   Authors edit plain Markdown in content/<slug>.<lang>.md (English fallback);
   this renders it with the vendored snarkdown. Static shell text comes from
   locales/*.json via the shared i18n helpers in i18n.js.
   =========================================================================== */

const PAGE = document.body.dataset.page; // "about" | "guides"
const LOCALES_CACHE = {};
let lang = pickLang();
let guides = [];        // [{ id, emoji }] from config/pages.json (guides page)
let activeGuide = null;

/* ---------- Loading ---------- */
async function loadLocale(l) {
  if (!LOCALES_CACHE.en) LOCALES_CACHE.en = await fetchJson("locales/en.json");
  if (l !== "en" && !LOCALES_CACHE[l]) LOCALES_CACHE[l] = await fetchJson(`locales/${l}.json`);
  I18N = deepMerge(LOCALES_CACHE.en, l === "en" ? {} : LOCALES_CACHE[l]);
  LOCALE = l;
}

/* Fetch a content file for the active language, falling back to English. */
async function fetchMarkdown(slug, l) {
  let res = await fetch(`content/${slug}.${l}.md`);
  if (!res.ok && l !== "en") res = await fetch(`content/${slug}.en.md`);
  if (!res.ok) return "*Content not found.*";
  return res.text();
}

async function renderContent(slug) {
  const el = document.getElementById("content");
  const md = await fetchMarkdown(slug, lang);
  el.innerHTML = snarkdown(md);
  // External links open in a new tab.
  el.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });
  el.scrollTop = 0;
}

/* ---------- Guides ---------- */
function guideLabel(g) {
  return `<span class="guide-emoji">${g.emoji || ""}</span>${t("guides." + g.id + ".title")}`;
}

async function renderGuideList() {
  guides = await fetchJson("config/pages.json");
  const list = document.getElementById("guide-list");
  list.innerHTML = "";
  guides.forEach((g) => {
    const a = document.createElement("a");
    a.href = "#" + g.id;
    a.className = "guide-link";
    a.dataset.id = g.id;
    a.innerHTML = guideLabel(g);
    a.addEventListener("click", (e) => {
      e.preventDefault();
      selectGuide(g.id);
    });
    list.appendChild(a);
  });
}

function relabelGuides() {
  document.querySelectorAll("#guide-list .guide-link").forEach((a) => {
    const g = guides.find((x) => x.id === a.dataset.id);
    if (g) a.innerHTML = guideLabel(g);
  });
}

function currentGuideId() {
  const h = location.hash.slice(1);
  if (guides.some((g) => g.id === h)) return h;
  return guides[0] && guides[0].id;
}

async function selectGuide(id) {
  if (!id) return;
  activeGuide = id;
  if (location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id);
  document.querySelectorAll("#guide-list .guide-link").forEach((a) =>
    a.classList.toggle("active", a.dataset.id === id)
  );
  await renderContent("guide-" + id);
}

/* ---------- Shell + language ---------- */
function applyShell() {
  document.title = t(PAGE + ".title") + " · Panetti";
  applyI18nAttrs();
  buildLangSeg(document.getElementById("lang-seg"), lang, switchLang);
}

async function switchLang(code) {
  lang = code;
  try {
    localStorage.setItem("panetti.lang", code);
  } catch (e) {}
  await loadLocale(code);
  applyShell();
  if (PAGE === "guides") {
    relabelGuides();
    await renderContent("guide-" + activeGuide);
  } else {
    await renderContent(PAGE);
  }
}

/* ---------- Init ---------- */
async function init() {
  try {
    await loadLocale(lang);
  } catch (e) {
    document.getElementById("content").innerHTML =
      "<p>🍕 Couldn't load the locale files. Serve this page over http " +
      "(e.g. <code>python3 -m http.server</code>) instead of opening it from disk.</p>";
    return;
  }
  applyShell();

  if (PAGE === "guides") {
    await renderGuideList();
    window.addEventListener("hashchange", () => {
      const id = currentGuideId();
      if (id !== activeGuide) selectGuide(id);
    });
    await selectGuide(currentGuideId());
  } else {
    await renderContent(PAGE);
  }
}

document.addEventListener("DOMContentLoaded", init);
