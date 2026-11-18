import { nodePoint } from "./math.js";
import type {
  AnchorCorrection,
  CorrectionMap,
  MotionMap,
  ParallaxRig,
} from "./types.js";

/**
 * Keeps welded joints together under cursor and idle motion.
 *
 * Hosts resolve before members, so multi-hop chains stay pinned. A member with
 * several sockets receives the average correction. Pure: depends only on the
 * rig and the pre-computed motions.
 */
export function resolveAnchorCorrections(
  rig: ParallaxRig,
  motions: MotionMap,
): CorrectionMap {
  const corrections: CorrectionMap = new Map();
  for (const node of rig.nodes) {
    corrections.set(node.id, { dx: 0, dy: 0 });
  }
  const anchors = rig.anchors ?? [];
  if (anchors.length === 0) return corrections;

  const nodeById = new Map(rig.nodes.map((node) => [node.id, node] as const));

  const byMember = new Map<string, typeof anchors>();
  for (const anchor of anchors) {
    for (const member of anchor.members) {
      const list = byMember.get(member.node) ?? [];
      list.push(anchor);
      byMember.set(member.node, list);
    }
  }

  const resolved = new Set<string>();
  const resolving = new Set<string>();

  function resolve(id: string): void {
    if (resolved.has(id) || resolving.has(id)) return;
    resolving.add(id);
    const node = nodeById.get(id);
    const motion = motions.get(id);
    if (node && motion) {
      const nodeAnchors = byMember.get(id) ?? [];
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      for (const anchor of nodeAnchors) {
        resolve(anchor.host);
        const host = nodeById.get(anchor.host);
        const hostMotion = motions.get(anchor.host);
        let membership: { node: string; frame: "shared" | "local" } | null = null;
        for (const member of anchor.members) {
          if (member.node === id) membership = member;
        }
        if (!host || !hostMotion || !membership) continue;

        const joint = anchor.point;
        const own = nodePoint(node, motion, joint);
        let targetX = joint[0];
        let targetY = joint[1];
        if (membership.frame === "shared") {
          const hostPoint = nodePoint(
            host,
            hostMotion,
            joint,
            corrections.get(anchor.host),
          );
          targetX = hostPoint[0];
          targetY = hostPoint[1];
        }
        const weld = typeof node.weld === "number" ? node.weld : 1;
        sumX += (targetX - own[0]) * weld;
        sumY += (targetY - own[1]) * weld;
        count += 1;
      }
      if (count > 0) {
        corrections.set(id, { dx: sumX / count, dy: sumY / count });
      }
    }
    resolving.delete(id);
    resolved.add(id);
  }

  for (const node of rig.nodes) resolve(node.id);
  return corrections;
}

/** Resolves corrections directly from a cursor sample, without a motion map. */
export function correctionsForCursor(
  rig: ParallaxRig,
  motions: MotionMap,
): CorrectionMap {
  return resolveAnchorCorrections(rig, motions);
}

export type { AnchorCorrection };
