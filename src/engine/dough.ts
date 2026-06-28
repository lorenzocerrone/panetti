/* ===========================================================================
   Panetti — pure dough math. No DOM, no globals: every function is a pure
   transformation of (state, adjustments). This is the tested core; behaviour
   mirrors the original POC app.js (compute / ingredientsFromFlour /
   prefermentSplit / fermentGuide) exactly.
   =========================================================================== */

import type {
  Adjustments,
  Computed,
  EngineState,
  Ingredients,
  Params,
  PrefermentSplit,
} from "./types";

export const isSourdough = (s: Pick<EngineState, "leavening">): boolean =>
  s.leavening === "sourdough";

/** Weight multiplier vs fresh yeast (0 for sourdough — yeast is replaced). */
export function yeastFactor(s: EngineState, adj: Adjustments): number {
  if (isSourdough(s)) return 0;
  return adj.yeastFactors[s.leavening] ?? 1;
}

/** Total dough weight per 1 unit of flour (flour = 1). */
export function totalRatio(p: Params, s: EngineState, adj: Adjustments): number {
  const base = 1 + p.hydration / 100 + p.salt / 100 + p.oil / 100 + p.sugar / 100;
  return isSourdough(s) ? base : base + (p.yeast / 100) * yeastFactor(s, adj);
}

/** Resolve every ingredient weight from a known flour total. */
export function ingredientsFromFlour(
  flour: number,
  p: Params,
  s: EngineState,
  adj: Adjustments,
): Ingredients {
  const totalWater = (flour * p.hydration) / 100;
  const common = {
    salt: (flour * p.salt) / 100,
    oil: (flour * p.oil) / 100,
    sugar: (flour * p.sugar) / 100,
    totalFlour: flour,
    totalWater,
  };

  if (isSourdough(s)) {
    const starterWeight = (flour * s.starter.pct) / 100;
    const starterFlour = starterWeight / (1 + s.starter.hyd / 100);
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
    yeast: (flour * p.yeast * yeastFactor(s, adj)) / 100,
    starter: 0,
    starterFlour: 0,
    starterWater: 0,
  };
}

/** Scale a recipe by dough-ball count or by flour weight. */
export function compute(s: EngineState, adj: Adjustments): Computed {
  const p = s.params;
  const ratio = totalRatio(p, s, adj);
  let totalDough: number;
  let flour: number;
  let panetti: number;
  let ballWeight: number;

  if (s.mode === "balls") {
    const count = Math.max(1, s.ballCount || 1);
    ballWeight = Math.max(1, s.ballWeight || 1);
    totalDough = count * ballWeight;
    flour = totalDough / ratio;
    panetti = count;
  } else {
    flour = Math.max(1, s.flour || 1);
    ballWeight = Math.max(1, s.flourBallWeight || 1);
    totalDough = flour * ratio;
    panetti = totalDough / ballWeight;
  }

  return { ratio, totalDough, flour, panetti, ballWeight, ing: ingredientsFromFlour(flour, p, s, adj) };
}

/**
 * Redistribute (not change) the recipe into a preferment + final-day mix.
 * Returns null when sourdough or no preferment is selected.
 */
export function prefermentSplit(
  c: Computed,
  s: EngineState,
  adj: Adjustments,
): PrefermentSplit | null {
  const type = s.preferment.type;
  if (isSourdough(s) || type === "none") return null;

  const pf = adj.preferments[type];
  if (!pf) return null;

  const pct = s.preferment.pct;
  const preFlour = c.ing.flour * (pct / 100);
  const preWater = preFlour * (pf.hyd / 100);
  const preYeast = Math.min(c.ing.yeast, (preFlour * (adj.preYeastPct * yeastFactor(s, adj))) / 100);
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

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Suggested fresh-yeast % for a target proof time/temperature. */
export function fermentGuideYeast(s: EngineState, adj: Adjustments): number {
  const g = adj.fermentGuide.yeast;
  const hours = Math.max(1, s.fermentHours || 8);
  const activity = Math.pow(2, (s.fermentTemp - g.refTemp) / g.tempHalfLife);
  return clamp(g.base / (hours * activity), g.min, g.max);
}

/** Suggested sourdough-starter % for a target proof time/temperature. */
export function fermentGuideStarter(s: EngineState, adj: Adjustments): number {
  const g = adj.fermentGuide.starter;
  const hours = Math.max(1, s.fermentHours || 5);
  const activity = Math.pow(2, (s.fermentTemp - g.refTemp) / g.tempHalfLife);
  return clamp(g.const / (hours * activity), g.min, g.max);
}
