import { resolveAnchorCorrections } from "./anchors.js";
import {
  combineMotions,
  evaluateIdleMotion,
  evaluateParallaxMotion,
} from "./math.js";
import { addTick } from "./scheduler.js";
import { sanitizeSvg } from "./sanitize.js";
import { transformForMotion } from "./transform.js";
import type {
  IdleMotion,
  Motion,
  ParallaxNode,
  ParallaxRig,
  ViewBox,
} from "./types.js";

export type ThemeTokens = Record<string, string>;
export type ThemePreset = "light" | "dark";
export type InteractionMode =
  | "pointer"
  | "scroll"
  | "tilt"
  | "auto"
  | "manual"
  | "none";
export type ReducedMotionPolicy = "fallback" | "idle" | "full";
export type ParallaxEventName =
  | "ready"
  | "error"
  | "enter"
  | "leave"
  | "press"
  | "destroy";

export interface Asset {
  svg: string;
  rig: ParallaxRig;
  theme?: ThemeTokens;
}

export type AssetSource =
  | Asset
  | { url: string }
  | { element: SVGSVGElement; rig: ParallaxRig };

export interface ParallaxOptions {
  /** Interaction model. Defaults to `pointer`. */
  mode?: InteractionMode;
  /** Where pointer movement is sampled. Defaults to the target element. */
  track?: "element" | "window";
  /** Idle motion on load. Defaults to true. */
  idle?: boolean;
  /** Multiples the rig's default motion. Defaults to 1. */
  intensity?: number;
  /** Idle clock multiplier. Defaults to 1. */
  speed?: number;
  /** Cursor easing time constant in ms. Lower is snappier. Defaults to 90. */
  response?: number;
  /** Theme name or token map, applied as CSS custom properties on the target. */
  theme?: string | ThemeTokens | null;
  /** Render inside a shadow root. Defaults to true. */
  sandbox?: boolean;
  /** Behaviour under `prefers-reduced-motion: reduce`. Defaults to `fallback`. */
  reducedMotion?: ReducedMotionPolicy;
  /** Overrides the multipliers derived from the rig defaults. */
  multipliers?: { shift?: number; scale?: number };
  /** Image shown when the asset fails to load. */
  poster?: string;
  /** Scroll mapping window height multiplier. Defaults to 1. */
  scrollRange?: number;
}

export type ParallaxEventHandler = (payload?: unknown) => void;

export interface ParallaxInstance {
  readonly element: HTMLElement;
  readonly ready: Promise<void>;
  setCursor(x: number, y: number, immediate?: boolean): void;
  setNeutral(immediate?: boolean): void;
  setTheme(theme: string | ThemeTokens | null): void;
  setIdle(idle: boolean): void;
  setMode(mode: InteractionMode): void;
  setIntensity(intensity: number): void;
  requestTilt(): Promise<boolean>;
  reset(): void;
  pause(): void;
  resume(): void;
  on(event: ParallaxEventName, handler: ParallaxEventHandler): () => void;
  destroy(): void;
}

const THEME_PRESETS: Record<ThemePreset, ThemeTokens> = {
  light: { "--sloth-shadow": "#00000022" },
  dark: { "--sloth-shadow": "#00000055" },
};

const ZERO_IDLE: IdleMotion = { tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotate: 0 };

const DEFAULT_VIEW_BOX: ViewBox = [0, 0, 1024, 1024];

function clamp(value: number, min: number, max: number): number {
  const safe = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, safe));
}

/**
 * Options that arrive as `undefined` must not override a resolved default:
 * a component wrapper that forwards `intensity={undefined}` would otherwise
 * poison the multipliers with NaN.
 */
function definedEntries<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function resolveTheme(theme: string | ThemeTokens | null | undefined): ThemeTokens {
  if (!theme) return {};
  if (typeof theme === "string") return THEME_PRESETS[theme as ThemePreset] ?? {};
  return theme;
}

function normalizeRig(rig: ParallaxRig): ParallaxRig {
  if (!rig || !Array.isArray(rig.nodes)) {
    throw new Error("Invalid rig: `nodes` must be an array");
  }
  const seen = new Set<string>();
  const nodes: ParallaxNode[] = [];
  for (const node of rig.nodes) {
    if (!node || typeof node.id !== "string" || seen.has(node.id)) continue;
    if (!node.translate || !node.scale || !node.rotate || !node.pivot) continue;
    seen.add(node.id);
    nodes.push(node);
  }
  return {
    ...rig,
    viewBox: normalizeViewBox(rig.viewBox),
    nodes,
    anchors: Array.isArray(rig.anchors) ? rig.anchors : [],
  };
}

