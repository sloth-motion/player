import { describe, expect, it } from "vitest";
import {
  combineMotions,
  evaluateIdleMotion,
  evaluateParallaxMotion,
} from "../src/math.js";
import { transformForMotion } from "../src/transform.js";
import { depthRig, headNode, idleRig } from "./fixtures.js";

function nodeById(id: string) {
  const node = depthRig.nodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`missing node ${id}`);
  return node;
}

describe("parallax evaluation", () => {
  it("is identity at the neutral cursor", () => {
    const motion = evaluateParallaxMotion(headNode, { x: 0.5, y: 0.5 }, depthRig.viewBox);

    expect(motion.tx).toBeCloseTo(0, 10);
    expect(motion.ty).toBeCloseTo(0, 10);
    expect(motion.scale).toBeCloseTo(1, 10);
    expect(motion.rotate).toBeCloseTo(0, 10);
    expect(transformForMotion(headNode, motion)).toBe(
      "translate(0 0) translate(650 450) rotate(0) scale(1) translate(-650 -450)",
    );
  });

  it("translates near and far layers in opposite directions", () => {
    const body = evaluateParallaxMotion(nodeById("body"), { x: 1, y: 0.5 }, depthRig.viewBox);
    const head = evaluateParallaxMotion(headNode, { x: 1, y: 0.5 }, depthRig.viewBox);

    expect(body.tx).toBeCloseTo(6, 10);
    expect(head.tx).toBeCloseTo(-4.8, 10);
    expect(body.tx).toBeGreaterThan(0);
    expect(head.tx).toBeLessThan(0);
  });

  it("keeps cursor transforms mirror-symmetric at the four corners", () => {
    const tl = evaluateParallaxMotion(headNode, { x: 0, y: 0 }, depthRig.viewBox);
    const tr = evaluateParallaxMotion(headNode, { x: 1, y: 0 }, depthRig.viewBox);
    const bl = evaluateParallaxMotion(headNode, { x: 0, y: 1 }, depthRig.viewBox);
    const br = evaluateParallaxMotion(headNode, { x: 1, y: 1 }, depthRig.viewBox);

    for (const motion of [tl, tr, bl, br]) {
      expect(motion.rotate).toBeCloseTo(0, 10);
    }
    expect(tl.tx).toBeCloseTo(-tr.tx, 10);
    expect(tl.tx).toBeCloseTo(bl.tx, 10);
    expect(tl.tx).toBeCloseTo(-br.tx, 10);
    expect(tl.ty).toBeCloseTo(tr.ty, 10);
    expect(tl.ty).toBeCloseTo(-bl.ty, 10);
    expect(tl.ty).toBeCloseTo(-br.ty, 10);
  });

  it("scales motion deltas without scaling the identity baseline", () => {
    const half = evaluateParallaxMotion(headNode, { x: 1, y: 0.5 }, depthRig.viewBox, {
      shift: 0.5,
    });
    expect(half.tx).toBeCloseTo(-2.4, 10);

    const neutral = evaluateParallaxMotion(headNode, { x: 0.5, y: 0.5 }, depthRig.viewBox, {
      scale: 0,
    });
    expect(neutral.scale).toBeCloseTo(1, 10);
    expect(neutral.rotate).toBeCloseTo(0, 10);
  });

  it("ignores legacy cursor rotation coefficients", () => {
    const legacy = { ...headNode, rotate: { const: 0, cx: 0.36, cy: -0.36 } };
    for (const cursor of [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]) {
      expect(evaluateParallaxMotion(legacy, cursor, depthRig.viewBox).rotate).toBeCloseTo(0, 10);
    }
  });

  it("rounds transforms to four decimals and normalizes negative zero", () => {
    const motion = transformForMotion(headNode, {
      tx: -0.00001,
      ty: 1.23456789,
      scale: 1.0000001,
      rotate: 0,
    });
    expect(motion).toContain("translate(0 1.2346)");
    expect(motion).toContain("scale(1)");
    expect(motion).not.toContain("-0");
  });
});

describe("idle motion", () => {
  it("is identity at time zero", () => {
    for (const node of idleRig.nodes) {
      const idle = evaluateIdleMotion(node, 0);
      expect(idle.tx).toBeCloseTo(0, 10);
      expect(idle.ty).toBeCloseTo(0, 10);
      expect(idle.scaleX).toBeCloseTo(1, 10);
      expect(idle.scaleY).toBeCloseTo(1, 10);
      expect(idle.rotate).toBeCloseTo(0, 10);
    }
  });

  it("closes a blinking eye with a non-uniform scale", () => {
    const eye = idleRig.nodes.find((node) => node.id === "left-eye");
    if (!eye) throw new Error("missing eye");
    const closed = evaluateIdleMotion(eye, 4.5 * 0.04);
    expect(closed.scaleY).toBeLessThan(0.2);
    expect(closed.scaleX).toBeCloseTo(1, 10);
  });

  it("composes idle rotation on top of cursor motion", () => {
    const head = idleRig.nodes.find((node) => node.id === "head");
    if (!head) throw new Error("missing head");
    const parallax = evaluateParallaxMotion(head, { x: 1, y: 0.5 }, idleRig.viewBox);
    const idle = evaluateIdleMotion(head, 1);
    const combined = combineMotions(parallax, idle);
    expect(combined.tx).toBeCloseTo(parallax.tx, 10);
    expect(combined.rotate).toBeCloseTo(idle.rotate, 10);
    expect(combined.rotate).not.toBeCloseTo(0, 3);
  });

  it("leaves nodes without an idle track untouched", () => {
    const idle = evaluateIdleMotion(idleRig.nodes[0]!, 12.3);
    expect(idle).toEqual({ tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotate: 0 });
  });
});
