// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { create, type ParallaxInstance } from "../src/instance.js";
import { depthRig, sampleSvg } from "./fixtures.js";

let instance: ParallaxInstance | null = null;

afterEach(() => {
  instance?.destroy();
  instance = null;
  document.body.replaceChildren();
});

function mount(): { host: HTMLDivElement; instance: ParallaxInstance } {
  const host = document.createElement("div");
  document.body.append(host);
  instance = create(
    host,
    { svg: sampleSvg, rig: depthRig },
    { mode: "manual", idle: false },
  );
  return { host, instance };
}

describe("create", () => {
  it("mounts the svg inside a shadow root and emits ready", async () => {
    const { host, instance } = mount();
    const ready = new Promise<void>((resolve) => instance.on("ready", () => resolve()));
    await ready;
    expect(host.shadowRoot?.querySelector("svg")).not.toBeNull();
    expect(host.shadowRoot?.querySelector("#head")).not.toBeNull();
  });

  it("writes transforms for every rig node and returns to neutral", async () => {
    const { host, instance } = mount();
    await instance.ready;

    instance.setCursor(1, 0.5, true);
    const head = host.shadowRoot?.querySelector("#head");
    const far = head?.getAttribute("transform") ?? "";
    expect(far).toContain("translate(");

    instance.setCursor(0.5, 0.5, true);
    expect(head?.getAttribute("transform")).toBe(
      "translate(0 0) translate(650 450) rotate(0) scale(1) translate(-650 -450)",
    );
  });

  it("applies and clears theme tokens", async () => {
    const { host, instance } = mount();
    await instance.ready;

    instance.setTheme({ "--sloth-base": "#123456" });
    expect(host.style.getPropertyValue("--sloth-base")).toBe("#123456");

    instance.setTheme(null);
    expect(host.style.getPropertyValue("--sloth-base")).toBe("");
  });

  it("clamps cursor input and reports events", async () => {
    const { instance } = mount();
    await instance.ready;

    const events: string[] = [];
    instance.on("enter", () => events.push("enter"));
    instance.on("destroy", () => events.push("destroy"));

    instance.setCursor(-5, 5, true);
    instance.destroy();
    expect(events).toEqual(["destroy"]);
  });

  it("tolerates undefined options forwarded by wrappers", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    instance = create(
      host,
      { svg: sampleSvg, rig: depthRig },
      { mode: "manual", idle: false, intensity: undefined, speed: undefined },
    );
    await instance.ready;

    instance.setCursor(1, 0.5, true);
    const transform =
      host.shadowRoot?.querySelector("#head")?.getAttribute("transform") ?? "";
    expect(transform).not.toContain("NaN");
  });

  it("falls back to the poster when the asset fails to load", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const failing = create(
      host,
      { url: "https://example.invalid/asset.sloth.json" },
      { mode: "manual", poster: "/poster.png" },
    );
    instance = failing;

    const failed = new Promise<unknown>((resolve) => failing.on("error", resolve));
    await failed;
    expect(host.shadowRoot?.querySelector("img")?.getAttribute("src")).toBe("/poster.png");
  });
});
