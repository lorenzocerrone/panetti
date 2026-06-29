/* ===========================================================================
   Panetti — calculator UI. Imperative DOM rendering (no framework), reading
   from the single `state` object and the pure engine. Ported from the POC
   app.js; the key change is that numeric inputs are mirrored into state rather
   than read from the DOM at compute time.
   =========================================================================== */

import { ADJUSTMENTS, PAGES, RECIPES } from "../data/config";
import {
  applyI18nAttrs,
  buildLangSeg,
  getLocale,
  pickLang,
  setLocale,
  t,
  tList,
  tp,
} from "../i18n/i18n";
import {
  compute,
  fermentGuideStarter,
  fermentGuideYeast,
  isSourdough,
  prefermentSplit,
  yeastFactor,
} from "../engine/dough";
import type { Computed, Recipe } from "../engine/types";
import {
  applyRecipe,
  createState,
  deserializeInto,
  serializeState,
} from "../state/store";
import type { AppState } from "../state/types";
import { $, setFill, showToast } from "./dom";
import { icon, hydrateIcons } from "./icons";

const adj = ADJUSTMENTS;
let state: AppState;

/* ---------- Helpers ---------- */
const currentRecipe = (): Recipe =>
  RECIPES.find((r) => r.id === state.recipeId) ?? RECIPES[0]!;

// Recipe prose lives inline in config/recipes.json under i18n.<lang>, EN fallback.
const rt = (recipe: Recipe, field: "name" | "blurb" | "notes" | "tip"): string =>
  recipe.i18n[state.lang]?.[field] ?? recipe.i18n.en?.[field] ?? "";

const ingColor = (key: string): string => adj.ingredientMeta[key]?.color ?? "#888";

const locTag = (): string => (getLocale() === "it" ? "it-IT" : "en-US");
const nf = (n: number, max: number): string =>
  new Intl.NumberFormat(locTag(), { maximumFractionDigits: max }).format(n);
