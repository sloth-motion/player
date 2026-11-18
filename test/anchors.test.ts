import { describe, expect, it } from "vitest";
import { resolveAnchorCorrections } from "../src/anchors.js";
import { evaluateParallaxMotion, nodePoint } from "../src/math.js";
import type { ParallaxNode, ParallaxRig } from "../src/types.js";
import { anchoredRig } from "./fixtures.js";

function motionsFor(rig: ParallaxRig, cursor: { x: number; y: number }, multipliers = {}) {
  const motions = new Map<string, ReturnType<typeof evaluateParallaxMotion>>();
  for (const node of rig.nodes) {
    motions.set(node.id, evaluateParallaxMotion(node, cursor, rig.viewBox, multipliers));
  }
  return motions;
}

function jointFor(
  rig: ParallaxRig,
  id: string,
  point: [number, number],
  cursor: { x: number; y: number },
  multipliers = {},
) {
  const node = rig.nodes.find((candidate) => candidate.id === id) as ParallaxNode;
  const motions = motionsFor(rig, cursor, multipliers);
  const corrections = resolveAnchorCorrections(rig, motions);
  return nodePoint(node, motions.get(id)!, point, corrections.get(id));
}

describe("joint welds", () => {
  it("is identity at the neutral cursor", () => {
    const corrections = resolveAnchorCorrections(
      anchoredRig,
      motionsFor(anchoredRig, { x: 0.5, y: 0.5 }),
    );
    for (const correction of corrections.values()) {
      expect(correction.dx).toBeCloseTo(0, 10);
      expect(correction.dy).toBeCloseTo(0, 10);
    }
  });

  it("keeps the joint pinned at cursor extremes", () => {
    for (const cursor of [
      { x: 1, y: 0.5 },
      { x: 0.1, y: 0.9 },
      { x: 0.5, y: 0 },
    ]) {
      const torso = jointFor(anchoredRig, "torso", [760, 560], cursor);
      const head = jointFor(anchoredRig, "head", [760, 560], cursor);
      expect(head[0]).toBeCloseTo(torso[0], 8);
      expect(head[1]).toBeCloseTo(torso[1], 8);
    }
  });

  it("corrects a separation that would otherwise be visible", () => {
    const cursor = { x: 1, y: 0.5 };
    const motions = motionsFor(anchoredRig, cursor);
    const torso = anchoredRig.nodes[0] as ParallaxNode;
    const head = anchoredRig.nodes[1] as ParallaxNode;
    const rawTorso = nodePoint(torso, motions.get("torso")!, [760, 560]);
    const rawHead = nodePoint(head, motions.get("head")!, [760, 560]);
    expect(Math.hypot(rawHead[0] - rawTorso[0], rawHead[1] - rawTorso[1])).toBeGreaterThan(2);
  });

  it("honours a partial weld", () => {
    const halfWeld: ParallaxRig = {
      ...anchoredRig,
      nodes: [anchoredRig.nodes[0] as ParallaxNode, { ...(anchoredRig.nodes[1] as ParallaxNode), weld: 0.5 }],
    };
    const cursor = { x: 1, y: 0.5 };
    const full = resolveAnchorCorrections(anchoredRig, motionsFor(anchoredRig, cursor)).get("head");
    const half = resolveAnchorCorrections(halfWeld, motionsFor(halfWeld, cursor)).get("head");
    expect(half!.dx).toBeCloseTo((full?.dx ?? 0) * 0.5, 10);
    expect(half!.dy).toBeCloseTo((full?.dy ?? 0) * 0.5, 10);
  });

  it("is a no-op for rigs without anchors", () => {
    const plain: ParallaxRig = { ...anchoredRig, anchors: [] };
    const corrections = resolveAnchorCorrections(plain, motionsFor(plain, { x: 1, y: 1 }));
    for (const correction of corrections.values()) {
      expect(correction).toEqual({ dx: 0, dy: 0 });
    }
  });
});
