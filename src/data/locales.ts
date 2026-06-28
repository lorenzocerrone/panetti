/* ===========================================================================
   Panetti — bundled locale tables. The English table is the base; other
   languages are overlays merged on top of it (missing keys fall back to EN).
   =========================================================================== */

import en from "../../locales/en.json";
import it from "../../locales/it.json";

/** A nested table of translatable strings / string arrays. */
export type LocaleTree = { [key: string]: string | string[] | LocaleTree };

export const BASE_LOCALE: LocaleTree = en;

export const LOCALES: Record<string, LocaleTree> = { en, it };

/** Short labels for the language switcher, in display order. */
export const LANGS: Record<string, string> = { en: "EN", it: "IT" };
