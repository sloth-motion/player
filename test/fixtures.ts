import type { ParallaxNode, ParallaxRig } from "../src/types.js";

/** Proximity term at the rest cursor, so the neutral pose is an exact identity. */
function proximityScale(pivot: [number, number]): ParallaxNode["scale"] {
  const radius = 0.55;
  const px = pivot[0] / 1024;
  const py = pivot[1] / 1024;
  const distance = Math.hypot(0.5 - px, 0.5 - py) / Math.SQRT2;
  return {
    const: 1,
    cx: 0,
    cy: 0,
    proximity: 0.0144,
    radius,
    neutral: Math.exp(-((distance / radius) ** 2)),
  };
}


/** Coefficients match what the SlothMotion pipeline derives for a two-part figure. */
export const bodyNode: ParallaxNode = {
  id: "body",
  tag: "g",
  z: 0.35,
  pivot: [450, 600],
  translate: {
    x: { const: 0, cx: 6, cy: 0 },
    y: { const: 0, cx: 0, cy: 6 },
  },
  scale: proximityScale([450, 600]),
  rotate: { const: 0, cx: 0, cy: 0 },
};

export const headNode: ParallaxNode = {
  id: "head",
  tag: "g",
  z: 0.62,
  pivot: [650, 450],
  translate: {
    x: { const: 0, cx: -4.8, cy: 0 },
    y: { const: 0, cx: 0, cy: -4.8 },
  },
  scale: proximityScale([650, 450]),
  rotate: { const: 0, cx: 0, cy: 0 },
};

export const depthRig: ParallaxRig = {
  format: "vector.parallax",
  version: 2,
  viewBox: [0, 0, 1024, 1024],
  defaults: {
    shift: 40,
    scale: 0.06,
    rotate: 1.5,
    proximity: 0.55,
    direction: "inverse",
    neutralZ: 0.5,
  },
  nodes: [bodyNode, headNode],
  anchors: [],
  synthetic: false,
  warnings: [],
};

const flat = (value: number): ParallaxNode["rotate"] => ({
  const: value,
  cx: 0,
  cy: 0,
});

export const torsoNode: ParallaxNode = {
  id: "torso",
  tag: "g",
  z: 0.32,
  pivot: [500, 480],
  translate: {
    x: { const: 0, cx: 7.2, cy: 0 },
    y: { const: 0, cx: 0, cy: 7.2 },
  },
  scale: {
    const: 1,
    cx: 0,
    cy: 0,
    proximity: 0,
    radius: 0.55,
    neutral: 0,
  },
  rotate: flat(0),
};

export const anchoredHeadNode: ParallaxNode = {
  id: "head",
  tag: "g",
  z: 0.55,
  pivot: [760, 560],
  translate: {
    x: { const: 0, cx: -4.8, cy: 0 },
    y: { const: 0, cx: 0, cy: -4.8 },
  },
  scale: {
    const: 1,
    cx: 0,
    cy: 0,
    proximity: 0,
    radius: 0.55,
    neutral: 0,
  },
  rotate: flat(0),
};

export const anchoredRig: ParallaxRig = {
  format: "vector.parallax",
  version: 2,
  viewBox: [0, 0, 1024, 1024],
  defaults: { shift: 40, scale: 0.06, rotate: 1.5, proximity: 0.55, neutralZ: 0.5 },
  nodes: [torsoNode, anchoredHeadNode],
  anchors: [
    {
      id: "neck",
      host: "torso",
      point: [760, 560],
      members: [{ node: "head", frame: "shared" }],
    },
  ],
  synthetic: false,
  warnings: [],
};

export const idleRig: ParallaxRig = {
  ...depthRig,
  version: 3,
  nodes: [
    bodyNode,
    {
      ...headNode,
      idle: {
        rotate: {
          wave: "sine",
          amplitude: 2.5,
          period: 4,
          phase: 0,
        },
      },
    },
    {
      id: "left-eye",
      tag: "g",
      z: 0.66,
      pivot: [420, 430],
      translate: {
        x: { const: 0, cx: 0, cy: 0 },
        y: { const: 0, cx: 0, cy: 0 },
      },
      scale: {
        const: 1,
        cx: 0,
        cy: 0,
        proximity: 0,
        radius: 0.55,
        neutral: 0,
      },
      rotate: flat(0),
      idle: {
        scale: {
          y: {
            wave: "pulse",
            amplitude: -0.9,
            period: 4.5,
            phase: 0,
            duty: 0.08,
          },
        },
      },
    },
  ],
};

export const sampleSvg = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">',
  '  <g id="body" data-z="0.35" data-pivot="450,600">',
  '    <rect x="300" y="400" width="300" height="400" fill="#888888" stroke="none"/>',
  "  </g>",
  '  <g id="head" data-z="0.62" data-pivot="650,450">',
  '    <circle cx="650" cy="450" r="120" fill="#cccccc" stroke="none"/>',
  "  </g>",
  "</svg>",
].join("\n");
