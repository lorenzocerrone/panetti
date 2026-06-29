/* ===========================================================================
   Panetti — content pages (about.html / guides.html). Static shell text comes
   from the bundled locales; the prose itself is plain Markdown fetched at
   runtime from /content (English fallback) and rendered with snarkdown.
   =========================================================================== */

import snarkdown from "snarkdown";
import { PAGES } from "../data/config";
import type { PageRef } from "../data/config";
import { applyI18nAttrs, buildLangSeg, pickLang, setLocale, t } from "../i18n/i18n";
import { $ } from "./dom";
import { icon, hydrateIcons } from "./icons";

type PageKind = "about" | "guides";

let lang = pickLang();
let activeGuide: string | null = null;

/* ---------- Markdown ---------- */
async function fetchMarkdown(slug: string, l: string): Promise<string> {
  let res = await fetch(`content/${slug}.${l}.md`);
  if (!res.ok && l !== "en") res = await fetch(`content/${slug}.en.md`);
  if (!res.ok) return "*Content not found.*";
  return res.text();
}

async function renderContent(slug: string): Promise<void> {
  const el = $("#content");
  el.innerHTML = snarkdown(await fetchMarkdown(slug, lang));
  el.querySelectorAll<HTMLAnchorElement>('a[href^="http"]').forEach((a) => {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });
  el.scrollTop = 0;
}

/* ---------- Guides ---------- */
const guideLabel = (g: PageRef): string =>
  `${icon(g.icon, "guide-icon")}${t("guides." + g.id + ".title")}`;

function renderGuideList(): void {
  const list = $("#guide-list");
  list.innerHTML = "";
  PAGES.forEach((g) => {
    const a = document.createElement("a");
    a.href = "#" + g.id;
    a.className = "guide-link";
    a.dataset.id = g.id;
    a.innerHTML = guideLabel(g);
    a.addEventListener("click", (e) => {
      e.preventDefault();
      void selectGuide(g.id);
    });
    list.appendChild(a);
  });
}

function relabelGuides(): void {
  document.querySelectorAll<HTMLAnchorElement>("#guide-list .guide-link").forEach((a) => {
    const g = PAGES.find((x) => x.id === a.dataset.id);
    if (g) a.innerHTML = guideLabel(g);
  });
}

function currentGuideId(): string | undefined {
  const h = location.hash.slice(1);
  if (PAGES.some((g) => g.id === h)) return h;
  return PAGES[0]?.id;
}

async function selectGuide(id: string | undefined): Promise<void> {
  if (!id) return;
  activeGuide = id;
  if (location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id);
  document.querySelectorAll<HTMLAnchorElement>("#guide-list .guide-link").forEach((a) =>
    a.classList.toggle("active", a.dataset.id === id),
  );
  await renderContent("guide-" + id);
}

/* ---------- Shell + language ---------- */
function applyShell(page: PageKind): void {
  document.title = t(page + ".title") + " · Panetti";
  applyI18nAttrs();
  buildLangSeg($("#lang-seg"), lang, (code) => void switchLang(page, code));
}

async function switchLang(page: PageKind, code: string): Promise<void> {
  lang = code;
  try {
    localStorage.setItem("panetti.lang", code);
  } catch {
    /* localStorage blocked */
  }
  setLocale(code);
  applyShell(page);
  if (page === "guides") {
    relabelGuides();
    await renderContent("guide-" + activeGuide);
  } else {
    await renderContent(page);
  }
}

/* ---------- Init ---------- */
export function initContent(): void {
  const page = (document.body.dataset.page ?? "about") as PageKind;
  setLocale(lang);
  applyShell(page);
  hydrateIcons(); // fill the static [data-icon] placeholders (nav/guide icons)

  if (page === "guides") {
    renderGuideList();
    window.addEventListener("hashchange", () => {
      const id = currentGuideId();
      if (id !== activeGuide) void selectGuide(id);
    });
    void selectGuide(currentGuideId());
  } else {
    void renderContent(page);
  }
}
