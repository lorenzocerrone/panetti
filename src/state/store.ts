/* ===========================================================================
   Panetti — the single source of truth. Unlike the POC, the numeric inputs
   (ball count/weight, flour, ferment time/temp) live here in state rather than
   in the DOM, which is what lets the engine stay pure and testable.

   The shareable URL uses a clean versioned schema (v=2); unrecognised hashes
   are ignored, so old POC links simply fall back to defaults.
   =========================================================================== */

import type { AppState } from "./types";
import type { Adjustments, Leavening, Mode, PrefermentType, Recipe } from "../engine/types";

const LEAVENINGS: Leavening[] = ["fresh", "active", "instant", "sourdough"];
const PREFERMENTS: PrefermentType[] = ["none", "poolish", "biga"];
const MODES: Mode[] = ["balls", "flour"];

export const SCHEMA_VERSION = "2";

/** Build the default state, with the first recipe applied. */
export function createState(recipes: Recipe[], adj: Adjustments): AppState {
  const first = recipes[0]!;
  const s: AppState = {
    lang: "en",
    recipeId: first.id,
    mode: "balls",
    leavening: "fresh",
    params: { hydration: 0, salt: 0, yeast: 0, oil: 0, sugar: 0 },
    preferment: { type: "none", pct: 30 },
    starter: { pct: 15, hyd: adj.starter.defaultHyd },
    ballCount: 4,
    ballWeight: 250,
    flour: 1000,
    flourBallWeight: 250,
    fermentHours: 8,
    fermentTemp: 20,
  };
  applyRecipe(s, first, adj);
  return s;
}

/** Reset the editable params/starter/ball weights to a recipe's defaults. */
export function applyRecipe(s: AppState, recipe: Recipe, adj: Adjustments): void {
  s.recipeId = recipe.id;
  s.params = {
    hydration: recipe.hydration,
    salt: recipe.salt,
    yeast: recipe.yeast,
    oil: recipe.oil,
    sugar: recipe.sugar,
  };
  s.starter = { pct: recipe.starter, hyd: adj.starter.defaultHyd };
  s.ballWeight = recipe.ballWeight;
  s.flourBallWeight = recipe.ballWeight;
}

/* ---------- URL serialization ---------- */

/** Encode the full state as a hash string (without the leading '#'). */
export function serializeState(s: AppState): string {
  const q = new URLSearchParams();
  q.set("v", SCHEMA_VERSION);
  q.set("lang", s.lang);
  q.set("r", s.recipeId);
  q.set("m", s.mode);
  q.set("lv", s.leavening);
  q.set("hy", String(s.params.hydration));
  q.set("sa", String(s.params.salt));
  q.set("ye", String(s.params.yeast));
  q.set("oi", String(s.params.oil));
  q.set("su", String(s.params.sugar));
  q.set("bc", String(s.ballCount));
  q.set("bw", String(s.ballWeight));
  q.set("fl", String(s.flour));
  q.set("fbw", String(s.flourBallWeight));
  q.set("pf", s.preferment.type);
  q.set("pfp", String(s.preferment.pct));
  q.set("sp", String(s.starter.pct));
  q.set("sh", String(s.starter.hyd));
  q.set("fh", String(s.fermentHours));
  q.set("ft", String(s.fermentTemp));
  return q.toString();
}

/**
 * Apply a hash string onto state in place. Recipe defaults are applied first
 * (so partial/edited params layer on top), then validated overrides. Unknown
 * or version-mismatched hashes are ignored.
 */
export function deserializeInto(
  s: AppState,
  raw: string,
  recipes: Recipe[],
  adj: Adjustments,
): void {
  if (!raw) return;
  const q = new URLSearchParams(raw);
  if (q.get("v") !== SCHEMA_VERSION) return;

  const num = (key: string, fallback: number): number => {
    const v = q.get(key);
    if (v == null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const lang = q.get("lang");
  if (lang) s.lang = lang;

  const rid = q.get("r");
  const recipe = recipes.find((r) => r.id === rid);
  if (recipe) applyRecipe(s, recipe, adj);

  const lv = q.get("lv");
  if (lv && (LEAVENINGS as string[]).includes(lv)) s.leavening = lv as Leavening;

  const m = q.get("m");
  if (m && (MODES as string[]).includes(m)) s.mode = m as Mode;

  s.params.hydration = num("hy", s.params.hydration);
  s.params.salt = num("sa", s.params.salt);
  s.params.yeast = num("ye", s.params.yeast);
  s.params.oil = num("oi", s.params.oil);
  s.params.sugar = num("su", s.params.sugar);

  s.ballCount = num("bc", s.ballCount);
  s.ballWeight = num("bw", s.ballWeight);
  s.flour = num("fl", s.flour);
  s.flourBallWeight = num("fbw", s.flourBallWeight);

  const pf = q.get("pf");
  if (pf && (PREFERMENTS as string[]).includes(pf)) s.preferment.type = pf as PrefermentType;
  s.preferment.pct = num("pfp", s.preferment.pct);

  s.starter.pct = num("sp", s.starter.pct);
  s.starter.hyd = num("sh", s.starter.hyd);

  s.fermentHours = num("fh", s.fermentHours);
  s.fermentTemp = num("ft", s.fermentTemp);
}
