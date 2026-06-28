import { describe, expect, it } from "vitest";
import {
  compute,
  fermentGuideStarter,
  fermentGuideYeast,
  ingredientsFromFlour,
  prefermentSplit,
  totalRatio,
  yeastFactor,
} from "./dough";
import { ADJUSTMENTS, RECIPES } from "../data/config";
import type { EngineState, Leavening } from "./types";

const adj = ADJUSTMENTS;
const recipe = (id: string) => {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) throw new Error(`missing recipe ${id}`);
  return r;
};

/** Build an engine state from a recipe's defaults, with overrides. */
function stateFor(id: string, over: Partial<EngineState> = {}): EngineState {
  const r = recipe(id);
  return {
    mode: "balls",
    leavening: "fresh",
    params: { hydration: r.hydration, salt: r.salt, yeast: r.yeast, oil: r.oil, sugar: r.sugar },
    preferment: { type: "none", pct: 30 },
    starter: { pct: r.starter, hyd: adj.starter.defaultHyd },
    ballCount: 4,
    ballWeight: r.ballWeight,
    flour: 1000,
    flourBallWeight: r.ballWeight,
    fermentHours: 8,
    fermentTemp: 20,
    ...over,
  };
}

describe("totalRatio", () => {
  it("matches the hand-derived Neapolitan ratio (fresh yeast)", () => {
    // 1 + 0.59 + 0.029 + 0 + 0 + (0.15/100 * 1) = 1.6205
    const s = stateFor("neapolitan");
    expect(totalRatio(s.params, s, adj)).toBeCloseTo(1.6205, 10);
  });

  it("excludes yeast from the ratio for sourdough", () => {
    const s = stateFor("neapolitan", { leavening: "sourdough" });
    // 1 + 0.59 + 0.029 = 1.619 (no yeast term)
    expect(totalRatio(s.params, s, adj)).toBeCloseTo(1.619, 10);
  });

  it("includes oil and sugar (focaccia)", () => {
    // 1 + 0.80 + 0.025 + 0.06 + 0 + (0.4/100) = 1.889
    const s = stateFor("focaccia");
    expect(totalRatio(s.params, s, adj)).toBeCloseTo(1.889, 10);
  });
});

describe("compute — balls mode (golden values)", () => {
  const s = stateFor("neapolitan"); // 4 balls × 250g, fresh
  const c = compute(s, adj);

  it("total dough = count × ball weight", () => {
    expect(c.totalDough).toBe(1000);
    expect(c.panetti).toBe(4);
  });
  it("flour = totalDough / ratio", () => {
    expect(c.flour).toBeCloseTo(1000 / 1.6205, 9);
  });
  it("water = flour × hydration", () => {
    expect(c.ing.water).toBeCloseTo((1000 / 1.6205) * 0.59, 9);
  });
  it("salt and yeast scale off flour", () => {
    expect(c.ing.salt).toBeCloseTo((1000 / 1.6205) * 0.029, 9);
    expect(c.ing.yeast).toBeCloseTo((1000 / 1.6205) * 0.0015, 9);
  });
});

describe("compute — flour mode", () => {
  const s = stateFor("neapolitan", { mode: "flour", flour: 1000, flourBallWeight: 250 });
  const c = compute(s, adj);

  it("total dough = flour × ratio; panetti = dough / ball weight", () => {
    expect(c.flour).toBe(1000);
    expect(c.totalDough).toBeCloseTo(1620.5, 9);
    expect(c.panetti).toBeCloseTo(1620.5 / 250, 9);
  });
});

describe("yeast conversion factors", () => {
  it("active dry and instant scale the yeast weight by their factor", () => {
    const base = compute(stateFor("neapolitan", { leavening: "fresh" }), adj).ing.yeast;
    const active = compute(stateFor("neapolitan", { leavening: "active" }), adj);
    const instant = compute(stateFor("neapolitan", { leavening: "instant" }), adj);
    // factors: active 0.4, instant 0.33 — note the dough ratio also shifts,
    // so compare the yeast %, which is params.yeast × factor.
    expect(yeastFactor(stateFor("neapolitan", { leavening: "active" }), adj)).toBe(0.4);
    expect(yeastFactor(stateFor("neapolitan", { leavening: "instant" }), adj)).toBe(0.33);
    expect(active.ing.yeast).toBeGreaterThan(0);
    expect(active.ing.yeast).toBeLessThan(base);
    expect(instant.ing.yeast).toBeLessThan(active.ing.yeast);
  });
});

