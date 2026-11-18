import type {
  Cursor,
  IdleMotion,
  IdleOscillator,
  Motion,
  Multipliers,
  ParallaxNode,
  ViewBox,
} from "./types.js";

/**
 * Evaluates the cursor-driven part of the rig for one node.
 *
 * `multipliers.shift` scales the whole translate term, `multipliers.scale`
 * scales only the non-constant part of the scale term, so the neutral cursor
 * stays an exact identity at any multiplier.
 */
export function evaluateParallaxMotion(
  node: ParallaxNode,
  cursor: Cursor,
  viewBox: ViewBox,
  multipliers: Multipliers = {},
): Motion {
  const shift = multipliers.shift ?? 1;
  const scaleMultiplier = multipliers.scale ?? 1;

  const cx = (cursor.x - 0.5) * 2;
  const cy = (cursor.y - 0.5) * 2;

  const tx =
    node.translate.x.const +
    (node.translate.x.cx * cx + node.translate.x.cy * cy) * shift;
  const ty =
    node.translate.y.const +
    (node.translate.y.cx * cx + node.translate.y.cy * cy) * shift;

  const viewX = viewBox[0];
  const viewY = viewBox[1];
  const viewWidth = viewBox[2];
  const viewHeight = viewBox[3];
  const pivotX = (node.pivot[0] - viewX) / viewWidth;
  const pivotY = (node.pivot[1] - viewY) / viewHeight;
  const distance = Math.hypot(cursor.x - pivotX, cursor.y - pivotY) / Math.SQRT2;
  const radius = node.scale.radius || 0;
  const proximity =
    radius > 0
      ? Math.exp(-((distance / radius) ** 2)) - (node.scale.neutral || 0)
      : 0;

  const scaleDelta =
    node.scale.cx * cx + node.scale.cy * cy + node.scale.proximity * proximity;
  const scale = node.scale.const + scaleDelta * scaleMultiplier;

  // Cursor rotation is intentionally disabled; legacy coefficients are ignored.
  const rotate = node.rotate.const;

  return { tx, ty, scale, rotate };
}

/** Samples one idle oscillator at `time` seconds. */
export function evaluateOscillator(
  oscillator: IdleOscillator,
  time: number,
): number {
  const period = Math.max(0.1, oscillator.period);
  const shifted = time + oscillator.phase * period;
  const local = ((shifted % period) + period) % period;

  switch (oscillator.wave) {
    case "sine": {
      const value = Math.sin((2 * Math.PI * shifted) / period);
      const initial = Math.sin(2 * Math.PI * oscillator.phase);
      return (value - initial) * oscillator.amplitude;
    }
    case "pulse": {
      const width = Math.max(0.001, (oscillator.duty || 0.1) * period);
      if (local > width) return 0;
      const u = local / width;
      return Math.sin(Math.PI * u) ** 2 * oscillator.amplitude;
    }
    case "bounce": {
      const width = Math.max(0.001, (oscillator.duty || 0.35) * period);
      if (local > width) return 0;
      const u = local / width;
      return Math.sin(Math.PI * u) * oscillator.amplitude;
    }
    case "twitch": {
      const width = Math.max(0.001, (oscillator.duty || 0.12) * period);
      if (local > width) return 0;
      const u = local / width;
      const decay = oscillator.decay || 4;
      return (
        Math.exp(-decay * u) * Math.sin(2 * Math.PI * 2 * u) * oscillator.amplitude
      );
    }
    default:
      return 0;
  }
}

/** Evaluates the time-driven part of the rig for one node. */
export function evaluateIdleMotion(node: ParallaxNode, time: number): IdleMotion {
  const idle = node.idle;
  if (!idle) {
    return { tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotate: 0 };
  }
  const tx = idle.translate?.x ? evaluateOscillator(idle.translate.x, time) : 0;
  const ty = idle.translate?.y ? evaluateOscillator(idle.translate.y, time) : 0;
  const sx = idle.scale?.x ? evaluateOscillator(idle.scale.x, time) : 0;
  const sy = idle.scale?.y ? evaluateOscillator(idle.scale.y, time) : 0;
  const rotate = idle.rotate ? evaluateOscillator(idle.rotate, time) : 0;
  return {
    tx,
    ty,
    scaleX: 1 + sx,
    scaleY: 1 + sy,
    rotate,
  };
}

/** Composes the cursor and idle motions into the final transform input. */
export function combineMotions(parallax: Motion, idle: IdleMotion): Motion {
  return {
    tx: parallax.tx + idle.tx,
    ty: parallax.ty + idle.ty,
    scale: parallax.scale,
    scaleX: parallax.scale * idle.scaleX,
    scaleY: parallax.scale * idle.scaleY,
    rotate: parallax.rotate + idle.rotate,
  };
}

/** Maps a rig point through a node's motion, optionally including a weld correction. */
export function nodePoint(
  node: ParallaxNode,
  motion: Motion,
  point: readonly [number, number],
  correction?: { dx: number; dy: number },
): [number, number] {
  const radians = (motion.rotate * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const pivotX = node.pivot[0];
  const pivotY = node.pivot[1];
  const dx = point[0] - pivotX;
  const dy = point[1] - pivotY;
  const scaleX = motion.scaleX === undefined ? motion.scale : motion.scaleX;
  const scaleY = motion.scaleY === undefined ? motion.scale : motion.scaleY;
  const scaledX = scaleX * dx;
  const scaledY = scaleY * dy;
  return [
    pivotX +
      motion.tx +
      (correction ? correction.dx : 0) +
      cos * scaledX -
      sin * scaledY,
    pivotY +
      motion.ty +
      (correction ? correction.dy : 0) +
      sin * scaledX +
      cos * scaledY,
  ];
}
