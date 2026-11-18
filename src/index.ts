export { create } from "./instance.js";
export type {
  Asset,
  AssetSource,
  InteractionMode,
  ParallaxEventHandler,
  ParallaxEventName,
  ParallaxInstance,
  ParallaxOptions,
  ReducedMotionPolicy,
  ThemePreset,
  ThemeTokens,
} from "./instance.js";

export {
  combineMotions,
  evaluateIdleMotion,
  evaluateOscillator,
  evaluateParallaxMotion,
  nodePoint,
} from "./math.js";
export { resolveAnchorCorrections } from "./anchors.js";
export { sanitizeSvg } from "./sanitize.js";
export { formatMotion, transformForMotion } from "./transform.js";
export type * from "./types.js";
