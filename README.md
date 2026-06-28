# 🍕 Panetti — Pizza Dough Calculator

A slick, dependency-free static page for scaling pizza dough recipes using
**baker's percentages**. Pick a style, dial in hydration/salt/yeast/oil, and it
computes exact gram weights for any number of *panetti* (dough balls).

![Plain HTML/CSS/JS — no build step](https://img.shields.io/badge/build-none-brightgreen)

## Features

- **Pre-built styles** — Neapolitan, New York, Roman al taglio, Sicilian, Detroit, Focaccia.
- **On-the-fly tuning** — sliders for hydration, salt, yeast, oil and sugar; live gram readouts.
- **Two calculation modes**
  - *By dough balls* — enter count × weight, get the full ingredient list.
  - *By flour weight* — enter the flour you have, see how many panetti it yields.
- **Leavening choice** — Fresh yeast · Active dry · Instant · **Sourdough**. The three yeast types convert automatically. Picking **Sourdough** swaps in a starter model: the yeast slider is replaced by Starter % (of flour) and Starter hydration sliders, the starter's flour & water are split out of the totals (so the "flour/water to add" stay accurate), and the Poolish/Biga splitter is hidden (the starter is the natural preferment).
- **Ferment guide** — enter proof time + temperature, get a suggested fresh-yeast % (calibrated so 8 h @ 20 °C ≈ 0.25 %), or a suggested **starter %** in sourdough mode (≈ 20 % @ 24 °C → ~5 h bulk); one click applies it to the recipe.
- **Poolish / Biga preferment** — split a chosen % of the flour into a preferment (the night before) and get a separate ingredient table for the preferment and the final dough. The preferment carries a small, realistic yeast dose while the remainder is added on mixing day — totals are always conserved (the preferment only *redistributes* the recipe).
- **Method card** — a step-by-step timeline with the actual gram amounts that adapts to the leavening and preferment: straight dough, night-before poolish/biga, or sourdough stretch-and-folds.
- **Save / share via URL** — every change is encoded into the URL hash; the 🔗 share button copies a link that reopens the exact dough.
- **Copy to clipboard** — grab a clean text recipe card.
- **Localization (English / Italian)** — auto-detects the browser language on first load (Italian → `it`, anything else → English), with a manual EN/IT switch in the top bar that's remembered (URL hash + `localStorage`). Numbers are locale-formatted (Italian uses a decimal comma).

## Configuration (no code, just JSON)

All data and text live in editable JSON files loaded at runtime — **no build step**:

```
config/
  recipes.json      # the pre-built styles: each entry has its numbers (hydration, salt,
                    #   yeast, oil, sugar, starter %, ball weight, emoji) AND its text per
                    #   language under i18n.<lang> = { name, blurb, notes, tip }.
  adjustments.json  # the tunables: slider ranges/steps/colors, leavening conversion
                    #   factors, preferment hydration %, the small preferment yeast dose,
                    #   sourdough starter defaults/ranges, and the ferment-guide formulas.
locales/
  en.json           # BASE — the UI strings: labels, ingredient/leavening/preferment names,
                    #   the generic sourdough tip, and the step-by-step method templates.
  it.json           # Italian overlay; any missing key falls back to the English base.
```

**Recipes are self-contained:** a recipe's numbers and all its localized text live together
in one `config/recipes.json` entry, so you edit a recipe (in any language) in a single place.
Missing a translation? `i18n.<lang>` falls back to `i18n.en`.

**Method steps** are data: each scenario (`straight`, `preferment`, `sourdough`) is an array
of templates in the locale files, with `{placeholders}` (e.g. `{flour}`, `{preWater}`,
`{count}`) filled in with the live amounts. Edit, reorder, or add steps without touching code.
To add a recipe: add one entry to `config/recipes.json` with its numbers and an `i18n` block.
To add a language: drop in `locales/<code>.json`, add an `i18n.<code>` block to each recipe,
and add the code to `LANGS` in `i18n.js`.

> ⚠️ Because the config is fetched at runtime, the page must be **served over http**
> (`python3 -m http.server`, GitHub Pages, …) — opening `index.html` directly from disk
> (`file://`) is blocked by the browser and shows a friendly message.

## Pages & content (Markdown)

Beyond the calculator there are two content pages — **About** (`about.html`) and
**Guides** (`guides.html`) — whose prose lives in plain Markdown, one file per language,
rendered in the browser by the vendored [`lib/snarkdown.js`](lib/snarkdown.js) (no build,
no CDN, works offline):

```
content/
  about.<lang>.md        # the About page
  guide-<id>.<lang>.md   # one guide article per id
config/
  pages.json             # the guides list: [{ "id": "flour", "emoji": "🌾" }, …]
```

Missing a translation? The loader falls back to the English file automatically
(`<slug>.en.md`), exactly like the locale JSON fallback.

**To add a guide:** drop `content/guide-<id>.en.md` (and any `content/guide-<id>.<lang>.md`
translations), add one line `{ "id": "<id>", "emoji": "…" }` to `config/pages.json`, and a
title under `guides.<id>.title` in each `locales/*.json`. No code changes.

> Markdown notes: snarkdown is a tiny renderer — keep each list item on a **single line**
> and avoid tables (use lists). Headings, bold/italic, links, inline `code`, blockquotes
> and code blocks all work.

## The math

Everything is a percentage of flour weight (flour = 100%):

```
totalRatio = 1 + hydration% + salt% + yeast% + oil% + sugar%
flour      = totalDough / totalRatio
water      = flour × hydration%
…and so on for each ingredient.
```

## Run locally

It's a static site — just open `index.html`, or serve it:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Deploy to GitHub Pages

A GitHub Actions workflow at `.github/workflows/pages.yml` validates the site
(JSON config/locales parse, JS syntax) on every push and pull request,
then deploys to Pages when validation passes on `main`.

1. Push these files to a repo (the site lives at the repo root).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the workflow manually) — the `validate` job runs,
   then `deploy` publishes to `https://<user>.github.io/<repo>/`.

> Prefer no Actions? Pick **Source: Deploy from a branch** → `main` / `/ (root)`
> instead; the workflow's deploy step is then skipped, but CI validation still
> runs on pushes and PRs.

## Customising recipes

All recipe data lives in [`config/recipes.json`](config/recipes.json) — numbers
**and** localized text in one entry. Add an object with an `id`, the numbers
(`yeast` is expressed as **fresh-yeast %** and converted automatically for the
other yeast types), and an `i18n` block with `{ name, blurb, notes, tip }` for
each language:

```json
{
  "id": "my-style", "emoji": "🍕",
  "hydration": 65, "salt": 2.5, "yeast": 0.2, "oil": 0, "sugar": 0,
  "starter": 15, "ballWeight": 250,
  "i18n": {
    "en": { "name": "…", "blurb": "…", "notes": "…", "tip": "…" },
    "it": { "name": "…", "blurb": "…", "notes": "…", "tip": "…" }
  }
}
```

No locale-file edits are needed for a recipe — `locales/*.json` hold only UI
strings. A missing `i18n.<lang>` falls back to `i18n.en`.
