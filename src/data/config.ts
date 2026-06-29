/* ===========================================================================
   Panetti — typed, build-time config. Importing the JSON (rather than fetching
   it) means a bad recipe field or a missing slider key is a compile error, and
   there's zero config round-trip at boot.
   =========================================================================== */

import recipesData from "../../config/recipes.json";
import adjustmentsData from "../../config/adjustments.json";
import pagesData from "../../config/pages.json";
import type { Adjustments, Recipe } from "../engine/types";

// Direct typed assignment: TS validates the JSON against the Recipe shape.
export const RECIPES: Recipe[] = recipesData;

// A single narrowing cast for the string-literal unions (leaveningOrder).
export const ADJUSTMENTS = adjustmentsData as Adjustments;

export interface PageRef {
  id: string;
  icon: string;
}
export const PAGES: PageRef[] = pagesData;
