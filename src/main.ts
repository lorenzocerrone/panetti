/* Panetti — calculator entry point. */
import "../styles.css";
import { assertLocaleShape } from "./i18n/i18n";
import { initCalculator } from "./ui/calculator";

assertLocaleShape();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCalculator);
} else {
  initCalculator();
}
