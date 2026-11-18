/** Types for the parallax rig produced by the SlothMotion pipeline. */

export interface Linear2D {
  const: number;
  cx: number;
  cy: number;
}

export interface Scale2D extends Linear2D {
  proximity: number;
  radius: number;
  neutral: number;
}

export type IdleWave = "sine" | "pulse" | "bounce" | "twitch";

export interface IdleOscillator {
  wave: IdleWave;
  amplitude: number;
  period: number;
  phase: number;
  duty?: number;
  decay?: number;
}

export interface IdleTrack {
  translate?: { x?: IdleOscillator; y?: IdleOscillator };
  scale?: { x?: IdleOscillator; y?: IdleOscillator };
  rotate?: IdleOscillator;
}

export interface ParallaxNode {
  id: string;
  tag?: string;
  z?: number;
  parentZ?: number;
  depth?: number;
  pivot: [number, number];
  gain?: number;
  weld?: number;
  baseTransform?: string | null;
  translate: { x: Linear2D; y: Linear2D };
  scale: Scale2D;
  rotate: Linear2D;
  idle?: IdleTrack | null;
}

export interface ParallaxAnchor {
  id: string;
  host: string;
  point: [number, number];
  members: Array<{ node: string; frame: "shared" | "local" }>;
}

export interface ParallaxRig {
  format?: string;
  version?: number;
  viewBox: ViewBox;
  cursor?: { space?: string; neutral?: [number, number] };
  defaults?: {
    shift?: number;
    scale?: number;
    rotate?: number;
    proximity?: number;
    direction?: string;
    neutralZ?: number;
  };
  nodes: ParallaxNode[];
  anchors?: ParallaxAnchor[];
  synthetic?: boolean;
  warnings?: string[];
}

export type ViewBox = readonly [number, number, number, number];

export interface Cursor {
  x: number;
  y: number;
}

export interface Motion {
  tx: number;
  ty: number;
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotate: number;
}

export interface IdleMotion {
  tx: number;
  ty: number;
  scaleX: number;
  scaleY: number;
  rotate: number;
}

export interface Multipliers {
  shift?: number;
  scale?: number;
}

export type AnchorCorrection = { dx: number; dy: number };

export type MotionMap = Map<string, Motion>;
export type CorrectionMap = Map<string, AnchorCorrection>;
