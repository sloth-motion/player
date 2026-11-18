// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "../src/sanitize.js";

function parse(markup: string): Element {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  return doc.documentElement;
}

describe("sanitizeSvg", () => {
  it("removes scripts and event handlers", () => {
    const root = parse(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10" onload="alert(2)" fill="#000"/></svg>',
    );
    sanitizeSvg(root);
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector("rect")?.getAttribute("onload")).toBeNull();
  });

  it("removes external references but keeps fragment references", () => {
    const root = parse(
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/x.svg#a"/><use href="#local"/></svg>',
    );
    sanitizeSvg(root);
    const uses = Array.from(root.querySelectorAll("use"));
    expect(uses[0]?.getAttribute("href")).toBeNull();
    expect(uses[1]?.getAttribute("href")).toBe("#local");
  });

  it("keeps the theme style block", () => {
    const root = parse(
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.m-base{fill:var(--sloth-base,#888)}</style><rect class="m-base" width="10" height="10"/></svg>',
    );
    sanitizeSvg(root);
    expect(root.querySelector("style")?.textContent).toContain("var(--sloth-base");
    expect(root.querySelector("rect")?.getAttribute("class")).toBe("m-base");
  });

  it("drops style blocks that import or reference external urls", () => {
    const root = parse(
      '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example/a.css);</style></svg>',
    );
    sanitizeSvg(root);
    expect(root.querySelector("style")).toBeNull();
  });

  it("keeps the drawing intact", () => {
    const root = parse(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g id="head"><circle cx="5" cy="5" r="4" fill="#ccc"/></g></svg>',
    );
    sanitizeSvg(root);
    expect(root.querySelector("#head circle")?.getAttribute("fill")).toBe("#ccc");
  });
});
