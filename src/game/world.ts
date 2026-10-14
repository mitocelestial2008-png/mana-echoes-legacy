import { BOSSES, NPCS, STATUES, type Biome } from "./data";

export const W = 240;
export const H = 180;
export const TS = 16;

export const T = {
  GRASS: 0, FLOWER: 1, PATH: 2, WATER: 3, TREE: 4, SAND: 5, DUNE: 6, ROCK: 7, SNOW: 8, ICE: 9,
  CAVE: 10, CWALL: 11, CRYSTAL: 12, COBBLE: 13, WALL: 14, ROOF: 15, PINE: 16, BUSH: 17, PILLAR: 18, BRIDGE: 19, DTREE: 20, CACTUS: 21,
} as const;
export const SOLID = new Set<number>([T.WATER, T.TREE, T.ROCK, T.CWALL, T.CRYSTAL, T.WALL, T.ROOF, T.PINE, T.PILLAR, T.DTREE, T.CACTUS]);

export function hash(x: number, y: number, s = 0) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t: number) { return t * t * (3 - 2 * t); }
export function noise(x: number, y: number, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
function fbm(x: number, y: number, s: number) { return noise(x, y, s) * 0.6 + noise(x * 2, y * 2, s + 7) * 0.3 + noise(x * 4, y * 4, s + 13) * 0.1; }

export interface Node { id: number; tx: number; ty: number; item: string; respawn: number }

export interface World {
  tiles: Uint8Array;
  biomes: Uint8Array;
  nodes: Node[];
}
export const BIOME_LIST: Biome[] = ["plains", "forest", "desert", "cave", "mountain"];

function biomeAt(x: number, y: number): Biome {
  const nx = (noise(x / 12, y / 12, 3) - 0.5) * 16;
  const ny = (noise(x / 12, y / 12, 5) - 0.5) * 16;
  const X = x + nx, Y = y + ny;
  if (X > 168 && Y < 72) return "cave";
  if (Y < 58) return "mountain";
  if (X < 78) return "forest";
  if (X > 166) return "desert";
  return "plains";
}

export function generateWorld(): World {
  const tiles = new Uint8Array(W * H);
  const biomes = new Uint8Array(W * H);
  const set = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = t; };
  const get = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? T.WATER : tiles[y * W + x]);

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const b = biomeAt(x, y);
    biomes[y * W + x] = BIOME_LIST.indexOf(b);
    const n = fbm(x / 9, y / 9, 11);
    const r = hash(x, y, 99);
    let t: number = T.GRASS;
    if (b === "plains") {
      t = r < 0.06 ? T.FLOWER : T.GRASS;
      if (n > 0.72) t = T.TREE;
      if (n < 0.22) t = T.WATER;
      if (r > 0.985) t = T.BUSH;
    } else if (b === "forest") {
      t = r < 0.04 ? T.FLOWER : T.GRASS;
      if (n > 0.48) t = r < 0.5 ? T.DTREE : T.TREE;
      else if (r > 0.93) t = T.TREE;
      if (n < 0.2) t = T.WATER;
    } else if (b === "desert") {
      t = n > 0.55 ? T.DUNE : T.SAND;
      if (r > 0.985) t = T.CACTUS;
      else if (r > 0.975) t = T.BUSH;
      if (n > 0.8) t = T.ROCK;
      if (noise(x / 5, y / 5, 21) > 0.86) t = T.PILLAR;
    } else if (b === "mountain") {
      t = T.SNOW;
      if (n > 0.66) t = T.ROCK;
      else if (n > 0.55 && r > 0.6) t = T.PINE;
      else if (n < 0.3) t = T.ICE;
    } else {
      const c = fbm(x / 6, y / 6, 31);
      t = c > 0.5 ? T.CAVE : T.CWALL;
      if (t === T.CAVE && r > 0.975) t = T.CRYSTAL;
    }
    if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) t = b === "cave" ? T.CWALL : T.WATER;
    tiles[y * W + x] = t;
  }

  // Oasis
  for (let y = -4; y <= 4; y++) for (let x = -6; x <= 6; x++) {
    const d = (x * x) / 36 + (y * y) / 16;
    if (d < 1) set(196 + x, 130 + y, d < 0.6 ? T.WATER : T.GRASS);
  }

  const clear = (cx: number, cy: number, r: number, t: number) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) set(cx + x, cy + y, t);
  };
  const floorOf = (x: number, y: number) => {
    const b = BIOME_LIST[biomes[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))]];
    return b === "desert" ? T.SAND : b === "mountain" ? T.SNOW : b === "cave" ? T.CAVE : T.GRASS;
  };
  const road = (pts: [number, number][], width = 1) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const wob = (noise(s / 10, i, 44) - 0.5) * 4;
        const x = Math.round(x0 + (x1 - x0) * t + (Math.abs(y1 - y0) > Math.abs(x1 - x0) ? wob : 0));
        const y = Math.round(y0 + (y1 - y0) * t + (Math.abs(y1 - y0) > Math.abs(x1 - x0) ? 0 : wob));
        for (let oy = -width; oy <= width; oy++) for (let ox = -width; ox <= width; ox++) {
          const cur = get(x + ox, y + oy);
          const b = BIOME_LIST[biomes[(y + oy) * W + (x + ox)]];
          if (cur === T.WATER && (ox === 0 && oy === 0)) set(x + ox, y + oy, T.BRIDGE);
          else if (cur === T.WATER) continue;
          else if (ox === 0 && oy === 0) set(x, y, b === "cave" ? T.CAVE : b === "mountain" ? T.SNOW : b === "desert" ? T.SAND : T.PATH);
          else if (SOLID.has(cur)) set(x + ox, y + oy, floorOf(x + ox, y + oy));
        }
      }
    }
  };
  road([[122, 126], [90, 118], [60, 110], [46, 108], [30, 100], [22, 98]]);
  road([[122, 126], [160, 124], [196, 122], [205, 135], [216, 142]]);
  road([[122, 126], [124, 90], [120, 60], [118, 36], [112, 14]]);
  road([[122, 126], [145, 136], [150, 142]]);
  road([[118, 40], [150, 50], [184, 58], [200, 45], [218, 22]], 2);
  road([[46, 108], [70, 140], [110, 150]]);
  road([[196, 122], [200, 80], [184, 58]]);

  // cave tunnels
  let cx = 184, cy = 58;
  for (let i = 0; i < 2500; i++) {
    clear(cx, cy, 1, T.CAVE);
    const r = hash(i, 7, 77);
    cx += r < 0.25 ? 1 : r < 0.5 ? -1 : 0;
    cy += r >= 0.5 && r < 0.75 ? 1 : r >= 0.75 ? -1 : 0;
    cx = Math.max(172, Math.min(W - 5, cx)); cy = Math.max(5, Math.min(70, cy));
    if (BIOME_LIST[biomes[cy * W + cx]] !== "cave") { cx = 200; cy = 40; }
  }

  // Village
  clear(122, 126, 13, T.GRASS);
  for (let y = 114; y <= 138; y++) for (let x = 108; x <= 136; x++) {
    const dx = x - 122, dy = y - 126;
    if (dx * dx + dy * dy < 150 && (Math.abs(dx) < 2 || Math.abs(dy) < 2)) set(x, y, T.COBBLE);
  }
  clear(122, 126, 3, T.COBBLE);
  const house = (hx: number, hy: number, w: number, h: number) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(hx + x, hy + y, y < h - 2 ? T.ROOF : T.WALL);
  };
  house(109, 119, 5, 4); house(130, 119, 5, 4); house(116, 112, 7, 5); house(109, 130, 5, 4); house(131, 130, 5, 4);

  for (const s of STATUES) clear(s.tx, s.ty, 2, s.id === "cave" ? T.CAVE : s.id === "village" ? T.COBBLE : floorOf(s.tx, s.ty));
  for (const b of BOSSES) clear(b.tx, b.ty, 8, floorOf(b.tx, b.ty));
  for (const n of NPCS) { const t = get(n.tx, n.ty); if (SOLID.has(t)) set(n.tx, n.ty, floorOf(n.tx, n.ty)); }
  clear(121, 38, 2, T.SNOW);

  // resource nodes
  const nodes: Node[] = [];
  let id = 0;
  for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) {
    const t = tiles[y * W + x];
    if (SOLID.has(t) || t === T.COBBLE || t === T.PATH) continue;
    const r = hash(x, y, 555);
    const b = BIOME_LIST[biomes[y * W + x]];
    let item: string | null = null;
    if (r < 0.012) {
      if (b === "plains") item = hash(x, y, 4) < 0.8 ? "herb" : "iron_ore";
      else if (b === "forest") item = hash(x, y, 4) < 0.5 ? "herb" : "wood";
      else if (b === "desert") item = hash(x, y, 4) < 0.45 ? "desert_rose" : hash(x, y, 4) < 0.8 ? "iron_ore" : "mana_shard";
      else if (b === "mountain") item = hash(x, y, 4) < 0.5 ? "frost_herb" : "iron_ore";
      else item = hash(x, y, 4) < 0.55 ? "crystal_ore" : "mana_shard";
    }
    if (item) nodes.push({ id: id++, tx: x, ty: y, item, respawn: 0 });
  }
  return { tiles, biomes, nodes };
}

export function tileAt(w: World, tx: number, ty: number) {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return T.WATER;
  return w.tiles[ty * W + tx];
}
export function biomeOf(w: World, px: number, py: number): Biome {
  const tx = Math.max(0, Math.min(W - 1, Math.floor(px / TS))), ty = Math.max(0, Math.min(H - 1, Math.floor(py / TS)));
  return BIOME_LIST[w.biomes[ty * W + tx]];
}
export function solidAt(w: World, px: number, py: number) {
  return SOLID.has(tileAt(w, Math.floor(px / TS), Math.floor(py / TS)));
}
