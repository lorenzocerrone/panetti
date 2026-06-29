/* ===========================================================================
   Panetti — icon registry. A single source of truth for the line/outline SVG
   icons that replaced the app's emoji. Every icon is authored to one spec:
   24×24 grid, fill:none, stroke:currentColor (so it inherits text colour),
   stroke-width 1.75, round caps/joins. Helpers return inline <svg> markup for
   the imperative innerHTML renderers, plus a one-time hydrateIcons() pass that
   fills [data-icon] placeholders in the static HTML.
   =========================================================================== */

/** name → inner SVG markup (paths only; the <svg> wrapper is added by icon()). */
const ICONS: Record<string, string> = {
  /* ---------- UI controls ---------- */
  share:
    '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><line x1="8.3" y1="13.3" x2="15.7" y2="17.7"/><line x1="15.7" y1="6.3" x2="8.3" y2="10.7"/>',
  copy:
    '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  notes:
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',
  starter:
    '<path d="M7 8h10v9a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3z"/><path d="M8 8V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3"/><circle cx="11" cy="14.5" r="1"/><circle cx="14" cy="12" r="1"/><circle cx="13.3" cy="16.5" r="0.7"/>',
  clock:
    '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  flask:
    '<path d="M9 3h6"/><path d="M10 3v6l-4.6 8.4A2 2 0 0 0 7.2 21h9.6a2 2 0 0 0 1.8-3.6L14 9V3"/><path d="M7.6 14h8.8"/>',
  reset:
    '<polyline points="3 4 3 10 9 10"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L3 10"/>',
  apply: '<line x1="5" y1="12" x2="18" y2="12"/><polyline points="12.5 6.5 19 12 12.5 17.5"/>',
  warn:
    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13.5"/><line x1="12" y1="17" x2="12.01" y2="17"/>',

  /* ---------- Recipe styles (distinct silhouettes) ---------- */
  // Verace — wood-fired classic: a flame.
  verace:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  // Contemporanea — a slice tapering from the tip to a big airy 'canotto' rim.
  canotto:
    '<path d="M2.5 13 14 9.7a3.8 3.8 0 1 1 0 6.6z"/><circle cx="15.9" cy="13" r="0.95" fill="currentColor" stroke="none"/><circle cx="13.2" cy="13.4" r="0.65" fill="currentColor" stroke="none"/>',
  // Romana alla teglia — rectangular pan pizza with toppings.
  teglia:
    '<rect x="2.5" y="6" width="19" height="12" rx="2"/><rect x="4.6" y="8.1" width="14.8" height="7.8" rx="1.3"/><circle cx="8" cy="10.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="13" cy="13.1" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.6" cy="10.3" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.6" cy="14" r="0.8" fill="currentColor" stroke="none"/>',
  // Focaccia — dimpled flatbread oval.
  focaccia:
    '<ellipse cx="12" cy="12" rx="9" ry="6.2"/><circle cx="9" cy="11" r="0.7" fill="currentColor" stroke="none"/><circle cx="13" cy="10" r="0.7" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="0.7" fill="currentColor" stroke="none"/><circle cx="10.5" cy="14" r="0.7" fill="currentColor" stroke="none"/>',

  /* ---------- Guides ---------- */
  // Flour — a wheat stalk.
  wheat:
    '<line x1="12" y1="21" x2="12" y2="9"/><path d="M12 9c0-2.2-1.3-4-3-4 0 2.2 1.3 4 3 4z"/><path d="M12 9c0-2.2 1.3-4 3-4 0 2.2-1.3 4-3 4z"/><path d="M12 13.5c0-2.2-1.3-4-3-4 0 2.2 1.3 4 3 4z"/><path d="M12 13.5c0-2.2 1.3-4 3-4 0 2.2-1.3 4-3 4z"/><path d="M12 18c0-2.2-1.3-4-3-4 0 2.2 1.3 4 3 4z"/><path d="M12 18c0-2.2 1.3-4 3-4 0 2.2-1.3 4-3 4z"/>',
  // Kneading — a mound of dough being worked on the board.
  kneading:
    '<path d="M3 18a9 6.5 0 0 1 18 0z"/><line x1="2" y1="18" x2="22" y2="18"/><path d="M8.5 13c.7-.7 1.6-.7 2.3 0"/><path d="M13 14.5c.7-.7 1.6-.7 2.3 0"/>',

  /* ---------- Logo variants (brand mark) ---------- */
  // Dough ball (panetto) — a round boule with two baker's scoring cuts. (default)
  "logo-ball":
    '<circle cx="12" cy="12" r="9"/><path d="M8.4 13.6 13.6 8.4"/><path d="M10.8 15.4 16 10.2"/>',
  // Pizza slice — apex down, crust arc up with two toppings.
  "logo-slice":
    '<path d="M3.2 7.4 12 21l8.8-13.6a1 1 0 0 0-.7-1.5 39 39 0 0 0-16.2 0 1 1 0 0 0-.7 1.5z"/><circle cx="10" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="13.6" cy="11.4" r="1" fill="currentColor" stroke="none"/>',
  // Monogram — a geometric serif-spirit 'P'.
  "logo-mono": '<path d="M7 21V4h5.5a4.5 4.5 0 0 1 0 9H7"/>',
};

/** Inline SVG markup for `name`, wrapped in a sized <svg>. `extra` adds a
    variant class (e.g. "rc-icon") alongside the base `icon` sizing class. */
export function icon(name: string, extra = ""): string {
  const paths = ICONS[name] ?? "";
  const cls = extra ? `icon ${extra}` : "icon";
  return (
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `${paths}</svg>`
  );
}

/** Replace every [data-icon] placeholder under `root` with its SVG. */
export function hydrateIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-icon]").forEach((el) => {
    const name = el.getAttribute("data-icon");
    if (name) el.innerHTML = icon(name);
  });
}
