/* ===========================================================================
   Panetti — config-driven pizza dough calculator with i18n.
   Data lives in config/*.json; all text in locales/*.json. Loaded at runtime.
   =========================================================================== */

/* ---------- Runtime config (populated by loadAll) ---------- */
let RECIPES, YEAST_FACTORS, LEAVENING_ORDER, STARTER, STARTER_DEFAULT_HYD,
    PREFERMENT_HYD, PRE_YEAST_PCT, SLIDERS, INGREDIENT_META, GUIDE;
let I18N = {}, LOCALE = "en";
const LOCALES_CACHE = {};

const PREFERMENT_ORDER = ["none", "poolish", "biga"];
const LANGS = { en: "EN", it: "IT" };

/* ---------- State ---------- */
const state = {
  recipeId: null,
  mode: "balls", // "balls" | "flour"
  leavening: "fresh", // fresh | active | instant | sourdough
  lang: "en",
  params: {}, // live, editable baker's %
  preferment: { type: "none", pct: 30 },
  starter: { pct: 15, hyd: 100 },
};

const isSourdough = () => state.leavening === "sourdough";
const yeastFactor = () => (isSourdough() ? 0 : YEAST_FACTORS[state.leavening]);

/* ---------- i18n helpers ---------- */
function deepMerge(base, over) {
  if (over === undefined) return base;
  if (Array.isArray(base) || Array.isArray(over)) return over;
  if (typeof base !== "object" || base === null) return over;
  const out = { ...base };
  for (const k in over) out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  return out;
}

function tp(str, params) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    params && k in params ? params[k] : m
  );
}

