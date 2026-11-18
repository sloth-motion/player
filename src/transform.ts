import type { AnchorCorrection, Motion, ParallaxNode } from "./types.js";

/** Rounds to four decimals and normalizes negative zero. */
export function formatMotion(value: number): string {
  const rounded = Math.round(value * 10000) / 10000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

/**
 * Builds the SVG transform for a node.
 *
 * The pivot rotate/scale pair is composed with an outer translate, so the
 * matrix reads as: move by motion, then pivot, then rotate, then scale.
 */
export function transformForMotion(
  node: ParallaxNode,
  motion: Motion,
  correction?: AnchorCorrection,
): string {
  const dx = correction ? correction.dx : 0;
  const dy = correction ? correction.dy : 0;
  const scaleX = motion.scaleX === undefined ? motion.scale : motion.scaleX;
  const scaleY = motion.scaleY === undefined ? motion.scale : motion.scaleY;
  const scale =
    scaleX === scaleY
      ? `scale(${formatMotion(scaleX)})`
      : `scale(${formatMotion(scaleX)} ${formatMotion(scaleY)})`;

  return (
    `translate(${formatMotion(motion.tx + dx)} ${formatMotion(motion.ty + dy)}) ` +
    `translate(${formatMotion(node.pivot[0])} ${formatMotion(node.pivot[1])}) ` +
    `rotate(${formatMotion(motion.rotate)}) ` +
    scale +
    ` translate(${formatMotion(-node.pivot[0])} ${formatMotion(-node.pivot[1])})`
  );
}
