import { create, type InteractionMode, type ParallaxInstance } from "./instance.js";

const DEFAULT_TAG = "sloth-player";

function readNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readMode(value: string | null): InteractionMode | undefined {
  switch (value) {
    case "pointer":
    case "scroll":
    case "tilt":
    case "auto":
    case "manual":
    case "none":
      return value;
    default:
      return undefined;
  }
}

/**
 * Declarative wrapper: `<sloth-player src="asset.sloth.json">`.
 *
 * Rebuilds the instance whenever a rendering attribute changes, and tears the
 * instance down when the element leaves the document.
 */
export class SlothPlayerElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["src", "mode", "intensity", "speed", "idle", "theme", "poster"];
  }

  private readonly stage: HTMLDivElement;
  private instance: ParallaxInstance | null = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    this.stage = document.createElement("div");
    this.stage.style.display = "block";
    this.stage.style.width = "100%";
    this.stage.style.height = "100%";
    root.append(this.stage);
  }

  get parallax(): ParallaxInstance | null {
    return this.instance;
  }

  connectedCallback(): void {
    this.rebuild();
  }

  disconnectedCallback(): void {
    this.instance?.destroy();
    this.instance = null;
  }

  attributeChangedCallback(
    _name: string,
    previous: string | null,
    next: string | null,
  ): void {
    if (previous !== next && this.isConnected) this.rebuild();
  }

  private rebuild(): void {
    const src = this.getAttribute("src");
    this.instance?.destroy();
    this.instance = null;
    if (!src) return;

    this.instance = create(
      this.stage,
      { url: src },
      {
        mode: readMode(this.getAttribute("mode")),
        intensity: readNumber(this.getAttribute("intensity")),
        speed: readNumber(this.getAttribute("speed")),
        idle: this.hasAttribute("idle")
          ? this.getAttribute("idle") !== "false"
          : undefined,
        theme: this.getAttribute("theme"),
        poster: this.getAttribute("poster") ?? undefined,
      },
    );
  }
}

/** Registers the custom element once per document. */
export function defineSlothPlayer(tag: string = DEFAULT_TAG): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get(tag)) return;
  customElements.define(tag, SlothPlayerElement);
}