function normalizeViewBox(viewBox: unknown): ViewBox {
  if (
    Array.isArray(viewBox) &&
    viewBox.length === 4 &&
    viewBox.every((value) => typeof value === "number" && Number.isFinite(value))
  ) {
    return viewBox as unknown as ViewBox;
  }
  return DEFAULT_VIEW_BOX;
}

interface LoadedAsset {
  svg: string;
  rig: ParallaxRig;
  theme?: ThemeTokens;
}

async function loadSource(source: AssetSource): Promise<LoadedAsset> {
  if ("url" in source) {
    const response = await fetch(source.url, { credentials: "same-origin" });
    if (!response.ok) {
      throw new Error(`Asset request failed with ${response.status}`);
    }
    const payload = (await response.json()) as {
      svg?: unknown;
      rig?: unknown;
      theme?: ThemeTokens;
    };
    if (typeof payload.svg !== "string" || !payload.rig) {
      throw new Error("Asset payload must contain `svg` and `rig`");
    }
    return { svg: payload.svg, rig: payload.rig as ParallaxRig, theme: payload.theme };
  }
  if ("element" in source) {
    return { svg: source.element.outerHTML, rig: source.rig };
  }
  return { svg: source.svg, rig: source.rig, theme: source.theme };
}

/**
 * Mounts a rigged SVG and drives it with cursor, scroll, tilt or idle motion.
 *
 * The SVG stays static; only `transform` attributes are rewritten, on one
 * shared animation frame for the whole page.
 */
