// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { initCalculator } from "./calculator";
import { PAGES } from "../data/config";

/** Load index.html's <body> markup (minus scripts) into the test DOM. */
function mountIndexBody(): void {
  const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? "";
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/gi, "");
}

describe("calculator UI smoke test", () => {
  beforeEach(() => {
    location.hash = "";
    mountIndexBody();
    initCalculator();
  });

  it("renders the headline totals and a full ingredients table", () => {
    expect(document.querySelector("#total-dough")!.textContent).toMatch(/g|kg/);
    const rows = document.querySelectorAll("#ingredients tbody tr");
    // flour, water, salt, yeast for the default Neapolitan (no oil/sugar)
    expect(rows.length).toBe(4);
    expect(document.querySelector("#ingredients tbody")!.textContent).toContain("Flour");
  });

  it("populates the recipe picker and method steps", () => {
    expect(document.querySelectorAll("#recipe-list .recipe-card").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("#method-steps li").length).toBeGreaterThan(0);
  });

  it("renders a learn-more chip per guide from pages.json", () => {
    const chips = document.querySelectorAll("#learn-more-links a.chip");
    expect(chips.length).toBe(PAGES.length);
    expect((chips[0] as HTMLAnchorElement).getAttribute("href")).toBe(`guides.html#${PAGES[0]!.id}`);
  });

  it("reveals the starter card when sourdough is selected", () => {
    expect((document.querySelector("#starter") as HTMLElement).hidden).toBe(true);
    const sourdoughBtn = [...document.querySelectorAll("#yeast-seg button")].find(
      (b) => b.textContent === "Sourdough",
    ) as HTMLButtonElement;
    sourdoughBtn.click();
    expect((document.querySelector("#starter") as HTMLElement).hidden).toBe(false);
    // sourdough removes commercial yeast from the table
    expect(document.querySelector("#ingredients tbody")!.textContent).toContain("Sourdough starter");
  });

  it("writes a versioned share hash on render", () => {
    expect(location.hash).toContain("v=2");
    expect(location.hash).toContain("r=neapolitan");
  });

  it("restores state from an incoming share link", () => {
    location.hash = "v=2&lang=en&r=focaccia&m=balls&lv=fresh";
    mountIndexBody();
    initCalculator();
    expect(document.querySelector("#active-name")!.textContent).toContain("Focaccia");
  });
});
