/* ===========================================================================
   Panetti — full application state. Extends the engine's input slice with the
   selected recipe and language.
   =========================================================================== */

import type { EngineState } from "../engine/types";

export interface AppState extends EngineState {
  recipeId: string;
  lang: string;
}
