import {
  BIOME_ENEMIES, BIOME_NAMES, BOSSES, ENEMIES, ITEMS, NPCS, QUESTS, RECIPES, SPIRITS, STATUES,
  type Biome, type BossDef, type EnemyKind, type NpcDef, type QuestDef, type Recipe, type Slot, type SpiritId, type Stats,
} from "./data";
import { generateWorld, W, H, TS, T, tileAt, biomeOf, solidAt, BIOME_LIST, hash, type World } from "./world";
import { buildTiles, drawChar, drawEnemy, drawStatue, drawNode } from "./gfx";
import { BUILDINGS, TREASURES, ROOM, doorOf, createInterior, prepareExploration, canClaimTreasure, type Building } from './exploration';
import { drawBuildings, drawGroundDetails, drawInterior, drawTreasure } from './scenery';
import { Audio } from "./audio";

export const VW = 480;
export const VH = 270;
const TIER: Record<Biome, number> = { plains: 1, forest: 2, desert: 3, mountain: 4, cave: 5 };
const BOSS_LOOK: Record<string, { kind: EnemyKind; tint: string; scale: number }> = {
  king_mush: { kind: "mushroom", tint: "#c02090", scale: 2.6 },
  ent: { kind: "sporeling", tint: "#2a7a2a", scale: 2.8 },
  sahr: { kind: "scorpion", tint: "#9a2a5a", scale: 2.6 },
  fenrir: { kind: "wolf", tint: "#b8e4ff", scale: 2.6 },
  crystal_golem: { kind: "golem", tint: "#b080ff", scale: 2.5 },
};

interface BossState { def: BossDef; active: boolean; phase: 1 | 2; patT: number; charge: number; cvx: number; cvy: number }
export interface Enemy {
  id: number; kind: EnemyKind; x: number; y: number; hx: number; hy: number; hp: number; maxhp: number; atk: number; def: number;
  speed: number; xp: number; gold: number; level: number; cd: number; hurt: number; dir: number; alive: boolean; respawn: number;
  slow: number; kbx: number; kby: number; wanderT: number; wx: number; wy: number; boss?: BossState; t: number; summoned?: boolean;
}
interface Proj { x: number; y: number; vx: number; vy: number; life: number; dmg: number; from: "p" | "e"; kind: string; r: number; color: string; slow?: boolean }
interface Tele { x: number; y: number; r: number; t: number; max: number; dmg: number }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; grav: number }
interface FText { x: number; y: number; text: string; color: string; life: number }
export interface InvSlot { id: string; qty: number }
export interface DialogChoice { label: string; act: () => void }
export interface Dialog { npc: NpcDef; text: string; choices: DialogChoice[] }

export class Game {
  world: World;
  overworld: World;
  interior: Building | null = null;
  returnPosition = { x: 0, y: 0 };
  discoveries = new Set<string>();
  openedChests = new Set<string>();
  transition = 0;
  doorCooldown = 0;
  get areaName() { return this.interior?.name ?? (Math.hypot(this.p.x / TS - 122, this.p.y / TS - 126) < 19 ? 'Vila de Potos' : BIOME_NAMES[this.biome]); }
  get localNpcs(): NpcDef[] {
    if (!this.interior) return NPCS;
    const npc = NPCS.find(n => n.id === this.interior?.resident);
    return npc ? [{ ...npc, tx: 121, ty: 100 }] : [];
  }
  tiles: HTMLCanvasElement[][] = [];
  minimap!: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  light: HTMLCanvasElement;
  lctx: CanvasRenderingContext2D;
  audio = new Audio();
  keys = new Set<string>();
  mouse = { x: 0, y: 0, down: false };
  time = 0.32; // day fraction
  clock = 0;
  cam = { x: 0, y: 0 };
  shake = 0;
  paused = false;
  started = false;
  enemies: Enemy[] = [];
  projs: Proj[] = [];
  teles: Tele[] = [];
  parts: Part[] = [];
  texts: FText[] = [];
  weather: { x: number; y: number; s: number }[] = [];
  toasts: { text: string; t: number; color: string }[] = [];
  dialog: Dialog | null = null;
  openStation: "smith" | "alchemist" | "shop" | null = null;
  moveTarget: { x: number; y: number } | null = null;
  targetEnemy: Enemy | null = null;
  talkTarget: NpcDef | null = null;
  activeBoss: Enemy | null = null;
  biome: Biome = "plains";
  biomeBanner = { name: "", t: 0 };
  raining = false;
  nextId = 1;
  autosaveT = 0;

  p = {
    x: 122 * TS + 8, y: 128 * TS + 8, vx: 0, vy: 0, dir: 0, frame: 0, frameT: 0, attackT: 0, atkCd: 0, spellCd: 0, inv: 0,
    hp: 100, mp: 30, level: 1, xp: 0, points: 0, gold: 50,
    base: { str: 5, dex: 5, vit: 5, int: 5, wis: 5 } as Stats,
    equip: { weapon: "wood_sword", armor: "cloth", ring: null, amulet: null } as Record<Slot, string | null>,
    spirits: ["salamando", "dryad"] as SpiritId[],
    spell: "salamando" as SpiritId,
    respawnStatue: "village",
    dead: 0,
  };
  inventory: InvSlot[] = [{ id: "potion", qty: 3 }, { id: "ether", qty: 1 }];
  questStatus: Record<string, "active" | "done"> = {};
  questProg: Record<string, number> = {};
  statues = new Set<string>(["village"]);
  bossesDone = new Set<string>();
  readonly INV_MAX = 24;

  constructor(public canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível");
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
    this.light = document.createElement("canvas");
    this.light.width = VW; this.light.height = VH;
    const lightContext = this.light.getContext("2d");
    if (!lightContext) throw new Error("Iluminação indisponível");
    this.lctx = lightContext;
    this.world = generateWorld();
    prepareExploration(this.world);
    this.overworld = this.world;
    this.tiles = buildTiles();
    this.buildMinimap();
    this.spawnEnemies();
    for (let i = 0; i < 120; i++) this.weather.push({ x: Math.random() * VW, y: Math.random() * VH, s: Math.random() });
    const p = this.p;
    p.hp = this.maxHp(); p.mp = this.maxMp();
  }

  // ---------- stats ----------
  stats(): Stats {
    const s = { ...this.p.base };
    for (const id of Object.values(this.p.equip)) {
      const b = id ? ITEMS[id].bonus : undefined;
      if (b) for (const k of ["str", "dex", "vit", "int", "wis"] as const) s[k] += b[k] ?? 0;
    }
    return s;
  }
  bonus(k: "hp" | "mp") { let v = 0; for (const id of Object.values(this.p.equip)) if (id) v += ITEMS[id].bonus?.[k] ?? 0; return v; }
  maxHp() { return 50 + this.stats().vit * 10 + this.p.level * 6 + this.bonus("hp"); }
  maxMp() { const s = this.stats(); return 20 + s.wis * 5 + s.int * 2 + this.bonus("mp"); }
  defense() { const a = this.p.equip.armor; return (a ? ITEMS[a].def ?? 0 : 0) + Math.floor(this.stats().vit / 2); }
  weapon() { return ITEMS[this.p.equip.weapon ?? "wood_sword"]; }
  attackPower() {
    const w = this.weapon(), s = this.stats();
    const atk = w.atk ?? 0;
    if (w.weapon === "bow") return s.dex * 2 + atk + s.str * 0.5;
    if (w.weapon === "staff") return s.int * 2 + atk;
    if (w.weapon === "spear") return Math.round((s.str * 2 + atk) * 1.15);
    return s.str * 2 + atk;
  }
  xpNeed() { return Math.floor(25 * Math.pow(this.p.level, 1.6)); }

