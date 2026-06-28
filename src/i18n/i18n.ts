/* ===========================================================================
   Panetti — shared i18n. One module for both the calculator and the content
   pages (the POC duplicated this across app.js and content.js). Locales are
   bundled, so switching language is synchronous — no fetch.
   =========================================================================== */

import { BASE_LOCALE, LANGS, LOCALES } from "../data/locales";
import type { LocaleTree } from "../data/locales";

export { LANGS };

let I18N: LocaleTree = BASE_LOCALE;
let LOCALE = "en";

/** Recursively overlay `over` on `base`; arrays/scalars from `over` win. */
function deepMerge(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (Array.isArray(base) || Array.isArray(over)) return over;
  if (typeof base !== "object" || base === null) return over;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  const o = over as Record<string, unknown>;
  for (const k in o) {
    out[k] = k in (base as object) ? deepMerge((base as Record<string, unknown>)[k], o[k]) : o[k];
  }
  return out;
}

/** Apply a language: merge its overlay onto the English base. */
export function setLocale(lang: string): void {
  const overlay = lang === "en" ? {} : (LOCALES[lang] ?? {});
  I18N = deepMerge(BASE_LOCALE, overlay) as LocaleTree;
  LOCALE = lang;
}

export const getLocale = (): string => LOCALE;

function lookup(key: string): unknown {
  return key.split(".").reduce<unknown>((o, k) => {
    if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
    return undefined;
  }, I18N);
}

/** Interpolate {placeholders} in a string. */
export function tp(str: string, params?: Record<string, unknown>): string {
  return String(str).replace(/\{(\w+)\}/g, (m, k: string) =>
    params && k in params ? String(params[k]) : m,
  );
}

/** Translate a dot-path key to a string (with optional interpolation). */
export function t(key: string, params?: Record<string, unknown>): string {
  const v = lookup(key);
  if (typeof v === "string") return params ? tp(v, params) : v;
  return key;
}

/** Translate a dot-path key expected to hold an array of template strings. */
export function tList(key: string): string[] {
  const v = lookup(key);
  return Array.isArray(v) ? (v as string[]) : [];
}

/** Decide the active language: ?lang= in the hash, stored pref, browser, EN. */
export function pickLang(): string {
  const q = new URLSearchParams(location.hash.slice(1));
  const fromHash = q.get("lang");
  if (fromHash && fromHash in LANGS) return fromHash;
  try {
    const stored = localStorage.getItem("panetti.lang");
    if (stored && stored in LANGS) return stored;
  } catch {
    /* localStorage blocked */
  }
  return (navigator.language || "en").toLowerCase().startsWith("it") ? "it" : "en";
}

/** Apply [data-i18n] / [data-i18n-title] attributes within `root`. */
export function applyI18nAttrs(root: ParentNode = document): void {
  document.documentElement.lang = LOCALE;
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n")!);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    el.title = t(el.getAttribute("data-i18n-title")!);
  });
}

/** Render the language segmented switcher into `container`. */
export function buildLangSeg(
  container: HTMLElement,
  current: string,
  onPick: (code: string) => void,
): void {
  container.innerHTML = "";
  for (const [code, label] of Object.entries(LANGS)) {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = code === current ? "active" : "";
    b.addEventListener("click", () => {
      if (code !== current) onPick(code);
    });
    container.appendChild(b);
  }
}

/**
 * Dev-only sanity check that the English base table has its top-level
 * namespaces — catches an empty/broken en.json before the UI silently shows
 * raw key strings everywhere.
 */
export function assertLocaleShape(): void {
  if (!import.meta.env.DEV) return;
  const required = [
    "ui", "nav", "ingredients", "leavening", "preferment", "sliders", "tips", "methods",
  ];
  const missing = required.filter((k) => !(k in BASE_LOCALE));
  if (missing.length) {
    console.error(`[i18n] en.json is missing namespaces: ${missing.join(", ")}`);
  }
}