// Translate a dot-path key. Returns the raw value (string or array); strings
// get {placeholder} interpolation when params are given. Missing → the key.
function t(key, params) {
  const val = key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), I18N);
  if (val === undefined) return key;
  if (typeof val === "string" && params) return tp(val, params);
  return val;
}

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const currentRecipe = () => RECIPES.find((r) => r.id === state.recipeId);
const locTag = () => (LOCALE === "it" ? "it-IT" : "en-US");
const nf = (n, max) => new Intl.NumberFormat(locTag(), { maximumFractionDigits: max }).format(n);
const nfFixed = (n, d) => new Intl.NumberFormat(locTag(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

function fmt(g) {
  const unit = t("ui.gram");
  if (g >= 1000) return nf(g / 1000, g % 1000 === 0 ? 0 : 2) + " " + t("ui.kg");
  if (g >= 100) return nf(Math.round(g), 0) + " " + unit;
  if (g >= 10) return nf(g, 1) + " " + unit;
  return nf(g, 2) + " " + unit;
}

const fmtCount = (n) => (state.mode === "flour" ? nf(n, 1) : String(Math.round(n)));

/* ---------- Math ---------- */
function totalRatio(p) {
  const base = 1 + p.hydration / 100 + p.salt / 100 + p.oil / 100 + p.sugar / 100;
  return isSourdough() ? base : base + (p.yeast / 100) * yeastFactor();
}

function ingredientsFromFlour(flour, p) {
  const totalWater = (flour * p.hydration) / 100;
  const common = {
    salt: (flour * p.salt) / 100,
    oil: (flour * p.oil) / 100,
    sugar: (flour * p.sugar) / 100,
    totalFlour: flour,
    totalWater,
  };

  if (isSourdough()) {
    const starterWeight = (flour * state.starter.pct) / 100;
    const starterFlour = starterWeight / (1 + state.starter.hyd / 100);
    const starterWater = starterWeight - starterFlour;
    return {
      ...common,
      flour: flour - starterFlour,
      water: totalWater - starterWater,
      yeast: 0,
      starter: starterWeight,
      starterFlour,
      starterWater,
    };
  }

  return {
    ...common,
    flour,
    water: totalWater,
    yeast: (flour * p.yeast * yeastFactor()) / 100,
    starter: 0,
  };
}

function compute() {
  const p = state.params;
  const ratio = totalRatio(p);
  let totalDough, flour, panetti, ballWeight;

  if (state.mode === "balls") {
    const count = Math.max(1, Number($("#ball-count").value) || 1);
    ballWeight = Math.max(1, Number($("#ball-weight").value) || 1);
    totalDough = count * ballWeight;
    flour = totalDough / ratio;
    panetti = count;
  } else {
    flour = Math.max(1, Number($("#flour-input").value) || 1);
    ballWeight = Math.max(1, Number($("#flour-ball-weight").value) || 1);
    totalDough = flour * ratio;
    panetti = totalDough / ballWeight;
  }

  return { ratio, totalDough, flour, panetti, ballWeight, ing: ingredientsFromFlour(flour, p) };
}

/* ---------- Rendering ---------- */
function renderRecipes() {
  const list = $("#recipe-list");
  list.innerHTML = "";
  RECIPES.forEach((r) => {
    const btn = document.createElement("button");
    btn.className = "recipe-card" + (r.id === state.recipeId ? " active" : "");
    btn.innerHTML = `
      <div class="rc-top">
        <span class="rc-emoji">${r.emoji}</span>
        <span class="rc-name">${t("recipes." + r.id + ".name")}</span>
      </div>
      <div class="rc-blurb">${t("recipes." + r.id + ".blurb")}</div>
      <div class="rc-tags">
        <span class="tag">${tp(t("ui.tagHydration"), { n: r.hydration })}</span>
        <span class="tag">${tp(t("ui.tagBalls"), { n: r.ballWeight })}</span>
      </div>`;
    btn.addEventListener("click", () => loadRecipe(r.id));
    list.appendChild(btn);
  });
}

function renderSliders() {
  const wrap = $("#sliders");
  wrap.innerHTML = "";
  SLIDERS.filter((s) => !(s.key === "yeast" && isSourdough())).forEach((s) => {
    const row = document.createElement("div");
    row.className = "slider-row";
    row.innerHTML = `
      <div class="sl-head">
        <span class="sl-name">${t("sliders." + s.key)}</span>
        <span class="sl-val"><span data-val="${s.key}">${state.params[s.key]}</span>${s.unit} <small data-grams="${s.key}"></small></span>
      </div>
      <input type="range" min="${s.min}" max="${s.max}" step="${s.step}"
             value="${state.params[s.key]}" data-key="${s.key}" />`;
    const input = row.querySelector("input");
    setFill(input, s);
    input.addEventListener("input", () => {
      state.params[s.key] = Number(input.value);
      row.querySelector(`[data-val="${s.key}"]`).textContent = input.value;
      setFill(input, s);
      render();
    });
    wrap.appendChild(row);
  });
}

function setFill(input, s) {
  const pct = ((input.value - s.min) / (s.max - s.min)) * 100;
  input.style.setProperty("--fill", pct + "%");
}

function renderLeavenSeg() {
  const seg = $("#yeast-seg");
  seg.innerHTML = "";
  LEAVENING_ORDER.forEach((key) => {
    const b = document.createElement("button");
    b.textContent = t("leavening." + key);
    b.className = key === state.leavening ? "active" : "";
    b.addEventListener("click", () => {
      state.leavening = key;
      onLeaveningChange();
    });
    seg.appendChild(b);
  });
}

function onLeaveningChange() {
  renderLeavenSeg();
  renderSliders();
  render();
}

function syncStarterInputs() {
  const p = $("#st-pct"), h = $("#st-hyd");
  p.value = state.starter.pct;
  h.value = state.starter.hyd;
  $("#st-pct-val").textContent = state.starter.pct;
  $("#st-hyd-val").textContent = state.starter.hyd;
  setFill(p, { min: STARTER.pctMin, max: STARTER.pctMax });
  setFill(h, { min: STARTER.hydMin, max: STARTER.hydMax });
}

function render() {
  const r = currentRecipe();
  const c = compute();
  const name = t("recipes." + r.id + ".name");
  const notes = t("recipes." + r.id + ".notes");

  $("#active-name").textContent = `${r.emoji} ${name}`;
  $("#active-blurb").textContent = t("recipes." + r.id + ".blurb");
  $("#recipe-notes").textContent = isSourdough()
    ? tp(t("ui.sourdoughNote"), { name, notes })
    : notes;

  $("#total-dough").textContent = fmt(c.totalDough);
  $("#panetti-count").textContent = fmtCount(c.panetti);

  // gram readouts under sliders (hydration shows TOTAL water)
  document.querySelectorAll("[data-grams]").forEach((el) => {
    const map = { hydration: "totalWater", salt: "salt", yeast: "yeast", oil: "oil", sugar: "sugar" };
    const ingKey = map[el.getAttribute("data-grams")];
    el.textContent = c.ing[ingKey] > 0 ? "· " + fmt(c.ing[ingKey]) : "";
  });

  // ingredients table
  const tbody = $("#ingredients tbody");
  tbody.innerHTML = "";
  const rows = isSourdough()
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
        { key: "yeast", tag: t("leavening." + state.leavening).toLowerCase(), grams: c.ing.yeast, pct: state.params.yeast * yeastFactor() },
        { key: "oil", grams: c.ing.oil, pct: state.params.oil },
        { key: "sugar", grams: c.ing.sugar, pct: state.params.sugar },
      ];
  rows.forEach((row) => {
    if (row.grams <= 0 && row.key !== "flour") return;
    const meta = INGREDIENT_META[row.key];
    const tag = row.tag ? ` <small style="color:var(--text-faint)">${row.tag}</small>` : "";
    const decimals = row.key === "yeast" ? 2 : row.pct % 1 === 0 ? 0 : 1;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="ing-dot" style="background:${meta.color}"></span>${t("ingredients." + row.key)}${tag}</td>
      <td>${fmt(row.grams)}</td>
      <td>${nfFixed(row.pct, decimals)}%</td>`;
    tbody.appendChild(tr);
  });

  renderPreferment(c);
  renderStarter(c);
  renderMethod(c);
  renderGuide();
  renderFermentTip();
  updateUrl();
}

// Step-by-step recipe card from locale method templates + computed amounts.
function renderMethod(c) {
  const extras = [];
  if (c.ing.oil > 0) extras.push(t("ingredients.oil").toLowerCase());
  if (c.ing.sugar > 0) extras.push(t("ingredients.sugar").toLowerCase());
  const extrasClause = extras.length
    ? tp(t("methods.extrasClause"), { list: extras.join(t("methods.join")) })
    : "";

  const vars = {
    flour: fmt(c.ing.flour),
    water: fmt(c.ing.water),
    yeast: fmt(c.ing.yeast),
    salt: fmt(c.ing.salt),
    starter: fmt(c.ing.starter),
    count: fmtCount(c.panetti),
    ballWeight: fmt(c.ballWeight),
    hours: String(Math.max(1, Number($("#ferment-hours").value) || 8)),
    extrasClause,
  };

  let template;
  if (isSourdough()) {
    template = t("methods.sourdough");
  } else {
    const split = prefermentSplit(c);
    if (split) {
      template = t("methods.preferment");
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
      template = t("methods.straight");
    }
  }

  $("#method-steps").innerHTML = template.map((s) => `<li>${tp(s, vars)}</li>`).join("");
}

function renderStarter(c) {
  $("#starter").hidden = !isSourdough();
  if (!isSourdough()) return;
  $("#st-pct-g").textContent = "· " + fmt(c.ing.starter);
  $("#st-hint").textContent = tp(t("ui.starterHint"), {
    flour: fmt(c.ing.starterFlour),
    water: fmt(c.ing.starterWater),
  });
}

function renderFermentTip() {
  $("#ferment-tip").textContent = isSourdough()
    ? t("tips.sourdough")
    : t("tips." + state.recipeId);
}

/* ---------- Preferment ---------- */
function renderPrefermentSeg() {
  const seg = $("#preferment-seg");
  seg.innerHTML = "";
  PREFERMENT_ORDER.forEach((key) => {
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

function rowsHtml(pairs) {
  return pairs
    .filter(([, g]) => g > 0.001)
    .map(
      ([k, g]) =>
        `<tr><td><span class="ing-dot" style="background:${INGREDIENT_META[k].color}"></span>${t("ingredients." + k)}</td><td>${fmt(g)}</td></tr>`
    )
    .join("");
}

// Redistribute (not change) the recipe into a preferment + final-day mix.
function prefermentSplit(c) {
  const type = state.preferment.type;
  if (isSourdough() || type === "none") return null;

  const pfHyd = PREFERMENT_HYD[type].hyd;
  const pct = state.preferment.pct;
  const preFlour = c.ing.flour * (pct / 100);
  const preWater = preFlour * (pfHyd / 100);
  const preYeast = Math.min(c.ing.yeast, (preFlour * (PRE_YEAST_PCT * yeastFactor())) / 100);
  return {
    type,
    preFlour,
    preWater,
    preYeast,
    finalFlour: c.ing.flour - preFlour,
    finalWater: c.ing.water - preWater,
    finalYeast: c.ing.yeast - preYeast,
  };
}

function renderPreferment(c) {
  const card = $("#preferment");
  const controls = $("#preferment-controls");
  const breakdown = $("#pf-breakdown");

  if (isSourdough()) {
    card.hidden = true;
    breakdown.hidden = true;
    return;
  }
  card.hidden = false;

  const split = prefermentSplit(c);
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

/* ---------- Ferment time/temp guide ---------- */
function fermentGuideYeast() {
  const g = GUIDE.yeast;
  const hours = Math.max(1, Number($("#ferment-hours").value) || 8);
  const temp = Number($("#ferment-temp").value);
  const activity = Math.pow(2, (temp - g.refTemp) / g.tempHalfLife);
  return Math.min(g.max, Math.max(g.min, g.base / (hours * activity)));
}

function fermentGuideStarter() {
  const g = GUIDE.starter;
  const hours = Math.max(1, Number($("#ferment-hours").value) || 5);
  const temp = Number($("#ferment-temp").value);
  const activity = Math.pow(2, (temp - g.refTemp) / g.tempHalfLife);
  return Math.min(g.max, Math.max(g.min, g.const / (hours * activity)));
}

function renderGuide() {
  if (isSourdough()) {
    $("#guide-label").textContent = t("ui.suggestedStarter");
    $("#guide-yeast").textContent = Math.round(fermentGuideStarter()) + "%";
  } else {
    $("#guide-label").textContent = t("ui.suggestedYeast");
    $("#guide-yeast").textContent = nfFixed(fermentGuideYeast(), 2) + "%";
  }
}

/* ---------- URL persistence ---------- */
const URL_KEYS = {
  lang: () => state.lang,
  r: () => state.recipeId,
  m: () => state.mode,
  y: () => state.leavening,
  h: () => state.params.hydration,
  s: () => state.params.salt,
  ye: () => state.params.yeast,
  o: () => state.params.oil,
  su: () => state.params.sugar,
  bc: () => $("#ball-count").value,
  bw: () => $("#ball-weight").value,
  fl: () => $("#flour-input").value,
  fbw: () => $("#flour-ball-weight").value,
  pf: () => state.preferment.type,
  pfp: () => state.preferment.pct,
  sp: () => state.starter.pct,
  sh: () => state.starter.hyd,
};

function updateUrl() {
  const q = new URLSearchParams();
  Object.entries(URL_KEYS).forEach(([k, get]) => q.set(k, get()));
  history.replaceState(null, "", "#" + q.toString());
}

function applyUrlState(raw) {
  if (raw == null) raw = location.hash.slice(1);
  if (!raw) return;
  const q = new URLSearchParams(raw);
  const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);

  if (q.has("r") && RECIPES.some((x) => x.id === q.get("r"))) state.recipeId = q.get("r");
  loadRecipe(state.recipeId); // defaults; overridden below

  if (q.has("y") && LEAVENING_ORDER.includes(q.get("y"))) state.leavening = q.get("y");
  state.params.hydration = num("h", state.params.hydration);
  state.params.salt = num("s", state.params.salt);
  state.params.yeast = num("ye", state.params.yeast);
  state.params.oil = num("o", state.params.oil);
  state.params.sugar = num("su", state.params.sugar);
  if (q.has("bc")) $("#ball-count").value = q.get("bc");
  if (q.has("bw")) $("#ball-weight").value = q.get("bw");
  if (q.has("fl")) $("#flour-input").value = q.get("fl");
  if (q.has("fbw")) $("#flour-ball-weight").value = q.get("fbw");
  if (q.has("pf") && PREFERMENT_ORDER.includes(q.get("pf"))) state.preferment.type = q.get("pf");
  state.preferment.pct = num("pfp", state.preferment.pct);
  $("#pf-pct").value = state.preferment.pct;
  $("#pf-pct-val").textContent = state.preferment.pct;
  state.starter.pct = num("sp", state.starter.pct);
  state.starter.hyd = num("sh", state.starter.hyd);
  syncStarterInputs();
  if (q.has("m")) state.mode = q.get("m");

  renderSliders();
  renderLeavenSeg();
  renderPrefermentSeg();
}

/* ---------- Actions ---------- */
function loadRecipe(id) {
  state.recipeId = id;
  const r = currentRecipe();
  state.params = {
    hydration: r.hydration,
    salt: r.salt,
    yeast: r.yeast,
    oil: r.oil,
    sugar: r.sugar,
  };
  state.starter = { pct: r.starter, hyd: STARTER_DEFAULT_HYD };
  syncStarterInputs();
  $("#ball-weight").value = r.ballWeight;
  $("#flour-ball-weight").value = r.ballWeight;
  renderRecipes();
  renderSliders();
  render();
}

function setMode(mode) {
  state.mode = mode;
  $("#mode-balls").classList.toggle("active", mode === "balls");
  $("#mode-flour").classList.toggle("active", mode === "flour");
  document.querySelectorAll("[data-mode]").forEach((el) => {
    el.hidden = el.getAttribute("data-mode") !== mode;
  });
  render();
}

function copyRecipe() {
  const r = currentRecipe();
  const c = compute();
  const name = t("recipes." + r.id + ".name");
  const lines = [
    `${r.emoji} ${name} — ${fmt(c.totalDough)} ${t("ui.totalDough")}`,
    `${fmtCount(c.panetti)} ${t("ui.panettiLabel")} × ${fmt(c.ballWeight)}`,
    "",
  ];
  const keys = isSourdough()
    ? ["flour", "water", "starter", "salt", "oil", "sugar"]
    : ["flour", "water", "salt", "yeast", "oil", "sugar"];
  keys.forEach((k) => {
    if (c.ing[k] > 0 || k === "flour")
      lines.push(`${t("ingredients." + k).padEnd(18)} ${fmt(c.ing[k])}`);
  });
  lines.push("");
  lines.push(
    isSourdough()
      ? tp(t("ui.copyLeaveningSourdough"), { pct: state.starter.pct, hyd: state.starter.hyd })
      : tp(t("ui.copyLeaveningYeast"), { label: t("leavening." + state.leavening) })
  );
  lines.push(t("recipes." + r.id + ".notes"));
  navigator.clipboard.writeText(lines.join("\n")).then(() => showToast(t("ui.copied")));
}

function shareLink() {
  updateUrl();
  navigator.clipboard.writeText(location.href).then(() => showToast(t("ui.linkCopied")));
}

function showToast(msg) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1600);
}

/* ---------- Localization application ---------- */
function applyStaticI18n() {
  document.documentElement.lang = state.lang;
  document.title = t("ui.appTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.getAttribute("data-i18n-title"));
  });
}

function renderLangSeg() {
  const seg = $("#lang-seg");
  seg.innerHTML = "";
  Object.entries(LANGS).forEach(([code, label]) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = code === state.lang ? "active" : "";
    b.addEventListener("click", () => {
      if (code !== state.lang) setLang(code);
    });
    seg.appendChild(b);
  });
}

async function setLang(lang) {
  state.lang = lang;
  try {
    localStorage.setItem("panetti.lang", lang);
  } catch (e) {}
  if (lang !== "en" && !LOCALES_CACHE[lang]) {
    LOCALES_CACHE[lang] = await fetchJson(`locales/${lang}.json`);
  }
  I18N = deepMerge(LOCALES_CACHE.en, lang === "en" ? {} : LOCALES_CACHE[lang]);
  LOCALE = lang;
  applyStaticI18n();
  renderLangSeg();
  renderRecipes();
  renderSliders();
  renderLeavenSeg();
  renderPrefermentSeg();
  render();
}

/* ---------- Loading ---------- */
async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error("Failed to load " + path);
  return res.json();
}

function pickLang() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (q.has("lang") && LANGS[q.get("lang")]) return q.get("lang");
  try {
    const stored = localStorage.getItem("panetti.lang");
    if (stored && LANGS[stored]) return stored;
  } catch (e) {}
  return (navigator.language || "en").toLowerCase().startsWith("it") ? "it" : "en";
}

function buildRuntime(recipes, adj) {
  RECIPES = recipes;
  YEAST_FACTORS = adj.yeastFactors;
  LEAVENING_ORDER = adj.leaveningOrder;
  STARTER = adj.starter;
  STARTER_DEFAULT_HYD = adj.starter.defaultHyd;
  PREFERMENT_HYD = adj.preferments;
  PRE_YEAST_PCT = adj.preYeastPct;
  SLIDERS = adj.sliders;
  INGREDIENT_META = adj.ingredientMeta;
  GUIDE = adj.fermentGuide;
}

async function loadAll(lang) {
  const [recipes, adj, en, loc] = await Promise.all([
    fetchJson("config/recipes.json"),
    fetchJson("config/adjustments.json"),
    fetchJson("locales/en.json"),
    lang === "en" ? Promise.resolve(null) : fetchJson(`locales/${lang}.json`),
  ]);
  LOCALES_CACHE.en = en;
  if (loc) LOCALES_CACHE[lang] = loc;
  I18N = deepMerge(en, loc || {});
  LOCALE = lang;
  buildRuntime(recipes, adj);
}

/* ---------- Wire up ---------- */
async function init() {
  state.lang = pickLang();
  // Capture the shared-link hash now: the first render() calls updateUrl(),
  // which would otherwise overwrite it with default state before we read it.
  const incomingHash = location.hash.slice(1);
  try {
    await loadAll(state.lang);
  } catch (e) {
    document.body.innerHTML =
      '<div style="padding:42px;max-width:560px;margin:40px auto;font-family:system-ui,sans-serif;color:#f4ece3;background:#261e18;border-radius:18px;line-height:1.6">🍕 ' +
      "Couldn't load the config files. Serve this page over http (e.g. <code>python3 -m http.server</code>) instead of opening it directly from disk." +
      "</div>";
    return;
  }

  state.recipeId = RECIPES[0].id;
  // apply config-driven starter slider ranges
  $("#st-pct").min = STARTER.pctMin; $("#st-pct").max = STARTER.pctMax;
  $("#st-hyd").min = STARTER.hydMin; $("#st-hyd").max = STARTER.hydMax;

  applyStaticI18n();
  renderLangSeg();
  loadRecipe(state.recipeId);
  renderLeavenSeg();
  renderPrefermentSeg();
  applyUrlState(incomingHash); // restore from a shared link, if any
  setMode(state.mode);         // applies mode + renders

  $("#mode-balls").addEventListener("click", () => setMode("balls"));
  $("#mode-flour").addEventListener("click", () => setMode("flour"));
  $("#reset-recipe").addEventListener("click", () => loadRecipe(state.recipeId));
  $("#copy-btn").addEventListener("click", copyRecipe);
  $("#share-btn").addEventListener("click", shareLink);
  $("#apply-yeast").addEventListener("click", () => {
    if (isSourdough()) {
      state.starter.pct = Math.round(fermentGuideStarter());
      syncStarterInputs();
    } else {
      state.params.yeast = Number(fermentGuideYeast().toFixed(2));
      state.leavening = "fresh";
      renderSliders();
      renderLeavenSeg();
    }
    render();
  });

  const pfPct = $("#pf-pct");
  const fillPf = () =>
    pfPct.style.setProperty("--fill", ((pfPct.value - 10) / (100 - 10)) * 100 + "%");
  fillPf();
  pfPct.addEventListener("input", (e) => {
    state.preferment.pct = Number(e.target.value);
    $("#pf-pct-val").textContent = e.target.value;
    fillPf();
    render();
  });

  $("#st-pct").addEventListener("input", (e) => {
    state.starter.pct = Number(e.target.value);
    $("#st-pct-val").textContent = e.target.value;
    setFill(e.target, { min: STARTER.pctMin, max: STARTER.pctMax });
    render();
  });
  $("#st-hyd").addEventListener("input", (e) => {
    state.starter.hyd = Number(e.target.value);
    $("#st-hyd-val").textContent = e.target.value;
    setFill(e.target, { min: STARTER.hydMin, max: STARTER.hydMax });
    render();
  });

  ["ball-count", "ball-weight", "flour-input", "flour-ball-weight",
   "ferment-hours", "ferment-temp"].forEach((id) =>
    $("#" + id).addEventListener("input", render)
  );
}

document.addEventListener("DOMContentLoaded", init);
