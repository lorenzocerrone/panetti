/* ===========================================================================
   Panetti — shared i18n primitives.
   Loaded as a classic <script> before app.js / content.js; its top-level
   bindings (I18N, LANGS, helpers) are visible to those scripts by name.
   Text lives in locales/*.json: an English base merged with a language overlay
   (deepMerge) and looked up by dot-path with t().
   =========================================================================== */

let I18N = {}, LOCALE = "en";
const LANGS = { en: "EN", it: "IT" };

/* Recursively overlay `over` on top of `base`; arrays/scalars from `over` win,
   missing keys fall back to `base` (English). */
function deepMerge(base, over) {
  if (over === undefined) return base;
  if (Array.isArray(base) || Array.isArray(over)) return over;
  if (typeof base !== "object" || base === null) return over;
  const out = { ...base };
  for (const k in over) out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  return out;
}

/* Interpolate {placeholders} in a string. */
function tp(str, params) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    params && k in params ? params[k] : m
  );
}

/* Translate a dot-path key. Returns the raw value (string or array); strings
   get {placeholder} interpolation when params are given. Missing → the key. */
function t(key, params) {
  const val = key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), I18N);
  if (val === undefined) return key;
  if (typeof val === "string" && params) return tp(val, params);
  return val;
}

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error("Failed to load " + path);
  return res.json();
}

/* Decide the active language: ?lang= in the hash, then stored preference,
   then the browser language (Italian if it starts with "it"), else English. */
function pickLang() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (q.has("lang") && LANGS[q.get("lang")]) return q.get("lang");
  try {
    const stored = localStorage.getItem("panetti.lang");
    if (stored && LANGS[stored]) return stored;
  } catch (e) {}
  return (navigator.language || "en").toLowerCase().startsWith("it") ? "it" : "en";
}

/* Apply [data-i18n] / [data-i18n-title] attributes within `root` (default:
   whole document) and set <html lang>. Used by the content pages' shell. */
function applyI18nAttrs(root) {
  root = root || document;
  document.documentElement.lang = LOCALE;
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.getAttribute("data-i18n-title"));
  });
}

/* Render the EN/IT segmented switcher into `container`, marking `current`
   active and invoking onPick(code) when another language is chosen. */
function buildLangSeg(container, current, onPick) {
  container.innerHTML = "";
  Object.entries(LANGS).forEach(([code, label]) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = code === current ? "active" : "";
    b.addEventListener("click", () => {
      if (code !== current) onPick(code);
    });
    container.appendChild(b);
  });
}
