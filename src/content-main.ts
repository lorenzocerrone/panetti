/* Panetti — content-pages entry point (about.html / guides.html). */
import "../styles.css";
import { assertLocaleShape } from "./i18n/i18n";
import { initContent } from "./ui/content";

assertLocaleShape();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initContent);
} else {
  initContent();
}