export function create(
  target: HTMLElement,
  source: AssetSource,
  options: ParallaxOptions = {},
): ParallaxInstance {
  if (!target || typeof target.getBoundingClientRect !== "function") {
    throw new Error("A target element is required");
  }

  const settings: Required<
    Pick<
      ParallaxOptions,
      | "mode"
      | "track"
      | "idle"
      | "intensity"
      | "speed"
      | "response"
      | "sandbox"
      | "reducedMotion"
      | "scrollRange"
    >
  > & ParallaxOptions = {
    mode: options.mode ?? "pointer",
    track: options.track ?? "element",
    idle: options.idle ?? true,
    intensity: options.intensity ?? 1,
    speed: options.speed ?? 1,
    response: options.response ?? 90,
    sandbox: options.sandbox ?? true,
    reducedMotion: options.reducedMotion ?? "fallback",
    scrollRange: options.scrollRange ?? 1,
    ...definedEntries(options),
  };

  const handlers = new Map<ParallaxEventName, Set<ParallaxEventHandler>>();
  const themeKeys = new Set<string>();
  let inputCleanups: Array<() => void> = [];
  let resizeObserver: ResizeObserver | null = null;

  let destroyed = false;
  let mounted = false;
  let paused = false;
  let idleEnabled = settings.idle;
  let mode: InteractionMode = settings.mode;
  let userMode: InteractionMode | null = null;
  let stopTick: (() => void) | null = null;

  let rig: ParallaxRig | null = null;
  let viewBox: ViewBox = DEFAULT_VIEW_BOX;
  let multipliers = { shift: 1, scale: 1 };
  let elements = new Map<string, Element>();
  let baseTransforms = new Map<string, string | null>();

  const state = {
    target: { x: 0.5, y: 0.5 },
    current: { x: 0.5, y: 0.5 },
    time: 0,
    dirty: true,
  };

  let rect: DOMRect | null = null;
  let rectDirty = true;

  let reduceQuery: MediaQueryList | null = null;
  let prefersReduce = false;

  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  function emit(name: ParallaxEventName, payload?: unknown): void {
    const set = handlers.get(name);
    if (!set) return;
    for (const handler of Array.from(set)) handler(payload);
  }

  function measure(): DOMRect {
    if (!rect || rectDirty) {
      rect = target.getBoundingClientRect();
      rectDirty = false;
    }
    return rect;
  }

  function invalidateRect(): void {
    rectDirty = true;
  }

  function applyTheme(tokens: ThemeTokens): void {
    for (const key of themeKeys) target.style.removeProperty(key);
    themeKeys.clear();
    for (const [key, value] of Object.entries(tokens)) {
      target.style.setProperty(key, value);
      themeKeys.add(key);
    }
  }

  function mountSvg(markup: string): SVGSVGElement {
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    if (doc.querySelector("parsererror")) {
      throw new Error("The SVG markup could not be parsed");
    }
    const parsed =
      doc.documentElement?.tagName.toLowerCase() === "svg"
        ? doc.documentElement
        : doc.querySelector("svg");
    if (!parsed) throw new Error("No <svg> root element");

    sanitizeSvg(parsed);

    const svg = document.importNode(parsed, true) as SVGSVGElement;
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const host = settings.sandbox
      ? (target.shadowRoot ?? target.attachShadow({ mode: "open" }))
      : target;
    host.replaceChildren(svg);

    elements = new Map();
    for (const element of Array.from(svg.querySelectorAll("[id]"))) {
      elements.set(element.id, element);
    }
    baseTransforms = new Map();
    if (rig) {
      for (const node of rig.nodes) {
        const element = elements.get(node.id);
        if (element) {
          baseTransforms.set(
            node.id,
            element.getAttribute("transform") ?? node.baseTransform ?? null,
          );
        }
      }
    }
    return svg;
  }

  function render(): void {
    if (!rig) return;
    const motions = new Map<string, Motion>();
    for (const node of rig.nodes) {
      const parallax = evaluateParallaxMotion(
        node,
        state.current,
        viewBox,
        multipliers,
      );
      const idle = idleEnabled ? evaluateIdleMotion(node, state.time) : ZERO_IDLE;
      motions.set(node.id, combineMotions(parallax, idle));
    }
    const corrections = resolveAnchorCorrections(rig, motions);
    for (const node of rig.nodes) {
      const element = elements.get(node.id);
      if (!element) continue;
      const motion = motions.get(node.id);
      if (!motion) continue;
      const transform = transformForMotion(
        node,
        motion,
        corrections.get(node.id),
      );
      const base = baseTransforms.get(node.id);
      element.setAttribute("transform", base ? `${transform} ${base}` : transform);
    }
  }

  function tick(deltaMs: number): void {
    if (paused || destroyed || !mounted) return;
    if (idleEnabled) state.time += (deltaMs / 1000) * settings.speed;
    if (mode === "scroll") updateScrollCursor();

    const ease = 1 - Math.exp(-deltaMs / Math.max(16, settings.response));
    const dx = state.target.x - state.current.x;
    const dy = state.target.y - state.current.y;
    const moving = Math.abs(dx) > 1e-5 || Math.abs(dy) > 1e-5;

    if (moving) {
      state.current.x += dx * ease;
      state.current.y += dy * ease;
    }
    if (!moving && !idleEnabled && !state.dirty) return;
    state.dirty = false;
    render();
  }

  function updateScrollCursor(): void {
    const box = measure();
    const viewport = window.innerHeight || 1;
    const span = (viewport + box.height) * settings.scrollRange || 1;
    const progress = clamp((viewport - box.top) / span, 0, 1);
    state.target.x = 0.5;
    state.target.y = 1 - progress;
  }

  function bindInputs(): void {
    unbindInputs();
    if (!mounted || destroyed || mode === "none") return;

    const onScroll = (): void => {
      invalidateRect();
    };
    const onResize = (): void => {
      invalidateRect();
    };

    if (settings.track === "window" || mode === "scroll") {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize, { passive: true });
      inputCleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
      });
    }

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => invalidateRect());
      resizeObserver.observe(target);
      inputCleanups.push(() => {
        resizeObserver?.disconnect();
        resizeObserver = null;
      });
    }

    if (mode === "pointer") {
      const track = settings.track === "window" ? window : target;

      const onMove = (event: PointerEvent): void => {
        const box = measure();
        const x = clamp((event.clientX - box.left) / Math.max(1, box.width), 0, 1);
        const y = clamp((event.clientY - box.top) / Math.max(1, box.height), 0, 1);
        state.target.x = x;
        state.target.y = y;
      };
      const onEnter = (): void => emit("enter");
      const onLeave = (): void => {
        setNeutral();
        emit("leave");
      };
      const onPress = (): void => emit("press");

      track.addEventListener("pointermove", onMove as EventListener, {
        passive: true,
      });
      target.addEventListener("pointerenter", onEnter);
      target.addEventListener("pointerleave", onLeave);
      target.addEventListener("pointerdown", onPress);
      inputCleanups.push(() => {
        track.removeEventListener("pointermove", onMove as EventListener);
        target.removeEventListener("pointerenter", onEnter);
        target.removeEventListener("pointerleave", onLeave);
        target.removeEventListener("pointerdown", onPress);
      });
    }

    if (mode === "tilt") {
      const onOrientation = (event: DeviceOrientationEvent): void => {
        const gamma = clamp((event.gamma ?? 0) / 45, -1, 1);
        const beta = clamp(((event.beta ?? 0) - 45) / 45, -1, 1);
        state.target.x = 0.5 + gamma * 0.5;
        state.target.y = 0.5 + beta * 0.5;
      };
      window.addEventListener("deviceorientation", onOrientation as EventListener);
      inputCleanups.push(() =>
        window.removeEventListener(
          "deviceorientation",
          onOrientation as EventListener,
        ),
      );
    }
  }

  function unbindInputs(): void {
    for (const cleanup of inputCleanups) cleanup();
    inputCleanups = [];
  }

  function updateMotionPolicy(): void {
    prefersReduce = reduceQuery?.matches ?? false;
    const staticNow = prefersReduce && settings.reducedMotion === "fallback";
    const nextMode = staticNow ? "none" : (userMode ?? settings.mode);
    idleEnabled = !staticNow && settings.idle;

    if (nextMode !== mode) {
      mode = nextMode;
      bindInputs();
    }
    if (staticNow) {
      state.target = { x: 0.5, y: 0.5 };
      state.current = { x: 0.5, y: 0.5 };
      state.time = 0;
      state.dirty = true;
      render();
    }
  }

  function setCursor(x: number, y: number, immediate = false): void {
    state.target.x = clamp(x, 0, 1);
    state.target.y = clamp(y, 0, 1);
    if (immediate) {
      state.current.x = state.target.x;
      state.current.y = state.target.y;
      state.dirty = true;
      render();
    }
  }

  function setNeutral(immediate = false): void {
    setCursor(0.5, 0.5, immediate);
  }

  function setTheme(theme: string | ThemeTokens | null): void {
    applyTheme(resolveTheme(theme));
  }

  function setIdle(idle: boolean): void {
    idleEnabled = Boolean(idle) && !(prefersReduce && settings.reducedMotion === "fallback");
    if (!idleEnabled) {
      state.time = 0;
      state.dirty = true;
      render();
    }
  }

  function setMode(next: InteractionMode): void {
    userMode = next;
    mode = prefersReduce && settings.reducedMotion === "fallback" ? "none" : next;
    bindInputs();
  }

  function setIntensity(intensity: number): void {
    const value = clamp(intensity, 0, 3);
    const defaults = rig?.defaults ?? {};
    const baseShift = settings.multipliers?.shift ?? (defaults.shift ? 80 / defaults.shift : 1);
    const baseScale = settings.multipliers?.scale ?? (defaults.scale ? 0.2 / defaults.scale : 1);
    multipliers = { shift: baseShift * value, scale: baseScale * value };
    state.dirty = true;
  }

  async function requestTilt(): Promise<boolean> {
    const orientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    try {
      if (typeof orientation?.requestPermission === "function") {
        return (await orientation.requestPermission()) === "granted";
      }
      return true;
    } catch {
      return false;
    }
  }

  function renderPoster(): void {
    if (!settings.poster) return;
    const host = settings.sandbox
      ? (target.shadowRoot ?? target.attachShadow({ mode: "open" }))
      : target;
    const image = document.createElement("img");
    image.src = settings.poster;
    image.alt = "";
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "contain";
    host.replaceChildren(image);
  }

  function reset(): void {
    setNeutral(true);
    state.time = 0;
    state.dirty = true;
    render();
  }

  async function bootstrap(): Promise<void> {
    try {
      const loaded = await loadSource(source);
      if (destroyed) return;

      rig = normalizeRig(loaded.rig);
      viewBox = rig.viewBox;
      mountSvg(loaded.svg);

      const defaults = rig.defaults ?? {};
      const baseShift = settings.multipliers?.shift ?? (defaults.shift ? 80 / defaults.shift : 1);
      const baseScale = settings.multipliers?.scale ?? (defaults.scale ? 0.2 / defaults.scale : 1);
      multipliers = {
        shift: baseShift * clamp(settings.intensity, 0, 3),
        scale: baseScale * clamp(settings.intensity, 0, 3),
      };

      mounted = true;

      applyTheme(resolveTheme(settings.theme ?? loaded.theme ?? null));

      if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        reduceQuery.addEventListener?.("change", () => updateMotionPolicy());
      }
      updateMotionPolicy();
      render();

      stopTick = addTick(tick);
      emit("ready");
    } catch (error) {
      emit("error", error);
      renderPoster();
    } finally {
      resolveReady();
    }
  }

  void bootstrap();

  return {
    element: target,
    ready,
    setCursor,
    setNeutral,
    setTheme,
    setIdle,
    setMode,
    setIntensity,
    requestTilt,
    reset,
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    on(event, handler) {
      const set = handlers.get(event) ?? new Set<ParallaxEventHandler>();
      set.add(handler);
      handlers.set(event, set);
      return () => {
        set.delete(handler);
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unbindInputs();
      stopTick?.();
      stopTick = null;
      resizeObserver?.disconnect();
      for (const key of themeKeys) target.style.removeProperty(key);
      themeKeys.clear();
      if (settings.sandbox && target.shadowRoot) {
        target.shadowRoot.replaceChildren();
      } else {
        target.replaceChildren();
      }
      emit("destroy");
      handlers.clear();
    },
  };
}
