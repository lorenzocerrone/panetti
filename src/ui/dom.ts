/* ===========================================================================
   Panetti — tiny DOM helpers shared by the UI modules.
   =========================================================================== */

/** querySelector that throws if the element is missing (fail fast in dev). */
export function $<T extends HTMLElement = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Element not found: ${sel}`);
  return el;
}

/** Paint a range input's filled track via the --fill custom property. */
export function setFill(input: HTMLInputElement, min: number, max: number): void {
  const pct = ((Number(input.value) - min) / (max - min)) * 100;
  input.style.setProperty("--fill", pct + "%");
}

let toastEl: HTMLDivElement | null = null;

/** Briefly show a toast message. */
export function showToast(msg: string): void {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl?.classList.remove("show"), 1600);
}
