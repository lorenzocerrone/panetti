/* ===========================================================================
   Panetti — domain types shared by the engine, data layer, and UI.
   =========================================================================== */

export type Mode = "balls" | "flour";
export type Leavening = "fresh" | "active" | "instant" | "sourdough";
export type PrefermentType = "none" | "poolish" | "biga";

/** Live, editable baker's percentages (flour = 100%). */
export interface Params {
  hydration: number;
  salt: number;
  yeast: number;
  oil: number;
  sugar: number;
}

/** A single ingredient slider's range/appearance (config/adjustments.json). */
export interface Slider {
  key: keyof Params;
  min: number;
  max: number;
  step: number;
  unit: string;
  color: string;
}

/** Per-language recipe prose stored inline in config/recipes.json. */
export interface RecipeText {
  name: string;
  blurb: string;
  notes: string;
  tip: string;
}

/** A pre-built dough style (config/recipes.json). */
export interface Recipe {
  id: string;
  icon: string;
  hydration: number;
  salt: number;
  yeast: number;
  oil: number;
  sugar: number;
  starter: number;
  ballWeight: number;
  /** Optional attribution for the recipe's figures (rendered as a link). */
  source?: { url: string; label: string };
  i18n: Record<string, RecipeText | undefined>;
}

/** Tunable model constants (config/adjustments.json). */
export interface Adjustments {
  sliders: Slider[];
  ingredientMeta: Record<string, { color: string } | undefined>;
  yeastFactors: Record<string, number | undefined>;
  leaveningOrder: Leavening[];
  starter: {
    defaultHyd: number;
    pctMin: number;
    pctMax: number;
    hydMin: number;
    hydMax: number;
  };
  preferments: Record<string, { hyd: number } | undefined>;
  preYeastPct: number;
  fermentGuide: {
    yeast: FermentGuideParams & { base: number };
    starter: FermentGuideParams & { const: number };
  };
}

export interface FermentGuideParams {
  tempHalfLife: number;
  refTemp: number;
  min: number;
  max: number;
}

/** The minimal slice of app state the pure engine reads. */
export interface EngineState {
  mode: Mode;
  leavening: Leavening;
  params: Params;
  preferment: { type: PrefermentType; pct: number };
  starter: { pct: number; hyd: number };
  /** Numeric inputs that used to live in the DOM. */
  ballCount: number;
  ballWeight: number;
  flour: number;
  flourBallWeight: number;
  fermentHours: number;
  fermentTemp: number;
}

/** Resolved ingredient weights in grams. */
export interface Ingredients {
  flour: number;
  water: number;
  salt: number;
  oil: number;
  sugar: number;
  yeast: number;
  starter: number;
  starterFlour: number;
  starterWater: number;
  totalFlour: number;
  totalWater: number;
}

/** Full result of scaling a recipe. */
export interface Computed {
  ratio: number;
  totalDough: number;
  flour: number;
  panetti: number;
  ballWeight: number;
  ing: Ingredients;
}

/** A recipe redistributed into a preferment + final-day mix. */
export interface PrefermentSplit {
  type: PrefermentType;
  preFlour: number;
  preWater: number;
  preYeast: number;
  finalFlour: number;
  finalWater: number;
  finalYeast: number;
}