  // ---------- setup ----------
  buildMinimap() {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d")!;
    const img = x.createImageData(W, H);
    const col: Record<number, [number, number, number]> = {
      [T.GRASS]: [76, 163, 58], [T.FLOWER]: [90, 170, 70], [T.PATH]: [200, 164, 104], [T.WATER]: [42, 106, 208], [T.TREE]: [30, 110, 30],
      [T.SAND]: [230, 200, 122], [T.DUNE]: [210, 180, 100], [T.ROCK]: [110, 110, 120], [T.SNOW]: [238, 244, 255], [T.ICE]: [168, 216, 240],
      [T.CAVE]: [70, 58, 96], [T.CWALL]: [20, 16, 32], [T.CRYSTAL]: [190, 120, 255], [T.COBBLE]: [180, 168, 150], [T.WALL]: [232, 220, 192],
      [T.ROOF]: [192, 72, 48], [T.PINE]: [40, 100, 70], [T.BUSH]: [110, 140, 50], [T.PILLAR]: [200, 184, 160], [T.BRIDGE]: [154, 106, 58],
      [T.DTREE]: [20, 80, 55], [T.CACTUS]: [60, 150, 60],
    };
    for (let i = 0; i < W * H; i++) {
      const [r, g, b] = col[this.world.tiles[i]] ?? [0, 0, 0];
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    this.minimap = c;
  }
  mapDataUrl() { return this.minimap.toDataURL(); }

  makeEnemy(kind: EnemyKind, x: number, y: number, tier: number): Enemy {
    const d = ENEMIES[kind];
    const m = 1 + (tier - 1) * 0.3;
    return {
      id: this.nextId++, kind, x, y, hx: x, hy: y, hp: Math.round(d.hp * m), maxhp: Math.round(d.hp * m), atk: Math.round(d.atk * m), def: d.def,
      speed: d.speed, xp: Math.round(d.xp * m), gold: Math.round(d.gold * m), level: tier * 4 + Math.floor(Math.random() * 3), cd: 1,
      hurt: 0, dir: 0, alive: true, respawn: 0, slow: 0, kbx: 0, kby: 0, wanderT: 0, wx: x, wy: y, t: Math.random() * 10,
    };
  }
  spawnEnemies() {
    let tries = 0;
    while (this.enemies.length < 260 && tries < 20000) {
      tries++;
      const tx = 4 + Math.floor(Math.random() * (W - 8)), ty = 4 + Math.floor(Math.random() * (H - 8));
      const t = tileAt(this.world, tx, ty);
      if (t === T.WATER || t === T.COBBLE || solidAt(this.world, tx * TS + 8, ty * TS + 8)) continue;
      if (Math.hypot(tx - 122, ty - 126) < 18) continue;
      if (STATUES.some((s) => Math.hypot(s.tx - tx, s.ty - ty) < 6)) continue;
      const b = BIOME_LIST[this.world.biomes[ty * W + tx]];
      const list = BIOME_ENEMIES[b];
      const kind = list[Math.floor(Math.random() * list.length)];
      this.enemies.push(this.makeEnemy(kind, tx * TS + 8, ty * TS + 8, TIER[b]));
    }
    for (const b of BOSSES) {
      const look = BOSS_LOOK[b.id];
      const e = this.makeEnemy(look.kind, b.tx * TS + 8, b.ty * TS + 8, 1);
      e.hp = e.maxhp = b.hp; e.atk = b.atk; e.def = TIER[b.biome] * 3; e.xp = b.xp; e.gold = b.gold; e.speed = 30; e.level = TIER[b.biome] * 5 + 3;
      e.boss = { def: b, active: false, phase: 1, patT: 2, charge: 0, cvx: 0, cvy: 0 };
      this.enemies.push(e);
    }
  }

  // ---------- helpers ----------
  toast(text: string, color = "#ffe9a0") { this.toasts.push({ text, t: 4, color }); if (this.toasts.length > 5) this.toasts.shift(); }
  float(x: number, y: number, text: string, color: string) { this.texts.push({ x, y, text, color, life: 1 }); }
  burst(x: number, y: number, color: string, n = 10, speed = 60, size = 2, grav = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, max: 0.9, color, size, grav });
    }
  }
  count(id: string) { return this.inventory.filter((s) => s.id === id).reduce((a, s) => a + s.qty, 0); }
  addItem(id: string, qty = 1): boolean {
    const stack = ITEMS[id].type === "potion" || ITEMS[id].type === "material";
    if (stack) {
      const s = this.inventory.find((i) => i.id === id);
      if (s) { s.qty += qty; return true; }
    }
    for (let i = 0; i < (stack ? 1 : qty); i++) {
      if (this.inventory.length >= this.INV_MAX) { this.toast("Inventário cheio!", "#ff8080"); return false; }
      this.inventory.push({ id, qty: stack ? qty : 1 });
    }
    return true;
  }
  removeItem(id: string, qty = 1) {
    let left = qty;
    for (const s of this.inventory) if (s.id === id && left > 0) { const t = Math.min(s.qty, left); s.qty -= t; left -= t; }
    this.inventory = this.inventory.filter((s) => s.qty > 0);
  }
  aimNearest(range = 150): { x: number; y: number } {
    let best: Enemy | null = null, bd = range;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - this.p.x, e.y - this.p.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) return { x: best.x - this.p.x, y: best.y - 8 - (this.p.y - 8) };
    const d = [[0, 1], [-1, 0], [1, 0], [0, -1]][this.p.dir];
    return { x: d[0], y: d[1] };
  }
  setDirFrom(dx: number, dy: number) {
    if (Math.abs(dx) > Math.abs(dy)) this.p.dir = dx < 0 ? 1 : 2; else this.p.dir = dy < 0 ? 3 : 0;
  }

  // ---------- combat ----------
  damageEnemy(e: Enemy, raw: number, kx = 0, ky = 0, color = "#ffffff", mult = 1) {
    if (!e.alive) return;
    const s = this.stats();
    const crit = Math.random() < 0.05 + s.dex * 0.004;
    let dmg = Math.max(1, Math.round((raw - e.def) * (0.9 + Math.random() * 0.2) * mult * (crit ? 1.8 : 1)));
    if (e.boss && !e.boss.active) this.activateBoss(e);
    e.hp -= dmg;
    e.hurt = 0.15;
    e.kbx += kx * (e.boss ? 0.15 : 1); e.kby += ky * (e.boss ? 0.15 : 1);
    this.float(e.x, e.y - 20, crit ? `${dmg}!` : `${dmg}`, crit ? "#ffd040" : color);
    this.burst(e.x, e.y - 8, color, 5, 50);
    this.audio.sfx("hit");
    if (crit) this.shake = 3;
    dmg = 0;
    if (e.hp <= 0) this.killEnemy(e);
  }
  killEnemy(e: Enemy) {
    e.alive = false;
    e.respawn = e.summoned ? -1 : 35;
    this.burst(e.x, e.y - 8, "#ffffff", 16, 80);
    this.audio.sfx("die");
    if (e.summoned) return;
    this.gainXp(e.xp);
    this.p.gold += e.gold;
    this.float(e.x, e.y - 30, `+${e.xp} XP`, "#80ffff");
    if (e.boss) {
      const b = e.boss.def;
      this.bossesDone.add(b.id);
      this.activeBoss = null;
      this.audio.boss = false;
      this.toast(`${b.name} foi derrotado!`, "#ffd040");
      for (const it of b.reward) if (this.addItem(it)) this.toast(`Recebeu: ${ITEMS[it].name}`);
      if (b.spirit && !this.p.spirits.includes(b.spirit)) {
        this.p.spirits.push(b.spirit);
        const sp = SPIRITS.find((s) => s.id === b.spirit)!;
        this.toast(`O espírito ${sp.name} juntou-se a você! (${sp.spell})`, sp.color);
        this.audio.sfx("level");
      }
      for (const en of this.enemies) if (en.summoned) en.alive = false;
      for (const q of QUESTS) if (this.questStatus[q.id] === "active" && q.goal.kind === "boss" && q.goal.target === b.id) { this.questProg[q.id] = 1; this.toast(`Missão pronta: ${q.title}`, "#a0ff a0"); }
      this.burst(e.x, e.y - 20, "#ffd040", 60, 140, 3);
      this.save();
      return;
    }
    const d = ENEMIES[e.kind];
    for (const [it, ch] of d.drops) if (Math.random() < ch) { if (this.addItem(it)) this.float(e.x, e.y - 40, ITEMS[it].name, ITEMS[it].color); }
    for (const q of QUESTS) {
      if (this.questStatus[q.id] === "active" && q.goal.kind === "kill" && q.goal.target === e.kind) {
        const n = (this.questProg[q.id] ?? 0) + 1;
        if (n <= q.goal.n) { this.questProg[q.id] = n; if (n === q.goal.n) this.toast(`Missão pronta: ${q.title}`, "#a0ffa0"); }
      }
    }
  }
  gainXp(n: number) {
    const p = this.p;
    p.xp += n;
    while (p.xp >= this.xpNeed()) {
      p.xp -= this.xpNeed();
      p.level++;
      p.points += 3;
      p.hp = this.maxHp(); p.mp = this.maxMp();
      this.toast(`Nível ${p.level}! +3 pontos de atributo (C)`, "#ffd040");
      this.audio.sfx("level");
      this.burst(p.x, p.y - 10, "#ffd040", 30, 90, 2, -40);
    }
  }
  hurtPlayer(raw: number, sx: number, sy: number) {
    const p = this.p;
    if (p.inv > 0 || p.dead > 0) return;
    const dmg = Math.max(1, Math.round(raw - this.defense() * 0.6 + (Math.random() * 4 - 2)));
    p.hp -= dmg;
    p.inv = 0.6;
    const a = Math.atan2(p.y - sy, p.x - sx);
    p.vx += Math.cos(a) * 140; p.vy += Math.sin(a) * 140;
    this.float(p.x, p.y - 24, `${dmg}`, "#ff5050");
    this.shake = 4;
    this.audio.sfx("hurt");
    if (p.hp <= 0) {
      p.hp = 0; p.dead = 2.5;
      this.toast("Você caiu... Os espíritos o levam de volta.", "#ff8080");
      this.audio.sfx("die");
    }
  }
  activateBoss(e: Enemy) {
    if (!e.boss || e.boss.active) return;
    e.boss.active = true;
    this.activeBoss = e;
    this.audio.boss = true;
    this.audio.sfx("boss");
    this.toast(`⚔ ${e.boss.def.name} desperta!`, "#ff6060");
    this.shake = 8;
  }

  attack(aim?: { x: number; y: number }) {
    const p = this.p;
    if (this.interior) return;
    if (p.atkCd > 0 || p.dead > 0) return;
    const w = this.weapon();
    const kind = w.weapon ?? "sword";
    const a = aim ?? this.aimNearest(kind === "bow" || kind === "staff" ? 160 : 40);
    const len = Math.hypot(a.x, a.y) || 1;
    const dx = a.x / len, dy = a.y / len;
    this.setDirFrom(dx, dy);
    p.attackT = 1;
    const pow = this.attackPower();
    const s = this.stats();
    const speedMul = 1 - Math.min(0.4, s.dex * 0.008);
    if (kind === "sword" || kind === "spear") {
      p.atkCd = (kind === "sword" ? 0.35 : 0.5) * speedMul;
      const range = kind === "sword" ? 26 : 38, arc = kind === "sword" ? 1.2 : 0.5;
      this.audio.sfx("swing");
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const ex = e.x - p.x, ey = e.y - 6 - (p.y - 8);
        const d = Math.hypot(ex, ey);
        const hitR = e.boss ? 18 : 6;
        if (d > range + hitR) continue;
        const ang = Math.abs(Math.atan2(dx * ey - dy * ex, dx * ex + dy * ey));
        if (ang < arc || d < 10 + hitR) this.damageEnemy(e, pow, dx * 120, dy * 120);
      }
      for (let i = 0; i < 6; i++) {
        const ang = Math.atan2(dy, dx) + (i / 5 - 0.5) * arc * 2;
        this.parts.push({ x: p.x + Math.cos(ang) * range * 0.8, y: p.y - 8 + Math.sin(ang) * range * 0.8, vx: 0, vy: 0, life: 0.15, max: 0.15, color: w.color, size: 2, grav: 0 });
      }
      this.tryGather(true);
    } else if (kind === "bow") {
      p.atkCd = 0.45 * speedMul;
      this.audio.sfx("bow");
      this.projs.push({ x: p.x, y: p.y - 8, vx: dx * 260, vy: dy * 260, life: 0.8, dmg: pow, from: "p", kind: "arrow", r: 3, color: "#f0e0c0" });
    } else {
      p.atkCd = 0.5 * speedMul;
      this.audio.sfx("ice");
      this.projs.push({ x: p.x, y: p.y - 8, vx: dx * 180, vy: dy * 180, life: 1, dmg: pow, from: "p", kind: "orb", r: 4, color: w.color });
    }
  }

  cast(id: SpiritId) {
    const p = this.p;
    if (this.interior) return;
    if (!p.spirits.includes(id) || p.dead > 0) return;
    p.spell = id;
    const sp = SPIRITS.find((s) => s.id === id)!;
    if (p.spellCd > 0) return;
    if (p.mp < sp.mp) { this.float(p.x, p.y - 28, "Sem MP", "#6090ff"); return; }
    p.mp -= sp.mp;
    p.spellCd = sp.cd;
    const s = this.stats();
    const a = this.aimNearest(170);
    const len = Math.hypot(a.x, a.y) || 1, dx = a.x / len, dy = a.y / len;
    this.setDirFrom(dx, dy);
    p.attackT = 1;
    const cx = p.x, cy = p.y - 8;
    switch (id) {
      case "salamando":
        this.audio.sfx("fire");
        this.projs.push({ x: cx, y: cy, vx: dx * 170, vy: dy * 170, life: 1.2, dmg: s.int * 3 + 12, from: "p", kind: "fire", r: 5, color: "#ff6a20" });
        break;
      case "undine":
        this.audio.sfx("ice");
        for (const o of [-0.25, 0, 0.25]) {
          const ang = Math.atan2(dy, dx) + o;
          this.projs.push({ x: cx, y: cy, vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210, life: 0.9, dmg: s.int * 1.8 + 8, from: "p", kind: "ice", r: 4, color: "#80d8ff", slow: true });
        }
        break;
      case "sylph":
        this.audio.sfx("wind");
        for (let i = 0; i < 40; i++) {
          const ang = (i / 40) * Math.PI * 2;
          this.parts.push({ x: cx, y: cy, vx: Math.cos(ang) * 140, vy: Math.sin(ang) * 140, life: 0.4, max: 0.4, color: i % 2 ? "#b0ffb0" : "#ffffff", size: 2, grav: 0 });
        }
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const d = Math.hypot(e.x - cx, e.y - cy);
          if (d < 60) { const k = 1 / (d || 1); this.damageEnemy(e, s.int * 2 + s.wis + 12, (e.x - cx) * k * 260, (e.y - cy) * k * 260, "#b0ffb0"); }
        }
        break;
      case "lumina": {
        this.audio.sfx("light");
        const tx = cx + a.x * (Math.hypot(a.x, a.y) > 1 ? 1 : 50), ty = cy + a.y * (Math.hypot(a.x, a.y) > 1 ? 1 : 50);
        this.teles.push({ x: tx, y: ty, r: 48, t: 0.35, max: 0.35, dmg: -(s.int * 4 + 25) });
        break;
      }
      case "dryad": {
        this.audio.sfx("heal");
        const h = s.wis * 6 + 25;
        p.hp = Math.min(this.maxHp(), p.hp + h);
        this.float(p.x, p.y - 28, `+${h}`, "#70ff90");
        this.burst(p.x, p.y - 8, "#70ff90", 24, 50, 2, -60);
        break;
      }
    }
  }

  usePotion(id: string) {
    const it = ITEMS[id]; if (!it || it.type !== "potion" || this.count(id) <= 0) return;
    const p = this.p;
    if (it.heal) { p.hp = Math.min(this.maxHp(), p.hp + it.heal); this.float(p.x, p.y - 26, `+${Math.min(it.heal, 999)} HP`, "#70ff90"); }
    if (it.mana) { p.mp = Math.min(this.maxMp(), p.mp + it.mana); this.float(p.x, p.y - 34, `+MP`, "#60a0ff"); }
    this.removeItem(id);
    this.audio.sfx("heal");
  }
  quickPotion(mana = false) {
    const order = mana ? ["ether", "elixir"] : ["potion", "hi_potion", "elixir"];
    const id = order.find((i) => this.count(i) > 0);
    if (id) this.usePotion(id); else this.toast(mana ? "Sem éteres!" : "Sem poções!", "#ff8080");
  }
  equip(idx: number) {
    const s = this.inventory[idx]; if (!s) return;
    const it = ITEMS[s.id];
    if (it.type === "potion") { this.usePotion(s.id); return; }
    if (it.type === "material") return;
    const slot = it.type as Slot;
    const prev = this.p.equip[slot];
    this.inventory.splice(idx, 1);
    if (prev) this.inventory.push({ id: prev, qty: 1 });
    this.p.equip[slot] = s.id;
    this.p.hp = Math.min(this.p.hp, this.maxHp()); this.p.mp = Math.min(this.p.mp, this.maxMp());
    this.audio.sfx("pickup");
  }
  unequip(slot: Slot) {
    const id = this.p.equip[slot]; if (!id || slot === "weapon") return;
    if (this.inventory.length >= this.INV_MAX) return;
    this.inventory.push({ id, qty: 1 });
    this.p.equip[slot] = null;
    this.p.hp = Math.min(this.p.hp, this.maxHp()); this.p.mp = Math.min(this.p.mp, this.maxMp());
    this.audio.sfx("ui");
  }
  allocate(k: keyof Stats) { if (this.p.points > 0) { this.p.points--; this.p.base[k]++; this.audio.sfx("ui"); } }
  canCraft(r: Recipe) { return this.p.gold >= r.gold && Object.entries(r.cost).every(([id, n]) => this.count(id) >= n); }
  craft(r: Recipe) {
    if (!this.canCraft(r)) { this.audio.sfx("hurt"); return; }
    for (const [id, n] of Object.entries(r.cost)) this.removeItem(id, n);
    this.p.gold -= r.gold;
    this.addItem(r.out, r.qty);
    this.audio.sfx("craft");
    this.toast(`Criado: ${ITEMS[r.out].name}${r.qty > 1 ? ` x${r.qty}` : ""}`, "#a0ffa0");
  }
  recipes(station: "smith" | "alchemist") { return RECIPES.filter((r) => r.station === station); }
  buy(id: string) {
    const it = ITEMS[id];
    if (this.p.gold < it.price) { this.audio.sfx("hurt"); return; }
    if (this.addItem(id)) { this.p.gold -= it.price; this.audio.sfx("coin"); }
  }
  sell(idx: number) {
    const s = this.inventory[idx]; if (!s) return;
    const price = Math.max(1, Math.floor(ITEMS[s.id].price / 2));
    this.removeItem(s.id, 1);
    this.p.gold += price;
    this.audio.sfx("coin");
  }
  travel(id: string) {
    if (this.interior) this.leaveInterior();
    const s = STATUES.find((x) => x.id === id);
    if (!s || !this.statues.has(id)) return;
    this.p.x = s.tx * TS + 8; this.p.y = (s.ty + 2) * TS + 8; this.p.vx = this.p.vy = 0;
    this.moveTarget = null; this.targetEnemy = null;
    this.audio.sfx("warp");
    this.burst(this.p.x, this.p.y - 10, "#80f0ff", 40, 90, 2, -30);
    this.toast(`Viajou para ${s.name}`, "#80f0ff");
  }

  // ---------- quests / dialog ----------
  questReady(q: QuestDef) {
    if (this.questStatus[q.id] !== "active") return false;
    if (q.goal.kind === "collect") return this.count(q.goal.item) >= q.goal.n;
    if (q.goal.kind === "boss") return this.bossesDone.has(q.goal.target);
    return (this.questProg[q.id] ?? 0) >= q.goal.n;
  }
  questProgressText(q: QuestDef) {
    if (q.goal.kind === "collect") return `${Math.min(this.count(q.goal.item), q.goal.n)}/${q.goal.n} ${ITEMS[q.goal.item].name}`;
    if (q.goal.kind === "boss") return this.bossesDone.has(q.goal.target) ? "Chefe derrotado! Retorne." : `Derrote ${BOSSES.find((b) => b.id === (q.goal as { target: string }).target)?.name}`;
    return `${this.questProg[q.id] ?? 0}/${q.goal.n} ${ENEMIES[q.goal.target].name}`;
  }
  availableQuest(npc: string) {
    return QUESTS.find((q) => q.giver === npc && !this.questStatus[q.id] && (!q.requires || this.questStatus[q.requires] === "done"));
  }
  talk(npc: NpcDef) {
    this.audio.sfx("ui");
    const line = npc.lines[Math.floor(Math.random() * npc.lines.length)];
    this.dialog = { npc, text: line, choices: this.npcChoices(npc) };
  }
  npcChoices(npc: NpcDef): DialogChoice[] {
    const ch: DialogChoice[] = [];
    for (const q of QUESTS.filter((q) => q.giver === npc.id && this.questStatus[q.id] === "active")) {
      if (this.questReady(q)) ch.push({ label: `✔ Entregar: ${q.title}`, act: () => this.completeQuest(q, npc) });
      else ch.push({ label: `… ${q.title}`, act: () => this.say(npc, `Ainda falta: ${this.questProgressText(q)}. ${q.desc}`) });
    }
    const av = this.availableQuest(npc.id);
    if (av) ch.push({ label: `${av.main ? "★" : "!"} Missão: ${av.title}`, act: () => this.offer(npc, av) });
    if (npc.role === "smith") ch.push({ label: "⚒ Forjar equipamentos", act: () => { this.dialog = null; this.openStation = "smith"; } });
    if (npc.role === "alchemist") ch.push({ label: "⚗ Alquimia", act: () => { this.dialog = null; this.openStation = "alchemist"; } });
    if (npc.role === "shop" || npc.role === "alchemist") ch.push({ label: "💰 Comprar / Vender", act: () => { this.dialog = null; this.openStation = "shop"; } });
    ch.push({ label: "Conversar", act: () => this.say(npc, npc.lines[Math.floor(Math.random() * npc.lines.length)]) });
    ch.push({ label: "Adeus", act: () => { this.dialog = null; } });
    return ch;
  }
  say(npc: NpcDef, text: string) { this.audio.sfx("ui"); this.dialog = { npc, text, choices: this.npcChoices(npc) }; }
  offer(npc: NpcDef, q: QuestDef) {
    this.dialog = {
      npc, text: q.desc + `  (Recompensa: ${q.reward.xp} XP, ${q.reward.gold} ouro${q.reward.items ? ", itens" : ""})`,
      choices: [
        { label: "Aceitar missão", act: () => { this.questStatus[q.id] = "active"; this.questProg[q.id] = 0; this.audio.sfx("pickup"); this.toast(`Nova missão: ${q.title}`, "#a0d0ff"); this.say(npc, "Que os espíritos o guiem!"); } },
        { label: "Agora não", act: () => this.say(npc, "Volte quando estiver pronto.") },
      ],
    };
  }
  completeQuest(q: QuestDef, npc: NpcDef) {
    if (q.goal.kind === "collect") this.removeItem(q.goal.item, q.goal.n);
    this.questStatus[q.id] = "done";
    this.gainXp(q.reward.xp);
    this.p.gold += q.reward.gold;
    for (const it of q.reward.items ?? []) this.addItem(it);
    this.audio.sfx("level");
    this.toast(`Missão concluída: ${q.title}!`, "#ffd040");
    this.say(npc, q.id === "m6" ? "Você salvou a Árvore de Mana! Seu nome será lembrado para sempre, Herói de Mana." : "Muito bem! Aqui está sua recompensa.");
    this.save();
  }

  // ---------- interaction ----------
  nearNpc(r = 22) { return this.localNpcs.find((n) => Math.hypot(n.tx * TS + 8 - this.p.x, n.ty * TS + 8 - this.p.y) < r) ?? null; }
  tryGather(silent = false) {
    const p = this.p;
    for (const n of this.world.nodes) {
      if (n.respawn > 0) continue;
      if (Math.hypot(n.tx * TS + 8 - p.x, n.ty * TS + 12 - p.y) < 18) {
        const q = n.item === "herb" || n.item === "wood" ? 1 + (Math.random() < 0.3 ? 1 : 0) : 1;
        if (this.addItem(n.item, q)) {
          n.respawn = 60;
          this.float(n.tx * TS + 8, n.ty * TS, `+${q} ${ITEMS[n.item].name}`, ITEMS[n.item].color);
          this.burst(n.tx * TS + 8, n.ty * TS + 8, ITEMS[n.item].color, 8, 40);
          this.audio.sfx("pickup");
        }
        return true;
      }
    }
    if (!silent) return false;
    return false;
  }
  interact() {
    if (this.interactExploration()) return;
    const npc = this.nearNpc(26);
    if (npc) { this.talk(npc); return; }
    if (this.tryGather()) return;
  }

  enterInterior(b: Building) {
    if (this.interior || this.doorCooldown > 0) return;
    this.returnPosition = { x: this.p.x, y: (doorOf(b).ty + 1.7) * TS };
    this.interior = b; this.world = createInterior(b);
    this.p.x = ROOM.spawnX; this.p.y = ROOM.spawnY;
    this.clearTransition(); this.discoveries.add(b.id);
    this.biomeBanner = { name: b.name, t: 3 };
    this.toast(b.secret ? 'Uma passagem esquecida... novo segredo descoberto!' : b.name, '#dfca91');
    this.save();
  }
  leaveInterior() {
    if (!this.interior) return;
    this.interior = null; this.world = this.overworld;
    this.p.x = this.returnPosition.x; this.p.y = this.returnPosition.y;
    this.clearTransition(); this.save();
  }
  clearTransition() {
    this.p.vx = this.p.vy = 0; this.moveTarget = null; this.targetEnemy = null; this.talkTarget = null;
    this.projs = []; this.teles = []; this.parts = []; this.texts = [];
    this.doorCooldown = 0.8; this.transition = 0.65; this.audio.sfx('warp');
  }
  claimChest(id: string, gold: number, item: string, qty: number, name: string) {
    if (!canClaimTreasure(this.openedChests, id)) { this.toast('O baú já está vazio.'); return; }
    if (!this.addItem(item, qty)) return;
    this.openedChests.add(id); this.p.gold += gold;
    this.toast(`${name}: +${gold} ouro · ${ITEMS[item].name} ×${qty}`, '#f4dc91');
    this.gainXp(20); this.audio.sfx('pickup'); this.burst(this.p.x, this.p.y-12, '#ffe1a0', 22, 55, 2, -30); this.save();
  }
  interactExploration(): boolean {
    const p = this.p, near = (x:number,y:number,r=28) => Math.hypot(p.x-x*TS-8,p.y-y*TS-8)<r;
    if (this.interior) {
      if(near(ROOM.exitX,ROOM.exitY,32)){ this.leaveInterior(); return true; }
      if(near(110,106,30)){this.claimChest(`house-${this.interior.id}`,75,this.interior.secret?'elixir':'ether',2,'Tesouro de '+this.interior.name);return true;}
      if(near(114,100,42)){ this.toast(this.interior.note); return true; }
      if(near(127,105,35) && this.interior.kind === 'inn') {p.hp=this.maxHp();p.mp=this.maxMp();this.audio.sfx('heal');this.toast('Você descansou. HP e MP restaurados.');return true;}
      if(near(109,97,38) && this.interior.id === 'archive'){
        const b=BUILDINGS.find(b=>b.id==='roots');
        if(b){this.leaveInterior();this.doorCooldown=0;this.enterInterior(b);this.toast('A estante se move... um santuário sob as raízes!');} return true;
      }
      return false;
    }
    const b=BUILDINGS.find(b=>{const d=doorOf(b);return near(d.tx,d.ty,30);});
    if(b){this.enterInterior(b);return true;}
    const t=TREASURES.find(t=>near(t.tx,t.ty,26));
    if(t){this.claimChest(t.id,t.gold,t.item,t.qty,t.name);return true;}
    return false;
  }

  // ---------- input ----------
  click(sx: number, sy: number, right: boolean) {
    this.audio.init();
    const wx = sx + this.cam.x, wy = sy + this.cam.y;
    // minimap
    if (sx > VW - 78 && sy < 58) { this.onMapClick?.(); return; }
    if (this.interior && (right)) return;
    if (right) { this.cast(this.p.spell); return; }
    const npc = this.localNpcs.find((n) => Math.hypot(n.tx * TS + 8 - wx, n.ty * TS - wy) < 14);
    if (npc) { this.talkTarget = npc; this.moveTarget = { x: npc.tx * TS + 8, y: npc.ty * TS + 8 }; this.targetEnemy = null; return; }
    const en = !this.interior && this.enemies.find((e) => e.alive && Math.hypot(e.x - wx, e.y - 8 - wy) < (e.boss ? 26 : 12));
    if (en) { this.targetEnemy = en; this.moveTarget = null; this.talkTarget = null; return; }
    this.targetEnemy = null; this.talkTarget = null;
    this.moveTarget = { x: wx, y: wy };
    this.burst(wx, wy, "#ffffff", 4, 20, 1);
  }
  onMapClick?: () => void;

  // ---------- update ----------
  moveBody(o: { x: number; y: number }, dx: number, dy: number, hw = 4, hh = 3) {
    const w = this.world;
    const blocked = (x: number, y: number) => solidAt(w, x - hw, y - hh) || solidAt(w, x + hw, y - hh) || solidAt(w, x - hw, y + hh) || solidAt(w, x + hw, y + hh);
    if (!blocked(o.x + dx, o.y)) o.x += dx;
    if (!blocked(o.x, o.y + dy)) o.y += dy;
  }

  update(dt: number) {
    if (!this.started || this.paused || this.dialog || this.openStation) { this.updateFx(dt * 0.0); return; }
    this.clock += dt;
    this.transition = Math.max(0, this.transition-dt);
    this.doorCooldown = Math.max(0, this.doorCooldown-dt);
    this.time = (this.time + dt / 480) % 1;
    const p = this.p;
    const w = this.world;

    if (p.dead > 0) {
      p.dead -= dt;
      if (p.dead <= 0) {
        const s = STATUES.find((x) => x.id === p.respawnStatue)!;
        p.x = s.tx * TS + 8; p.y = (s.ty + 2) * TS + 8; p.hp = Math.ceil(this.maxHp() / 2); p.mp = this.maxMp();
        p.gold = Math.floor(p.gold * 0.9);
        if (this.activeBoss?.boss) { const b = this.activeBoss; b.hp = b.maxhp; b.boss!.active = false; b.boss!.phase = 1; b.x = b.hx; b.y = b.hy; this.activeBoss = null; this.audio.boss = false; for (const e of this.enemies) if (e.summoned) e.alive = false; }
      }
      this.updateFx(dt); return;
    }

    // biome
    const b = biomeOf(w, p.x, p.y);
    if (b !== this.biome) { this.biome = b; this.biomeBanner = { name: BIOME_NAMES[b], t: 3 }; this.audio.biome = b; }
    if (this.biomeBanner.t > 0) this.biomeBanner.t -= dt;

    // movement
    let ix = 0, iy = 0;
    const k = this.keys;
    if (k.has("KeyA") || k.has("ArrowLeft")) ix--;
    if (k.has("KeyD") || k.has("ArrowRight")) ix++;
    if (k.has("KeyW") || k.has("ArrowUp")) iy--;
    if (k.has("KeyS") || k.has("ArrowDown")) iy++;
    if (ix || iy) { this.moveTarget = null; this.targetEnemy = null; this.talkTarget = null; }
    if (this.targetEnemy) {
      const e = this.targetEnemy;
      if (!e.alive) this.targetEnemy = null;
      else {
        const kind = this.weapon().weapon;
        const range = kind === "bow" || kind === "staff" ? 120 : kind === "spear" ? 32 : 20;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > range + (e.boss ? 16 : 0)) { ix = (e.x - p.x) / d; iy = (e.y - p.y) / d; }
        else this.attack({ x: e.x - p.x, y: e.y - 6 - (p.y - 8) });
      }
    } else if (this.moveTarget) {
      const dx = this.moveTarget.x - p.x, dy = this.moveTarget.y - p.y, d = Math.hypot(dx, dy);
      if (this.talkTarget && d < 20) { const n = this.talkTarget; this.talkTarget = null; this.moveTarget = null; this.talk(n); return; }
      if (d < 3) this.moveTarget = null; else { ix = dx / d; iy = dy / d; }
    }
    const il = Math.hypot(ix, iy);
    if (il > 0) { ix /= il; iy /= il; }
    const tile = tileAt(w, Math.floor(p.x / TS), Math.floor(p.y / TS));
    const onIce = tile === T.ICE;
    const speed = 78 + this.stats().dex * 0.6 * (tile === T.SAND || tile === T.DUNE ? 0.85 : 1);
    const accel = onIce ? 3 : 18;
    p.vx += (ix * speed - p.vx) * Math.min(1, accel * dt);
    p.vy += (iy * speed - p.vy) * Math.min(1, accel * dt);
    if (il > 0 && p.attackT <= 0) this.setDirFrom(ix, iy);
    const before = { x: p.x, y: p.y };
    this.moveBody(p, p.vx * dt, p.vy * dt);
    if (onIce && Math.abs(p.x - before.x) < 0.01 && Math.abs(p.y - before.y) < 0.01) { p.vx = p.vy = 0; }
    const moving = Math.hypot(p.vx, p.vy) > 10;
    p.frameT += dt * (moving ? 8 : 0);
    p.frame = Math.floor(p.frameT) % 4;
    p.atkCd -= dt; p.spellCd -= dt; p.inv -= dt;
    if (p.attackT > 0) p.attackT -= dt * 4;
    if (!this.interior && (this.keys.has("Space") || this.keys.has("KeyJ"))) this.attack();

    if(this.doorCooldown<=0){
      if(this.interior && Math.hypot(p.x-(ROOM.exitX*TS+8),p.y-(ROOM.exitY*TS+8))<12){this.leaveInterior();return;}
      if(!this.interior){const b=BUILDINGS.find(b=>{const d=doorOf(b);return Math.hypot(p.x-d.tx*TS-8,p.y-d.ty*TS-8)<11;});if(b){this.enterInterior(b);return;}}
    }

    // regen
    p.mp = Math.min(this.maxMp(), p.mp + dt * (0.6 + this.stats().wis * 0.12));
    p.hp = Math.min(this.maxHp(), p.hp + dt * (0.3 + this.stats().vit * 0.05));

    // statues
    for (const s of this.interior ? [] : STATUES) {
      if (Math.hypot(s.tx * TS + 8 - p.x, s.ty * TS + 12 - p.y) < 22) {
        if (!this.statues.has(s.id)) {
          this.statues.add(s.id); this.toast(`Estátua de Mana ativada: ${s.name}`, "#80f0ff"); this.audio.sfx("warp");
          this.burst(s.tx * TS + 8, s.ty * TS, "#80f0ff", 30, 70);
        }
        if (p.respawnStatue !== s.id) p.respawnStatue = s.id;
        if (p.hp < this.maxHp() || p.mp < this.maxMp()) { p.hp = Math.min(this.maxHp(), p.hp + dt * 40); p.mp = Math.min(this.maxMp(), p.mp + dt * 20); if (Math.random() < 0.2) this.burst(p.x, p.y - 8, "#80f0ff", 1, 20, 1, -40); }
      }
    }

    // nodes respawn
    for (const n of w.nodes) if (n.respawn > 0) n.respawn -= dt;

    if (!this.interior) { this.updateEnemies(dt); this.updateProjectiles(dt); }
    this.updateFx(dt);

    this.autosaveT += dt;
    if (this.autosaveT > 30) { this.autosaveT = 0; this.save(); }
    if (Math.floor(this.clock) % 90 === 0 && Math.floor(this.clock - dt) % 90 !== 0) this.raining = Math.random() < 0.4;
  }

  updateEnemies(dt: number) {
    const p = this.p;
    for (const e of this.enemies) {
      if (!e.alive) {
        if (e.respawn > 0) {
          e.respawn -= dt;
          if (e.respawn <= 0 && Math.hypot(e.hx - p.x, e.hy - p.y) > 260) { e.alive = true; e.hp = e.maxhp; e.x = e.hx; e.y = e.hy; }
          else if (e.respawn <= 0) e.respawn = 5;
        }
        continue;
      }
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
      if (d > 420 && !e.boss?.active) continue;
      e.t += dt;
      e.cd -= dt; e.hurt -= dt; e.slow -= dt;
      const spdMul = e.slow > 0 ? 0.4 : 1;
      // knockback
      if (Math.abs(e.kbx) + Math.abs(e.kby) > 1) { this.moveBody(e, e.kbx * dt, e.kby * dt); e.kbx *= 0.85; e.kby *= 0.85; }
      if (e.boss) { this.updateBoss(e, dt, d, dx, dy); continue; }
      const def = ENEMIES[e.kind];
      const night = this.darkness() > 0.3;
      const aggro = (def.ranged ? 110 : 90) * (night ? 1.3 : 1);
      const homeD = Math.hypot(e.hx - e.x, e.hy - e.y);
      let mx = 0, my = 0;
      if (d < aggro && homeD < 260 && p.dead <= 0) {
        if (def.ranged && d < 60) { mx = -dx / d; my = -dy / d; }
        else if (!def.ranged || d > 90) { mx = dx / d; my = dy / d; }
        if (def.ranged && e.cd <= 0 && d < 130) {
          e.cd = 2 + Math.random();
          const c = e.kind === "shade" ? "#d040ff" : "#e0ff60";
          this.projs.push({ x: e.x, y: e.y - 10, vx: (dx / d) * 110, vy: (dy / d) * 110, life: 1.6, dmg: e.atk, from: "e", kind: e.kind === "shade" ? "dark" : "spore", r: 3, color: c });
        }
        if (!def.ranged && d < 14 && e.cd <= 0) { e.cd = 1.1; this.hurtPlayer(e.atk, e.x, e.y); }
      } else {
        e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wanderT = 2 + Math.random() * 3; e.wx = e.hx + (Math.random() - 0.5) * 80; e.wy = e.hy + (Math.random() - 0.5) * 80; }
        const wx = e.wx - e.x, wy = e.wy - e.y, wd = Math.hypot(wx, wy);
        if (wd > 4) { mx = (wx / wd) * 0.5; my = (wy / wd) * 0.5; }
      }
      if (mx || my) { this.moveBody(e, mx * def.speed * spdMul * dt, my * def.speed * spdMul * dt); if (Math.abs(mx) > Math.abs(my)) e.dir = mx < 0 ? 1 : 2; }
    }
  }

  updateBoss(e: Enemy, dt: number, d: number, dx: number, dy: number) {
    const bs = e.boss!;
    const p = this.p;
    if (!bs.active) { if (d < 130 && p.dead <= 0) this.activateBoss(e); return; }
    if (d > 500) { bs.active = false; e.hp = e.maxhp; e.x = e.hx; e.y = e.hy; this.activeBoss = null; this.audio.boss = false; return; }
    if (bs.phase === 1 && e.hp < e.maxhp / 2) {
      bs.phase = 2; this.toast(`${bs.def.name} entra em fúria!`, "#ff4040"); this.shake = 10; this.audio.sfx("boss");
      this.burst(e.x, e.y - 20, "#ff4040", 40, 120, 3);
    }
    const ph2 = bs.phase === 2;
    if (bs.charge > 0) {
      bs.charge -= dt;
      this.moveBody(e, bs.cvx * dt, bs.cvy * dt, 10, 6);
      if (Math.random() < 0.5) this.parts.push({ x: e.x, y: e.y, vx: 0, vy: -10, life: 0.4, max: 0.4, color: bs.def.color, size: 3, grav: 0 });
      if (d < 26) this.hurtPlayer(e.atk * 1.3, e.x, e.y);
      return;
    }
    // chase
    if (d > 24) this.moveBody(e, (dx / d) * e.speed * (ph2 ? 1.4 : 1) * dt, (dy / d) * e.speed * (ph2 ? 1.4 : 1) * dt, 10, 6);
    if (Math.abs(dx) > 4) e.dir = dx < 0 ? 1 : 2;
    if (d < 28 && e.cd <= 0) { e.cd = 1; this.hurtPlayer(e.atk, e.x, e.y); }
    bs.patT -= dt;
    if (bs.patT > 0) return;
    bs.patT = ph2 ? 1.6 : 2.6;
    const pats = ph2 ? ["ring", "tele", "summon", "charge", "volley", "tele"] : ["ring", "tele", "volley", "charge"];
    const pat = pats[Math.floor(Math.random() * pats.length)];
    const c = bs.def.color;
    if (pat === "ring") {
      const n = ph2 ? 18 : 12, off = Math.random();
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + off; this.projs.push({ x: e.x, y: e.y - 14, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, life: 2.5, dmg: e.atk * 0.8, from: "e", kind: "boss", r: 4, color: c }); }
      this.audio.sfx("fire");
    } else if (pat === "volley") {
      const base = Math.atan2(dy, dx);
      for (let i = -2; i <= 2; i++) { const a = base + i * 0.18; this.projs.push({ x: e.x, y: e.y - 14, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 2, dmg: e.atk * 0.8, from: "e", kind: "boss", r: 4, color: c }); }
      this.audio.sfx("bow");
    } else if (pat === "tele") {
      const n = ph2 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const ox = i === 0 ? 0 : (Math.random() - 0.5) * 90, oy = i === 0 ? 0 : (Math.random() - 0.5) * 90;
        this.teles.push({ x: p.x + ox, y: p.y + oy, r: 22, t: 1.1, max: 1.1, dmg: e.atk * 1.4 });
      }
    } else if (pat === "summon") {
      for (let i = 0; i < 3; i++) {
        const m = this.makeEnemy(bs.def.minion, e.x + (Math.random() - 0.5) * 60, e.y + (Math.random() - 0.5) * 60, TIER[bs.def.biome]);
        m.summoned = true; m.hx = e.hx; m.hy = e.hy;
        if (!solidAt(this.world, m.x, m.y)) { this.enemies.push(m); this.burst(m.x, m.y - 6, c, 12, 60); }
      }
      this.toast(`${bs.def.name} invoca reforços!`, "#ffa060");
    } else if (pat === "charge") {
      this.teles.push({ x: p.x, y: p.y, r: 14, t: 0.6, max: 0.6, dmg: 0 });
      bs.charge = 0.7; bs.cvx = (dx / d) * 230; bs.cvy = (dy / d) * 230;
      this.audio.sfx("wind");
    }
    this.enemies = this.enemies.filter((x) => !(x.summoned && !x.alive));
  }

  updateProjectiles(dt: number) {
    const p = this.p;
    for (const pr of this.projs) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      if (pr.kind === "fire" || pr.kind === "boss" || pr.kind === "dark") if (Math.random() < 0.6) this.parts.push({ x: pr.x, y: pr.y, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life: 0.3, max: 0.3, color: pr.color, size: 2, grav: 0 });
      if (solidAt(this.world, pr.x, pr.y + 8) && pr.kind !== "boss") { this.explode(pr); pr.life = 0; continue; }
      if (pr.from === "p") {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (Math.hypot(e.x - pr.x, e.y - 8 - pr.y) < (e.boss ? 20 : 8) + pr.r) {
            if (pr.kind === "fire") this.explode(pr);
            else {
              this.damageEnemy(e, pr.dmg, pr.vx * 0.4, pr.vy * 0.4, pr.color);
              if (pr.slow) { e.slow = 2.5; this.burst(e.x, e.y - 8, "#c0f0ff", 6, 30); }
            }
            pr.life = 0; break;
          }
        }
      } else if (Math.hypot(p.x - pr.x, p.y - 8 - pr.y) < 6 + pr.r) {
        this.hurtPlayer(pr.dmg, pr.x - pr.vx, pr.y - pr.vy);
        pr.life = 0;
      }
    }
    this.projs = this.projs.filter((x) => x.life > 0);
    // telegraphs
    for (const t of this.teles) {
      t.t -= dt;
      if (t.t <= 0) {
        if (t.dmg > 0) {
          if (Math.hypot(p.x - t.x, p.y - t.y) < t.r) this.hurtPlayer(t.dmg, t.x, t.y);
          this.burst(t.x, t.y, "#ff8040", 20, 90, 2); this.audio.sfx("explode"); this.shake = Math.max(this.shake, 3);
        } else if (t.dmg < 0) {
          for (const e of this.enemies) if (e.alive && Math.hypot(e.x - t.x, e.y - 8 - t.y) < t.r + (e.boss ? 16 : 0)) this.damageEnemy(e, -t.dmg, 0, 0, "#fff4a0", e.kind === "shade" || e.boss?.def.id === "crystal_golem" ? 3 : 1);
          this.burst(t.x, t.y, "#fff4a0", 50, 140, 2, -20);
          this.shake = 5;
        }
      }
    }
    this.teles = this.teles.filter((t) => t.t > 0);
  }
  explode(pr: Proj) {
    if (pr.from !== "p") { this.burst(pr.x, pr.y, pr.color, 5, 40); return; }
    if (pr.kind === "fire") {
      this.audio.sfx("explode");
      this.burst(pr.x, pr.y, "#ff6a20", 24, 100, 2); this.burst(pr.x, pr.y, "#ffd040", 12, 60, 2);
      for (const e of this.enemies) if (e.alive && Math.hypot(e.x - pr.x, e.y - 8 - pr.y) < 30 + (e.boss ? 16 : 0)) this.damageEnemy(e, pr.dmg, 0, 0, "#ff8040");
      this.shake = 3;
    } else this.burst(pr.x, pr.y, pr.color, 5, 40);
  }
  updateFx(dt: number) {
    for (const q of this.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; q.vx *= 0.95; q.vy *= 0.95; q.life -= dt; }
    this.parts = this.parts.filter((q) => q.life > 0);
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    for (const t of this.texts) { t.y -= dt * 22; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    this.shake = Math.max(0, this.shake - dt * 20);
  }
  darkness() {
    if (this.interior) return 0.08;
    if (this.biome === "cave") return 0.72;
    return Math.max(0, Math.cos(this.time * Math.PI * 2)) * 0.68;
  }
  timeLabel() {
    const h = Math.floor(this.time * 24), m = Math.floor((this.time * 24 - h) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // ---------- render ----------
  render() {
    const c = this.ctx, p = this.p;
    this.cam.x = Math.max(0, Math.min(W * TS - VW, p.x - VW / 2));
    this.cam.y = Math.max(0, Math.min(H * TS - VH, p.y - VH / 2));
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0, sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const cx = Math.round(this.cam.x + sx), cy = Math.round(this.cam.y + sy);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#000"; c.fillRect(0, 0, VW, VH);
    c.translate(-cx, -cy);
    const x0 = Math.floor(cx / TS), y0 = Math.floor(cy / TS), x1 = x0 + Math.ceil(VW / TS) + 1, y1 = y0 + Math.ceil(VH / TS) + 1;
    const wt = this.clock;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(this.world, tx, ty);
      let v = Math.floor(hash(tx, ty, 1) * 4);
      if (t === T.WATER) v = (v + Math.floor(wt * 2)) % 4;
      c.drawImage(this.tiles[t][v], tx * TS, ty * TS);
    }
    drawGroundDetails(c,this.world,x0,y0,x1,y1,wt);
    if(this.interior) {
      drawInterior(c,this.interior,wt);
      drawTreasure(c,110*TS+8,106*TS+12,this.openedChests.has(`house-${this.interior.id}`),wt);
    } else {
      drawBuildings(c,wt);
      for(const t of TREASURES) if(t.tx>=x0-1&&t.tx<=x1&&t.ty>=y0-1&&t.ty<=y1)drawTreasure(c,t.tx*TS+8,t.ty*TS+12,this.openedChests.has(t.id),wt);
    }
    // nodes
    for (const n of this.world.nodes) {
      if (n.respawn > 0 || n.tx < x0 - 1 || n.tx > x1 || n.ty < y0 - 1 || n.ty > y1) continue;
      drawNode(c, n.item, n.tx * TS + 8, n.ty * TS + 14, wt);
    }
    // telegraphs
    for (const t of this.teles) {
      const k = 1 - t.t / t.max;
      if (t.dmg >= 0) {
        c.strokeStyle = "rgba(255,40,40,0.9)"; c.lineWidth = 1;
        c.beginPath(); c.ellipse(t.x, t.y, t.r, t.r * 0.6, 0, 0, Math.PI * 2); c.stroke();
        c.fillStyle = `rgba(255,60,30,${0.15 + k * 0.35})`;
        c.beginPath(); c.ellipse(t.x, t.y, t.r * k, t.r * 0.6 * k, 0, 0, Math.PI * 2); c.fill();
      } else {
        c.fillStyle = `rgba(255,250,180,${0.3 + k * 0.5})`;
        c.beginPath(); c.arc(t.x, t.y, t.r * (0.3 + k * 0.7), 0, Math.PI * 2); c.fill();
      }
    }
    // sprites sorted
    const draws: { y: number; f: () => void }[] = [];
    for (const s of STATUES) {
      const x = s.tx * TS + 8, y = s.ty * TS + 14;
      if (x < cx - 20 || x > cx + VW + 20 || y < cy - 30 || y > cy + VH + 30) continue;
      draws.push({ y, f: () => drawStatue(c, x, y, this.statues.has(s.id), wt) });
    }
    for (const n of this.localNpcs) {
      const x = n.tx * TS + 8, y = n.ty * TS + 14;
      if (x < cx - 20 || x > cx + VW + 20 || y < cy - 30 || y > cy + VH + 30) continue;
      const near = Math.hypot(x - p.x, y - p.y) < 30;
      const hasQ = this.availableQuest(n.id) || QUESTS.some((q) => q.giver === n.id && this.questReady(q));
      draws.push({ y, f: () => {
        drawChar(c, x, y, n.pal, near ? (p.x < x - 4 ? 1 : p.x > x + 4 ? 2 : 0) : 0, 0);
        if (hasQ) { const b = Math.round(Math.sin(wt * 5) * 2); c.fillStyle = "#ffd040"; c.fillRect(x - 1, y - 30 + b, 3, 6); c.fillRect(x - 1, y - 22 + b, 3, 2); }
      } });
    }
    for (const e of this.enemies) {
      if (this.interior || !e.alive || e.x < cx - 40 || e.x > cx + VW + 40 || e.y < cy - 40 || e.y > cy + VH + 50) continue;
      draws.push({ y: e.y, f: () => {
        if (e.boss) {
          const look = BOSS_LOOK[e.boss.def.id];
          if (e.boss.phase === 2) { c.fillStyle = `rgba(255,40,40,${0.2 + Math.sin(wt * 10) * 0.1})`; c.beginPath(); c.ellipse(e.x, e.y, 26, 10, 0, 0, Math.PI * 2); c.fill(); }
          drawEnemy(c, look.kind, e.x, e.y, e.t, e.dir, e.hurt > 0, look.scale, look.tint);
          c.fillStyle = "#ffd040"; const cyy = e.y - 18 * look.scale - 6; c.fillRect(e.x - 6, cyy, 12, 3); c.fillRect(e.x - 6, cyy - 3, 2, 3); c.fillRect(e.x - 1, cyy - 4, 2, 4); c.fillRect(e.x + 4, cyy - 3, 2, 3);
        } else {
          drawEnemy(c, e.kind, e.x, e.y, e.t, e.dir, e.hurt > 0);
          if (e.slow > 0) { c.fillStyle = "rgba(150,220,255,0.35)"; c.fillRect(e.x - 7, e.y - 16, 14, 16); }
          if (e.hp < e.maxhp) { c.fillStyle = "#200"; c.fillRect(e.x - 8, e.y - 24, 16, 2); c.fillStyle = "#f44"; c.fillRect(e.x - 8, e.y - 24, 16 * (e.hp / e.maxhp), 2); }
          if (this.targetEnemy === e) { c.strokeStyle = "#ffd040"; c.beginPath(); c.ellipse(e.x, e.y, 9, 4, 0, 0, Math.PI * 2); c.stroke(); }
        }
      } });
    }
    if (p.dead <= 0) draws.push({ y: p.y, f: () => {
      if (p.inv > 0 && Math.floor(p.inv * 20) % 2) return;
      const armor = ITEMS[p.equip.armor ?? "cloth"];
      const ring = p.equip.amulet ? ITEMS[p.equip.amulet].color : "#ddc58e";
      const w = this.weapon();
      drawChar(c, p.x, p.y, { skin: "#f4c8a0", hair: "#e8a030", body: armor.color, legs: "#3a3060", accent: ring }, p.dir, p.frame, { kind: w.weapon ?? "sword", color: w.color }, Math.max(0, p.attackT));
    } });
    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) d.f();
    // projectiles
    for (const pr of this.projs) {
      c.fillStyle = pr.color;
      if (pr.kind === "arrow") {
        const a = Math.atan2(pr.vy, pr.vx);
        c.save(); c.translate(pr.x, pr.y); c.rotate(a); c.fillRect(-6, -0.5, 10, 1); c.fillStyle = "#fff"; c.fillRect(3, -1, 2, 2); c.restore();
      } else {
        c.beginPath(); c.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#ffffff"; c.fillRect(pr.x - 1, pr.y - 1, 2, 2);
      }
    }
    for (const q of this.parts) { c.globalAlpha = Math.max(0, q.life / q.max); c.fillStyle = q.color; c.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size); }
    c.globalAlpha = 1;

    // lighting
    const dark = this.darkness();
    if (dark > 0.02) {
      const l = this.lctx;
      l.globalCompositeOperation = "source-over";
      l.clearRect(0, 0, VW, VH);
      l.fillStyle = this.biome === "cave" ? `rgba(8,4,20,${dark})` : `rgba(10,12,40,${dark})`;
      l.fillRect(0, 0, VW, VH);
      l.globalCompositeOperation = "destination-out";
      const hole = (x: number, y: number, r: number, a = 1) => {
        const g = l.createRadialGradient(x - cx, y - cy, 0, x - cx, y - cy, r);
        g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, "rgba(0,0,0,0)");
        l.fillStyle = g; l.fillRect(x - cx - r, y - cy - r, r * 2, r * 2);
      };
      hole(p.x, p.y - 8, 70 + Math.sin(wt * 6) * 2);
      const glows: { x: number; y: number; r: number; col: string }[] = [];
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const t = tileAt(this.world, tx, ty);
        if (t === T.CRYSTAL) { hole(tx * TS + 8, ty * TS + 8, 34, 0.8); glows.push({ x: tx * TS + 8, y: ty * TS + 8, r: 22, col: "rgba(180,100,255,0.35)" }); }
        if (t === T.WALL && hash(tx, ty, 1) < 0.25) { hole(tx * TS + 8, ty * TS + 8, 40, 0.9); glows.push({ x: tx * TS + 8, y: ty * TS + 8, r: 26, col: "rgba(255,180,80,0.3)" }); }
      }
      for (const n of this.world.nodes) if ((n.item === "mana_shard" || n.item === "crystal_ore") && n.respawn <= 0 && n.tx >= x0 && n.tx <= x1 && n.ty >= y0 && n.ty <= y1) hole(n.tx * TS + 8, n.ty * TS + 8, 26, 0.7);
      for (const s of STATUES) if (this.statues.has(s.id)) { hole(s.tx * TS + 8, s.ty * TS, 50); glows.push({ x: s.tx * TS + 8, y: s.ty * TS, r: 30, col: "rgba(100,230,255,0.3)" }); }
      for (const pr of this.projs) hole(pr.x, pr.y, 30, 0.9);
      for (const t of this.teles) hole(t.x, t.y, t.r + 10, 0.6);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(this.light, 0, 0);
      c.globalCompositeOperation = "lighter";
      for (const g of glows) {
        const gr = c.createRadialGradient(g.x - cx, g.y - cy, 0, g.x - cx, g.y - cy, g.r);
        gr.addColorStop(0, g.col); gr.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gr; c.fillRect(g.x - cx - g.r, g.y - cy - g.r, g.r * 2, g.r * 2);
      }
      c.globalCompositeOperation = "source-over";
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    // dusk tint
    const dusk = Math.max(0, 1 - Math.abs(this.time - 0.75) * 12) + Math.max(0, 1 - Math.abs(this.time - 0.25) * 12);
    if (dusk > 0 && this.biome !== "cave") { c.fillStyle = `rgba(255,120,40,${dusk * 0.15})`; c.fillRect(0, 0, VW, VH); }
    // weather
    if (!this.interior) this.renderWeather();
    // floating text
    c.translate(-cx, -cy);
    c.font = "8px 'Press Start 2P', monospace";
    c.textAlign = "center";
    for (const t of this.texts) {
      c.globalAlpha = Math.min(1, t.life * 2);
      c.fillStyle = "#000"; c.fillText(t.text, t.x + 1, t.y + 1);
      c.fillStyle = t.color; c.fillText(t.text, t.x, t.y);
    }
    c.globalAlpha = 1;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.interior) this.renderMinimap();
    this.renderInteractionPrompt(c);
    if(this.transition>0){c.fillStyle=`rgba(13,24,25,${Math.min(1,this.transition*1.5)})`;c.fillRect(0,0,VW,VH);}
    if (p.dead > 0) { c.fillStyle = `rgba(0,0,0,${Math.min(0.8, (2.5 - p.dead))})`; c.fillRect(0, 0, VW, VH); }
  }
  renderInteractionPrompt(c: CanvasRenderingContext2D) {
    const p=this.p, near=(x:number,y:number,r=30)=>Math.hypot(p.x-x*TS-8,p.y-y*TS-8)<r;
    let text='';
    if(this.interior){
      if(near(ROOM.exitX,ROOM.exitY,35))text='E · Sair';
      else if(near(110,106,30))text='E · Abrir baú';
      else if(near(114,100,42))text='E · Ler anotações';
      else if(near(127,105,35)&&this.interior.kind==='inn')text='E · Descansar';
      else if(near(109,97,38)&&this.interior.id==='archive')text='E · Examinar estante';
    }else{
      const b=BUILDINGS.find(b=>{const d=doorOf(b);return near(d.tx,d.ty);});
      if(b)text='E · '+b.name;
      else if(TREASURES.some(t=>near(t.tx,t.ty,26)))text='E · Abrir baú';
    }
    if(!text&&this.nearNpc(26))text='E · Conversar';
    if(!text)return;
    c.font='8px monospace';c.textAlign='center';const width=c.measureText(text).width+18;
    c.fillStyle='#152d2f';c.fillRect(VW/2-width/2,VH-46,width,16);c.strokeStyle='#bfa87b';c.strokeRect(VW/2-width/2,VH-46,width,16);c.fillStyle='#f1e5c7';c.fillText(text,VW/2,VH-35);
  }
  renderWeather() {
    const c = this.ctx, dt = 1 / 60;
    if (this.biome === "mountain") {
      c.fillStyle = "rgba(230,240,255,0.12)"; c.fillRect(0, 0, VW, VH);
      c.fillStyle = "#ffffff";
      for (const f of this.weather) {
        f.y += (20 + f.s * 30) * dt; f.x += Math.sin(this.clock + f.s * 10) * 0.3 - 0.2;
        if (f.y > VH) { f.y = -2; f.x = Math.random() * VW; } if (f.x < 0) f.x = VW;
        c.fillRect(f.x, f.y, f.s > 0.6 ? 2 : 1, f.s > 0.6 ? 2 : 1);
      }
    } else if (this.biome === "desert") {
      c.fillStyle = "rgba(255,200,120,0.08)"; c.fillRect(0, 0, VW, VH);
      c.fillStyle = "rgba(240,210,150,0.6)";
      for (const f of this.weather.slice(0, 40)) { f.x += (80 + f.s * 80) * dt; f.y += Math.sin(this.clock * 2 + f.s * 7) * 0.2; if (f.x > VW) { f.x = 0; f.y = Math.random() * VH; } c.fillRect(f.x, f.y, 3, 1); }
    } else if ((this.biome === "forest" || this.biome === "plains") && this.raining) {
      c.fillStyle = "rgba(20,30,60,0.15)"; c.fillRect(0, 0, VW, VH);
      c.fillStyle = "rgba(170,200,255,0.6)";
      for (const f of this.weather) { f.y += 300 * dt; f.x -= 60 * dt; if (f.y > VH) { f.y = -5; f.x = Math.random() * (VW + 60); } c.fillRect(f.x, f.y, 1, 5); }
    } else if (this.biome === "forest") {
      // fireflies
      for (const f of this.weather.slice(0, 25)) {
        const x = (f.x + Math.sin(this.clock * 0.7 + f.s * 20) * 20) % VW, y = (f.y + Math.cos(this.clock * 0.5 + f.s * 30) * 15) % VH;
        c.fillStyle = `rgba(200,255,140,${0.4 + Math.sin(this.clock * 3 + f.s * 50) * 0.4})`; c.fillRect(x, y, 1, 1);
      }
    } else if (this.biome === "cave") {
      for (const f of this.weather.slice(0, 30)) {
        f.y -= 6 * dt; if (f.y < 0) f.y = VH;
        c.fillStyle = `rgba(200,150,255,${0.3 + Math.sin(this.clock * 2 + f.s * 40) * 0.3})`; c.fillRect(f.x, f.y, 1, 1);
      }
    }
  }
  renderMinimap() {
    const c = this.ctx, p = this.p;
    const mw = 72, mh = 52, mx = VW - mw - 4, my = 4;
    c.fillStyle = "#1a1030"; c.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
    c.fillStyle = "#d0b060"; c.fillRect(mx - 1, my - 1, mw + 2, 1); c.fillRect(mx - 1, my + mh, mw + 2, 1); c.fillRect(mx - 1, my, 1, mh); c.fillRect(mx + mw, my, 1, mh);
    const ptx = p.x / TS, pty = p.y / TS;
    const sx = Math.max(0, Math.min(W - mw, ptx - mw / 2)), sy = Math.max(0, Math.min(H - mh, pty - mh / 2));
    c.drawImage(this.minimap, sx, sy, mw, mh, mx, my, mw, mh);
    for (const s of STATUES) { const x = s.tx - sx, y = s.ty - sy; if (x >= 0 && y >= 0 && x < mw && y < mh) { c.fillStyle = this.statues.has(s.id) ? "#60f0ff" : "#507080"; c.fillRect(mx + x - 1, my + y - 1, 3, 3); } }
    for (const e of this.enemies) if (e.boss && e.alive) { const x = e.hx / TS - sx, y = e.hy / TS - sy; if (x >= 0 && y >= 0 && x < mw && y < mh) { c.fillStyle = "#ff3030"; c.fillRect(mx + x - 1, my + y - 1, 3, 3); } }
    for (const n of NPCS) { const x = n.tx - sx, y = n.ty - sy; if (x >= 0 && y >= 0 && x < mw && y < mh) { c.fillStyle = "#ffd040"; c.fillRect(mx + x, my + y, 1, 1); } }
    c.fillStyle = Math.floor(this.clock * 4) % 2 ? "#ffffff" : "#ff4040";
    c.fillRect(mx + ptx - sx - 1, my + pty - sy - 1, 3, 3);
  }

  // ---------- save ----------
  save() {
    try {
      const data = {
        p: { ...this.p, ...(this.interior ? this.returnPosition : {}), dead: 0 }, inventory: this.inventory, questStatus: this.questStatus, questProg: this.questProg,
        discoveries: [...this.discoveries], openedChests: [...this.openedChests],
        statues: [...this.statues], bosses: [...this.bossesDone], time: this.time,
      };
      localStorage.setItem("mana-quest-save", JSON.stringify(data));
    } catch { /* ignore */ }
  }
  static hasSave() { try { return !!localStorage.getItem("mana-quest-save"); } catch { return false; } }
  load() {
    try {
      const raw = localStorage.getItem("mana-quest-save"); if (!raw) return;
      const d = JSON.parse(raw);
      Object.assign(this.p, d.p);
      this.discoveries = new Set(d.discoveries ?? []); this.openedChests = new Set(d.openedChests ?? []);
      this.inventory = d.inventory; this.questStatus = d.questStatus; this.questProg = d.questProg;
      this.statues = new Set(d.statues); this.bossesDone = new Set(d.bosses); this.time = d.time ?? 0.3;
      for (const e of this.enemies) if (e.boss && this.bossesDone.has(e.boss.def.id)) { e.alive = false; e.respawn = -1; }
    } catch { /* ignore */ }
  }
}
