export type Poe1Ruleset = "standard" | "ruthless";

export interface Poe1SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Poe1SpriteVariant {
  filename: string;
  w: number;
  h: number;
  coords: Record<string, Poe1SpriteFrame>;
}

export type Poe1SpriteAtlases = Record<
  string,
  Record<string, Poe1SpriteVariant>
>;

export interface Poe1RawGroup {
  x: number;
  y: number;
  orbits: number[];
  nodes?: (string | number)[];
  background?: {
    image: string;
    isHalfImage?: boolean;
    offsetX?: number;
    offsetY?: number;
  };
}

export interface Poe1RawNode {
  skill?: number;
  name?: string;
  icon?: string;
  activeIcon?: string;
  inactiveIcon?: string;
  stats?: string[];
  masteryEffects?: Poe1RawMasteryEffect[];
  flavourText?: string[];
  group?: string | number;
  orbit?: number;
  orbitIndex?: number;
  x?: number;
  y?: number;
  in?: (string | number)[];
  out?: (string | number)[];
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  isJewelSocket?: boolean;
  isAscendancyStart?: boolean;
  isProxy?: boolean;
  ascendancyName?: string;
  classStartIndex?: number | number[];
  grantedPassivePoints?: number;
}

export interface Poe1RawMasteryEffect {
  effect?: number;
  stats?: string[];
  reminderText?: string[];
}

export interface Poe1MasteryEffect {
  effect: number;
  stats: string[];
  reminderText?: string[];
}

export interface Poe1RawClass {
  name: string;
  ascendancies?: { id?: string; name?: string }[];
}

export interface Poe1RawData {
  tree: string;
  ruthless?: boolean;
  classes: Poe1RawClass[];
  groups: Record<string, Poe1RawGroup>;
  nodes: Record<string, Poe1RawNode>;
  constants: {
    orbitRadii: number[];
    skillsPerOrbit: number[];
  };
  sprites: Poe1SpriteAtlases;
  imageZoomLevels?: number[];
  min_x?: number;
  min_y?: number;
  max_x?: number;
  max_y?: number;
}

export type Poe1NodeKind =
  | "small"
  | "notable"
  | "keystone"
  | "mastery"
  | "jewel"
  | "ascendancyStart";

export interface Poe1TreeNode {
  key: string;
  skill: number;
  name: string;
  kind: Poe1NodeKind;
  x: number;
  y: number;
  groupKey?: string;
  icon?: string;
  activeIcon?: string;
  inactiveIcon?: string;
  stats: string[];
  masteryEffects: Poe1MasteryEffect[];
  flavourText: string[];
  ascendancyName?: string;
  classStartIndex?: number | number[];
  grantedPassivePoints?: number;
  isProxy: boolean;
}

export interface Poe1TreeEdge {
  fromKey: string;
  toKey: string;
}

export interface Poe1TreeGroup {
  key: string;
  x: number;
  y: number;
  orbits: number[];
}

export interface ParsedPoe1Tree {
  game: "poe1";
  ruleset: Poe1Ruleset;
  datasetId: string;
  versionId: string;
  version: string;
  nodes: Map<string, Poe1TreeNode>;
  nodeList: Poe1TreeNode[];
  edges: Poe1TreeEdge[];
  renderEdges: Poe1TreeEdge[];
  groups: Poe1TreeGroup[];
  renderGroups: Poe1TreeGroup[];
  classes: Poe1RawClass[];
  sprites: Poe1SpriteAtlases;
  orbitRadii: number[];
  classStart: Map<number, Poe1TreeNode>;
  adjacency: Map<string, string[]>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}