const nfFixed = (n: number, d: number): string =>
  new Intl.NumberFormat(locTag(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

function fmt(g: number): string {
  const unit = t("ui.gram");
  if (g >= 1000) return nf(g / 1000, g % 1000 === 0 ? 0 : 2) + " " + t("ui.kg");
  if (g >= 100) return nf(Math.round(g), 0) + " " + unit;
  if (g >= 10) return nf(g, 1) + " " + unit;
  return nf(g, 2) + " " + unit;
}

const fmtCount = (n: number): string =>
  state.mode === "flour" ? nf(n, 1) : String(Math.round(n));

/* ---------- Input <-> state sync ---------- */
const numInput = (id: string) => $<HTMLInputElement>("#" + id);

/** Push state's numeric values into their DOM inputs. */
function syncInputs(): void {
  numInput("ball-count").value = String(state.ballCount);
  numInput("ball-weight").value = String(state.ballWeight);
  numInput("flour-input").value = String(state.flour);
  numInput("flour-ball-weight").value = String(state.flourBallWeight);
  numInput("ferment-hours").value = String(state.fermentHours);
  numInput("ferment-temp").value = String(state.fermentTemp);
  syncStarterInputs();
  numInput("pf-pct").value = String(state.preferment.pct);
  $("#pf-pct-val").textContent = String(state.preferment.pct);
  setFill(numInput("pf-pct"), 10, 100);
}

function syncStarterInputs(): void {
  const p = numInput("st-pct");
  const h = numInput("st-hyd");
  p.value = String(state.starter.pct);
  h.value = String(state.starter.hyd);
  $("#st-pct-val").textContent = String(state.starter.pct);
  $("#st-hyd-val").textContent = String(state.starter.hyd);
  setFill(p, adj.starter.pctMin, adj.starter.pctMax);
  setFill(h, adj.starter.hydMin, adj.starter.hydMax);
}

/* ---------- Rendering ---------- */
function renderRecipes(): void {
  const list = $("#recipe-list");
  list.innerHTML = "";
  RECIPES.forEach((r) => {
    const btn = document.createElement("button");
    btn.className = "recipe-card" + (r.id === state.recipeId ? " active" : "");
    btn.innerHTML = `
      <div class="rc-top">
        ${icon(r.icon, "rc-icon")}
        <span class="rc-name">${rt(r, "name")}</span>
      </div>
      <div class="rc-blurb">${rt(r, "blurb")}</div>
      <div class="rc-tags">
        <span class="tag">${tp(t("ui.tagHydration"), { n: r.hydration })}</span>
        <span class="tag">${tp(t("ui.tagBalls"), { n: r.ballWeight })}</span>
      </div>`;
    btn.addEventListener("click", () => loadRecipe(r.id));
    list.appendChild(btn);
  });
}

function renderSliders(): void {
  const wrap = $("#sliders");
  wrap.innerHTML = "";
  adj.sliders
    .filter((s) => !(s.key === "yeast" && isSourdough(state)))
    .forEach((s) => {
      const row = document.createElement("div");
      row.className = "slider-row";
      row.innerHTML = `
        <div class="sl-head">
          <span class="sl-name">${t("sliders." + s.key)}</span>
          <span class="sl-val"><span data-val="${s.key}">${state.params[s.key]}</span>${s.unit} <small data-grams="${s.key}"></small></span>
        </div>
        <input type="range" min="${s.min}" max="${s.max}" step="${s.step}"
               value="${state.params[s.key]}" data-key="${s.key}" />`;
      const input = row.querySelector<HTMLInputElement>("input")!;
      setFill(input, s.min, s.max);
      input.addEventListener("input", () => {
        state.params[s.key] = Number(input.value);
        row.querySelector(`[data-val="${s.key}"]`)!.textContent = input.value;
        setFill(input, s.min, s.max);
        render();
      });
      wrap.appendChild(row);
    });
}

function renderLeavenSeg(): void {
  const seg = $("#yeast-seg");
  seg.innerHTML = "";
  adj.leaveningOrder.forEach((key) => {
    const b = document.createElement("button");
    b.textContent = t("leavening." + key);
    b.className = key === state.leavening ? "active" : "";
    b.addEventListener("click", () => {
      state.leavening = key;
      renderLeavenSeg();
      renderSliders();
      render();
    });
    seg.appendChild(b);
  });
}

function render(): void {
  const r = currentRecipe();
  const c = compute(state, adj);
  const name = rt(r, "name");
  const notes = rt(r, "notes");

  $("#active-name").innerHTML = `${icon(r.icon)} <span>${name}</span>`;
  $("#active-blurb").textContent = rt(r, "blurb");
  $("#recipe-notes").textContent = isSourdough(state)
    ? tp(t("ui.sourdoughNote"), { name, notes })
    : notes;

  const sourceEl = $("#recipe-source");
  if (r.source) {
    const a = document.createElement("a");
    a.href = r.source.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = r.source.label;
    sourceEl.replaceChildren(
      document.createTextNode(tp(t("ui.source"), { label: "" })),
      a,
    );
    sourceEl.hidden = false;
  } else {
    sourceEl.replaceChildren();
    sourceEl.hidden = true;
  }

  $("#total-dough").textContent = fmt(c.totalDough);
  $("#panetti-count").textContent = fmtCount(c.panetti);

  // gram readouts under sliders (hydration shows TOTAL water)
  const gramsMap: Record<string, keyof Computed["ing"]> = {
    hydration: "totalWater",
    salt: "salt",
    yeast: "yeast",
    oil: "oil",
    sugar: "sugar",
  };
  document.querySelectorAll<HTMLElement>("[data-grams]").forEach((el) => {
    const ingKey = gramsMap[el.getAttribute("data-grams")!];
    const v = ingKey ? c.ing[ingKey] : 0;
    el.textContent = v > 0 ? "· " + fmt(v) : "";
  });

  renderIngredients(c);
  renderPreferment(c);
  renderStarter(c);
  renderMethod(c);
  renderGuide();
  renderFermentTip();
  renderLearnMore();
  updateUrl();
}

interface Row {
  key: string;
  tag?: string;
  grams: number;
  pct: number;
}

function renderIngredients(c: Computed): void {
  const tbody = $("#ingredients tbody");
  tbody.innerHTML = "";
  const rows: Row[] = isSourdough(state)
    ? [
        { key: "flour", tag: t("ui.toAdd"), grams: c.ing.flour, pct: (c.ing.flour / c.ing.totalFlour) * 100 },
        { key: "water", tag: t("ui.toAdd"), grams: c.ing.water, pct: (c.ing.water / c.ing.totalFlour) * 100 },
        { key: "starter", grams: c.ing.starter, pct: state.starter.pct },
        { key: "salt", grams: c.ing.salt, pct: state.params.salt },
        { key: "oil", grams: c.ing.oil, pct: state.params.oil },
        { key: "sugar", grams: c.ing.sugar, pct: state.params.sugar },
      ]
    : [
        { key: "flour", grams: c.ing.flour, pct: 100 },
        { key: "water", grams: c.ing.water, pct: state.params.hydration },
        { key: "salt", grams: c.ing.salt, pct: state.params.salt },
        { key: "yeast", tag: t("leavening." + state.leavening).toLowerCase(), grams: c.ing.yeast, pct: state.params.yeast * yeastFactor(state, adj) },
        { key: "oil", grams: c.ing.oil, pct: state.params.oil },
        { key: "sugar", grams: c.ing.sugar, pct: state.params.sugar },
      ];

  rows.forEach((row) => {
    if (row.grams <= 0 && row.key !== "flour") return;
    const tag = row.tag ? ` <small style="color:var(--text-faint)">${row.tag}</small>` : "";
    const decimals = row.key === "yeast" ? 2 : row.pct % 1 === 0 ? 0 : 1;
    const label = t("ingredients." + row.key);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="ing-dot" style="background:${ingColor(row.key)}"></span>${label}${tag}</td>
      <td>${fmt(row.grams)}</td>
      <td>${nfFixed(row.pct, decimals)}%</td>`;
    tbody.appendChild(tr);
  });
}

// Resolve the method templates into final step strings (may contain <b> tags).
// `basic` flags the bare-bones straight dough (no preferment, no sourdough).
function resolveMethod(c: Computed): { steps: string[]; basic: boolean } {
  const extras: string[] = [];
  if (c.ing.oil > 0) extras.push(t("ingredients.oil").toLowerCase());
  if (c.ing.sugar > 0) extras.push(t("ingredients.sugar").toLowerCase());
  const extrasClause = extras.length
    ? tp(t("methods.extrasClause"), { list: extras.join(t("methods.join")) })
    : "";

  const vars: Record<string, string> = {
    flour: fmt(c.ing.flour),
    water: fmt(c.ing.water),
    yeast: fmt(c.ing.yeast),
    salt: fmt(c.ing.salt),
    starter: fmt(c.ing.starter),
    count: fmtCount(c.panetti),
    ballWeight: fmt(c.ballWeight),
    hours: String(Math.max(1, state.fermentHours || 8)),
    extrasClause,
  };

  let template: string[];
  let basic = false;
  if (isSourdough(state)) {
    template = tList("methods.sourdough");
  } else {
    const split = prefermentSplit(c, state, adj);
    if (split) {
      template = tList("methods.preferment");
      vars.label = t("preferment." + split.type).toLowerCase();
      vars.preWindow = t(split.type === "poolish" ? "methods.poolishWindow" : "methods.bigaWindow");
      vars.preFlour = fmt(split.preFlour);
      vars.preWater = fmt(split.preWater);
      vars.preYeast = fmt(split.preYeast);
      vars.finalFlour = fmt(split.finalFlour);
      vars.finalWater = fmt(split.finalWater);
      vars.finalYeastClause = split.finalYeast > 0.001
        ? tp(t("methods.finalYeastClause"), { amount: fmt(split.finalYeast) })
        : "";
    } else {
      template = tList("methods.straight");
      basic = true;
    }
  }

  return { steps: template.map((s) => tp(s, vars)), basic };
}

// Step-by-step recipe card from locale method templates + computed amounts.
function renderMethod(c: Computed): void {
  const { steps, basic } = resolveMethod(c);
  $("#method-steps").innerHTML = steps.map((s) => `<li>${s}</li>`).join("");

  const note = $("#method-note");
  note.textContent = basic ? t("methods.basicNote") : "";
  note.hidden = !basic;
}

function renderStarter(c: Computed): void {
  $("#starter").hidden = !isSourdough(state);
  if (!isSourdough(state)) return;
  $("#st-pct-g").textContent = "· " + fmt(c.ing.starter);
  $("#st-hint").textContent = tp(t("ui.starterHint"), {
    flour: fmt(c.ing.starterFlour),
    water: fmt(c.ing.starterWater),
  });
}

function renderFermentTip(): void {
  $("#ferment-tip").textContent = isSourdough(state)
    ? t("tips.sourdough")
    : rt(currentRecipe(), "tip");
}

// "Want to know more?" chips, generated from the guide list so new guides
// (config/pages.json) appear automatically. Titles reuse guides.<id>.title.
function renderLearnMore(): void {
  $("#learn-more-links").innerHTML = PAGES.map(
    (g) =>
      `<a class="chip" href="guides.html#${g.id}">${icon(g.icon, "chip-icon")}${t("guides." + g.id + ".title")}</a>`,
  ).join("");
}

/* ---------- Preferment ---------- */
function renderPrefermentSeg(): void {
  const seg = $("#preferment-seg");
  seg.innerHTML = "";
  (["none", "poolish", "biga"] as const).forEach((key) => {
    const b = document.createElement("button");
    b.textContent = t("preferment." + key);
    b.className = key === state.preferment.type ? "active" : "";
    b.addEventListener("click", () => {
      state.preferment.type = key;
      renderPrefermentSeg();
      render();
    });
    seg.appendChild(b);
  });
}

function rowsHtml(pairs: Array<[string, number]>): string {
  return pairs
    .filter(([, g]) => g > 0.001)
    .map(
      ([k, g]) =>
        `<tr><td><span class="ing-dot" style="background:${ingColor(k)}"></span>${t("ingredients." + k)}</td><td>${fmt(g)}</td></tr>`,
    )
    .join("");
}

function renderPreferment(c: Computed): void {
  const card = $("#preferment");
  const controls = $("#preferment-controls");
  const breakdown = $("#pf-breakdown");

  if (isSourdough(state)) {
    card.hidden = true;
    breakdown.hidden = true;
    return;
  }
  card.hidden = false;

  const split = prefermentSplit(c, state, adj);
  if (!split) {
    controls.hidden = true;
    breakdown.hidden = true;
    return;
  }
  controls.hidden = false;
  breakdown.hidden = false;

  $("#pf-title").textContent = t("preferment." + split.type);
  $("#pf-pre").innerHTML = rowsHtml([
    ["flour", split.preFlour],
    ["water", split.preWater],
    ["yeast", split.preYeast],
  ]);
  $("#pf-final").innerHTML = rowsHtml([
    ["flour", split.finalFlour],
    ["water", split.finalWater],
    ["yeast", split.finalYeast],
    ["salt", c.ing.salt],
    ["oil", c.ing.oil],
    ["sugar", c.ing.sugar],
  ]);

  let hint = t(split.type === "poolish" ? "preferment.poolishHint" : "preferment.bigaHint");
  if (split.finalWater < 0) hint = t("preferment.waterWarn");
  $("#pf-hint").textContent = hint;
}

/* ---------- Ferment guide ---------- */
function renderGuide(): void {
  if (isSourdough(state)) {
    $("#guide-label").textContent = t("ui.suggestedStarter");
    $("#guide-yeast").textContent = Math.round(fermentGuideStarter(state, adj)) + "%";
  } else {
    $("#guide-label").textContent = t("ui.suggestedYeast");
    $("#guide-yeast").textContent = nfFixed(fermentGuideYeast(state, adj), 2) + "%";
  }
}

/* ---------- URL persistence ---------- */
function updateUrl(): void {
  history.replaceState(null, "", "#" + serializeState(state));
}

/* ---------- Actions ---------- */
function loadRecipe(id: string): void {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) return;
  applyRecipe(state, r, adj);
  syncInputs();
  renderRecipes();
  renderSliders();
  render();
}

function setMode(mode: AppState["mode"]): void {
  state.mode = mode;
  $("#mode-balls").classList.toggle("active", mode === "balls");
  $("#mode-flour").classList.toggle("active", mode === "flour");
  document.querySelectorAll<HTMLElement>("[data-mode]").forEach((el) => {
    el.hidden = el.getAttribute("data-mode") !== mode;
  });
  render();
}

function copyRecipe(): void {
  const r = currentRecipe();
  const c = compute(state, adj);
  const name = rt(r, "name");
  const lines = [
    `${name} — ${fmt(c.totalDough)} ${t("ui.totalDough")}`,
    `${fmtCount(c.panetti)} ${t("ui.panettiLabel")} × ${fmt(c.ballWeight)}`,
    "",
  ];
  const keys: Array<keyof Computed["ing"]> = isSourdough(state)
    ? ["flour", "water", "starter", "salt", "oil", "sugar"]
    : ["flour", "water", "salt", "yeast", "oil", "sugar"];
  keys.forEach((k) => {
    if (c.ing[k] > 0 || k === "flour")
      lines.push(`${t("ingredients." + k).padEnd(18)} ${fmt(c.ing[k])}`);
  });
  lines.push("");
  lines.push(
    isSourdough(state)
      ? tp(t("ui.copyLeaveningSourdough"), { pct: state.starter.pct, hyd: state.starter.hyd })
      : tp(t("ui.copyLeaveningYeast"), { label: t("leavening." + state.leavening) }),
  );
  lines.push("");
  lines.push(`${t("ui.method")}:`);
  resolveMethod(c).steps.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.replace(/<[^>]+>/g, "")}`);
  });
  lines.push("");
  lines.push(rt(r, "notes"));
  if (r.source) lines.push(`${tp(t("ui.source"), { label: r.source.label })} — ${r.source.url}`);
  navigator.clipboard.writeText(lines.join("\n")).then(() => showToast(t("ui.copied")));
}

function shareLink(): void {
  updateUrl();
  navigator.clipboard.writeText(location.href).then(() => showToast(t("ui.linkCopied")));
}

/* ---------- Localization ---------- */
function applyStaticI18n(): void {
  document.title = t("ui.appTitle");
  applyI18nAttrs();
}

function setLang(lang: string): void {
  state.lang = lang;
  try {
    localStorage.setItem("panetti.lang", lang);
  } catch {
    /* localStorage blocked */
  }
  setLocale(lang);
  applyStaticI18n();
  buildLangSeg($("#lang-seg"), state.lang, setLang);
  renderRecipes();
  renderSliders();
  renderLeavenSeg();
  renderPrefermentSeg();
  render();
}

/* ---------- Wire up ---------- */
function bindEvents(): void {
  $("#mode-balls").addEventListener("click", () => setMode("balls"));
  $("#mode-flour").addEventListener("click", () => setMode("flour"));
  $("#reset-recipe").addEventListener("click", () => loadRecipe(state.recipeId));
  $("#copy-btn").addEventListener("click", copyRecipe);
  $("#share-btn").addEventListener("click", shareLink);

  $("#apply-yeast").addEventListener("click", () => {
    if (isSourdough(state)) {
      state.starter.pct = Math.round(fermentGuideStarter(state, adj));
      syncStarterInputs();
    } else {
      state.params.yeast = Number(fermentGuideYeast(state, adj).toFixed(2));
      state.leavening = "fresh";
      renderSliders();
      renderLeavenSeg();
    }
    render();
  });

  numInput("pf-pct").addEventListener("input", (e) => {
    const v = (e.target as HTMLInputElement).value;
    state.preferment.pct = Number(v);
    $("#pf-pct-val").textContent = v;
    setFill(numInput("pf-pct"), 10, 100);
    render();
  });

  numInput("st-pct").addEventListener("input", (e) => {
    const input = e.target as HTMLInputElement;
    state.starter.pct = Number(input.value);
    $("#st-pct-val").textContent = input.value;
    setFill(input, adj.starter.pctMin, adj.starter.pctMax);
    render();
  });
  numInput("st-hyd").addEventListener("input", (e) => {
    const input = e.target as HTMLInputElement;
    state.starter.hyd = Number(input.value);
    $("#st-hyd-val").textContent = input.value;
    setFill(input, adj.starter.hydMin, adj.starter.hydMax);
    render();
  });

  const numFields: Array<[string, keyof AppState]> = [
    ["ball-count", "ballCount"],
    ["ball-weight", "ballWeight"],
    ["flour-input", "flour"],
    ["flour-ball-weight", "flourBallWeight"],
    ["ferment-hours", "fermentHours"],
    ["ferment-temp", "fermentTemp"],
  ];
  numFields.forEach(([id, key]) => {
    numInput(id).addEventListener("input", (e) => {
      (state[key] as number) = Number((e.target as HTMLInputElement).value);
      render();
    });
  });
}

export function initCalculator(): void {
  state = createState(RECIPES, adj);
  state.lang = pickLang();
  setLocale(state.lang);

  // Capture the shared-link hash before the first render() overwrites it.
  const incomingHash = location.hash.slice(1);

  // config-driven starter slider ranges
  const stPct = numInput("st-pct");
  const stHyd = numInput("st-hyd");
  stPct.min = String(adj.starter.pctMin);
  stPct.max = String(adj.starter.pctMax);
  stHyd.min = String(adj.starter.hydMin);
  stHyd.max = String(adj.starter.hydMax);

  applyStaticI18n();
  hydrateIcons(); // fill brand mark + static heading/button [data-icon] placeholders
  buildLangSeg($("#lang-seg"), state.lang, setLang);

  deserializeInto(state, incomingHash, RECIPES, adj); // restore from a shared link, if any

  renderRecipes();
  renderSliders();
  renderLeavenSeg();
  renderPrefermentSeg();
  syncInputs();
  bindEvents();
  setMode(state.mode); // applies mode + renders
}