describe("sourdough ingredient split", () => {
  const s = stateFor("neapolitan", { leavening: "sourdough", starter: { pct: 15, hyd: 100 } });
  const c = compute(s, adj);

  it("has no commercial yeast", () => {
    expect(c.ing.yeast).toBe(0);
    expect(yeastFactor(s, adj)).toBe(0);
  });
  it("starter = its flour + its water", () => {
    expect(c.ing.starterFlour + c.ing.starterWater).toBeCloseTo(c.ing.starter, 9);
  });
  it("at 100% hydration the starter is half flour, half water", () => {
    expect(c.ing.starterFlour).toBeCloseTo(c.ing.starterWater, 9);
  });
  it("added flour/water + starter portion conserve the totals", () => {
    expect(c.ing.flour + c.ing.starterFlour).toBeCloseTo(c.ing.totalFlour, 9);
    expect(c.ing.water + c.ing.starterWater).toBeCloseTo(c.ing.totalWater, 9);
  });
});

describe("preferment split — mass conservation", () => {
  for (const type of ["poolish", "biga"] as const) {
    it(`${type}: pre + final equals the straight recipe`, () => {
      const s = stateFor("neapolitan", { preferment: { type, pct: 30 } });
      const c = compute(s, adj);
      const split = prefermentSplit(c, s, adj);
      expect(split).not.toBeNull();
      if (!split) return;
      expect(split.preFlour + split.finalFlour).toBeCloseTo(c.ing.flour, 9);
      expect(split.preWater + split.finalWater).toBeCloseTo(c.ing.water, 9);
      expect(split.preYeast + split.finalYeast).toBeCloseTo(c.ing.yeast, 9);
    });
  }

  it("returns null for sourdough and for 'none'", () => {
    const sNone = stateFor("neapolitan", { preferment: { type: "none", pct: 30 } });
    expect(prefermentSplit(compute(sNone, adj), sNone, adj)).toBeNull();
    const sSour = stateFor("neapolitan", { leavening: "sourdough", preferment: { type: "poolish", pct: 30 } });
    expect(prefermentSplit(compute(sSour, adj), sSour, adj)).toBeNull();
  });

  it("biga uses its configured low hydration", () => {
    const s = stateFor("neapolitan", { preferment: { type: "biga", pct: 50 } });
    const c = compute(s, adj);
    const split = prefermentSplit(c, s, adj)!;
    expect(split.preWater).toBeCloseTo(split.preFlour * (adj.preferments.biga!.hyd / 100), 9);
  });
});

describe("ferment guide", () => {
  it("yeast: at reference temp, suggestion = base / hours", () => {
    const s = stateFor("neapolitan", { fermentHours: 8, fermentTemp: 20 });
    expect(fermentGuideYeast(s, adj)).toBeCloseTo(adj.fermentGuide.yeast.base / 8, 9);
  });

  it("yeast: clamps to the configured max for hot + short proofs", () => {
    const s = stateFor("neapolitan", { fermentHours: 1, fermentTemp: 2 });
    expect(fermentGuideYeast(s, adj)).toBe(adj.fermentGuide.yeast.max);
  });

  it("yeast: clamps to the configured min for warm + very long proofs", () => {
    // high activity (warm) over many hours drives the suggestion below the floor
    const s = stateFor("neapolitan", { fermentHours: 120, fermentTemp: 35 });
    expect(fermentGuideYeast(s, adj)).toBe(adj.fermentGuide.yeast.min);
  });

  it("starter: stays within configured bounds", () => {
    const s = stateFor("neapolitan", { fermentHours: 8, fermentTemp: 20 });
    const v = fermentGuideStarter(s, adj);
    expect(v).toBeGreaterThanOrEqual(adj.fermentGuide.starter.min);
    expect(v).toBeLessThanOrEqual(adj.fermentGuide.starter.max);
  });
});

describe("ingredientsFromFlour is independent of scaling mode", () => {
  it("produces identical ingredients for the same flour weight", () => {
    const leavenings: Leavening[] = ["fresh", "active", "instant", "sourdough"];
    for (const lv of leavenings) {
      const s = stateFor("roman-teglia", { leavening: lv });
      const a = ingredientsFromFlour(900, s.params, s, adj);
      const b = ingredientsFromFlour(900, s.params, s, adj);
      expect(a).toEqual(b);
    }
  });
});
