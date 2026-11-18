import {
  create,
  type InteractionMode,
  type ParallaxInstance,
} from "./instance.js";

export interface AutoOptions {
  selector?: string;
  root?: ParentNode;
}

function readMode(value: string | undefined): InteractionMode | undefined {
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
 * Binds every `[data-sloth]` element that has not been bound yet.
 *
 * ```html
 * <div data-sloth="/assets/teapot.sloth.json"
 *      data-sloth-mode="pointer"
 *      data-sloth-theme="dark"></div>
 * ```
 */
export function auto(options: AutoOptions = {}): ParallaxInstance[] {
  const root = options.root ?? document;
  const selector = options.selector ?? "[data-sloth]";
  const instances: ParallaxInstance[] = [];

  for (const element of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
    if (element.dataset.slothBound === "true") continue;
    const url = element.dataset.sloth;
    if (!url) continue;
    element.dataset.slothBound = "true";

    const intensity = element.dataset.slothIntensity;
    const speed = element.dataset.slothSpeed;

    instances.push(
      create(
        element,
        { url },
        {
          mode: readMode(element.dataset.slothMode),
          intensity: intensity === undefined ? undefined : Number(intensity),
          speed: speed === undefined ? undefined : Number(speed),
          idle:
            element.dataset.slothIdle === undefined
              ? undefined
              : element.dataset.slothIdle !== "false",
          theme: element.dataset.slothTheme ?? undefined,
          poster: element.dataset.slothPoster ?? undefined,
        },
      ),
    );
  }

  return instances;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => auto(), { once: true });
  } else {
    queueMicrotask(() => auto());
  }
}
