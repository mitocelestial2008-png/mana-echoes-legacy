export type Slot = "weapon" | "armor" | "ring" | "amulet";
export type WeaponKind = "sword" | "spear" | "bow" | "staff";
export type ItemType = Slot | "potion" | "material";

export interface Stats { str: number; dex: number; vit: number; int: number; wis: number }

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  desc: string;
  color: string;
  atk?: number;
  def?: number;
  weapon?: WeaponKind;
  bonus?: Partial<Stats> & { hp?: number; mp?: number };
  heal?: number;
  mana?: number;
  price: number;
}

const I = (d: ItemDef) => d;
export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  [
    I({ id: "wood_sword", name: "Espada de Madeira", type: "weapon", weapon: "sword", atk: 3, desc: "Uma espada de treino.", color: "#b08850", price: 10 }),
    I({ id: "mana_sword", name: "Espada de Mana", type: "weapon", weapon: "sword", atk: 16, bonus: { int: 3 }, desc: "Lâmina que pulsa com mana.", color: "#7ef0ff", price: 400 }),
    I({ id: "iron_spear", name: "Lança de Ferro", type: "weapon", weapon: "spear", atk: 9, desc: "Longo alcance, golpe perfurante.", color: "#c0c8d0", price: 120 }),
    I({ id: "crystal_spear", name: "Lança de Cristal", type: "weapon", weapon: "spear", atk: 20, desc: "Cristal de mana afiadíssimo.", color: "#c78bff", price: 600 }),
    I({ id: "short_bow", name: "Arco Curto", type: "weapon", weapon: "bow", atk: 5, desc: "Dispara flechas (DES).", color: "#a0703a", price: 60 }),
    I({ id: "elven_bow", name: "Arco Élfico", type: "weapon", weapon: "bow", atk: 15, bonus: { dex: 3 }, desc: "Feito com madeira ancestral.", color: "#6fe08a", price: 450 }),
    I({ id: "oak_staff", name: "Cajado de Carvalho", type: "weapon", weapon: "staff", atk: 4, desc: "Dispara orbes mágicos (INT).", color: "#8a6a3a", price: 50 }),
    I({ id: "elemental_staff", name: "Cajado Elemental", type: "weapon", weapon: "staff", atk: 17, bonus: { int: 4, mp: 20 }, desc: "Canaliza os 5 espíritos.", color: "#ff7ae0", price: 650 }),
    I({ id: "cloth", name: "Túnica de Pano", type: "armor", def: 1, desc: "Roupa simples de aldeão.", color: "#4a7bd0", price: 10 }),
    I({ id: "leather", name: "Armadura de Couro", type: "armor", def: 4, desc: "Leve e resistente.", color: "#8a5a30", price: 80 }),
    I({ id: "iron_armor", name: "Armadura de Ferro", type: "armor", def: 9, desc: "Forjada por Brunhild.", color: "#9aa4b0", price: 250 }),
    I({ id: "frost_mail", name: "Cota Glacial", type: "armor", def: 15, bonus: { vit: 3 }, desc: "Fria ao toque, quente por dentro.", color: "#a8e0ff", price: 500 }),
    I({ id: "crystal_plate", name: "Placa de Cristal", type: "armor", def: 22, bonus: { vit: 5, wis: 3 }, desc: "Brilha suavemente no escuro.", color: "#d49cff", price: 900 }),
    I({ id: "copper_ring", name: "Anel de Cobre", type: "ring", bonus: { str: 2 }, desc: "+2 Força", color: "#d08040", price: 60 }),
    I({ id: "mana_ring", name: "Anel de Mana", type: "ring", bonus: { int: 4, mp: 20 }, desc: "+4 Int, +20 MP", color: "#60c0ff", price: 300 }),
    I({ id: "wolf_ring", name: "Anel do Lobo", type: "ring", bonus: { dex: 4, str: 2 }, desc: "+4 Des, +2 For", color: "#e0e0f0", price: 280 }),
    I({ id: "herb_amulet", name: "Amuleto de Ervas", type: "amulet", bonus: { wis: 3, hp: 20 }, desc: "+3 Sab, +20 HP", color: "#60d060", price: 120 }),
    I({ id: "sun_amulet", name: "Amuleto Solar", type: "amulet", bonus: { vit: 5, str: 3, hp: 50 }, desc: "Relíquia do deserto.", color: "#ffd040", price: 700 }),
    I({ id: "potion", name: "Poção", type: "potion", heal: 40, desc: "Recupera 40 HP.", color: "#ff5060", price: 15 }),
    I({ id: "hi_potion", name: "Poção Maior", type: "potion", heal: 120, desc: "Recupera 120 HP.", color: "#ff2090", price: 50 }),
    I({ id: "ether", name: "Éter", type: "potion", mana: 30, desc: "Recupera 30 MP.", color: "#4090ff", price: 30 }),
    I({ id: "elixir", name: "Elixir", type: "potion", heal: 9999, mana: 9999, desc: "Restaura tudo.", color: "#ffe060", price: 200 }),
    I({ id: "herb", name: "Erva Medicinal", type: "material", desc: "Usada em poções.", color: "#50c050", price: 3 }),
    I({ id: "frost_herb", name: "Erva Gélida", type: "material", desc: "Cresce na neve.", color: "#a0f0ff", price: 8 }),
    I({ id: "desert_rose", name: "Rosa do Deserto", type: "material", desc: "Flor rara do oásis.", color: "#ff80a0", price: 8 }),
    I({ id: "wood", name: "Madeira Ancestral", type: "material", desc: "Madeira dos espíritos.", color: "#9a6a3a", price: 4 }),
    I({ id: "iron_ore", name: "Minério de Ferro", type: "material", desc: "Para forjar.", color: "#9090a0", price: 6 }),
    I({ id: "crystal_ore", name: "Cristal de Mana", type: "material", desc: "Cristal cheio de energia.", color: "#c080ff", price: 15 }),
    I({ id: "mana_shard", name: "Fragmento de Mana", type: "material", desc: "Essência pura de mana.", color: "#60f0ff", price: 12 }),
    I({ id: "goo", name: "Esporo", type: "material", desc: "Restos de cogumelo.", color: "#e0a060", price: 2 }),
    I({ id: "wolf_pelt", name: "Pele de Lobo", type: "material", desc: "Grossa e quente.", color: "#e8e8f0", price: 10 }),
    I({ id: "chitin", name: "Quitina de Escorpião", type: "material", desc: "Casca dura.", color: "#5a3a6a", price: 10 }),
  ].map((d) => [d.id, d]),
);

export interface Recipe { out: string; qty: number; station: "smith" | "alchemist"; cost: Record<string, number>; gold: number }
export const RECIPES: Recipe[] = [
  { out: "potion", qty: 2, station: "alchemist", cost: { herb: 2 }, gold: 0 },
  { out: "hi_potion", qty: 1, station: "alchemist", cost: { herb: 2, desert_rose: 1 }, gold: 10 },
  { out: "ether", qty: 1, station: "alchemist", cost: { mana_shard: 1, herb: 1 }, gold: 0 },
  { out: "elixir", qty: 1, station: "alchemist", cost: { frost_herb: 2, desert_rose: 2, mana_shard: 2 }, gold: 50 },
  { out: "herb_amulet", qty: 1, station: "alchemist", cost: { herb: 5, goo: 3 }, gold: 30 },
  { out: "mana_ring", qty: 1, station: "alchemist", cost: { mana_shard: 4, crystal_ore: 1 }, gold: 80 },
  { out: "iron_spear", qty: 1, station: "smith", cost: { iron_ore: 4, wood: 2 }, gold: 30 },
  { out: "short_bow", qty: 1, station: "smith", cost: { wood: 4 }, gold: 10 },
  { out: "oak_staff", qty: 1, station: "smith", cost: { wood: 3, mana_shard: 1 }, gold: 10 },
  { out: "leather", qty: 1, station: "smith", cost: { goo: 3, wolf_pelt: 1 }, gold: 20 },
  { out: "iron_armor", qty: 1, station: "smith", cost: { iron_ore: 6, chitin: 2 }, gold: 80 },
  { out: "wolf_ring", qty: 1, station: "smith", cost: { wolf_pelt: 4, iron_ore: 2 }, gold: 60 },
  { out: "frost_mail", qty: 1, station: "smith", cost: { iron_ore: 6, wolf_pelt: 4, frost_herb: 3 }, gold: 150 },
  { out: "elven_bow", qty: 1, station: "smith", cost: { wood: 8, mana_shard: 3 }, gold: 120 },
  { out: "mana_sword", qty: 1, station: "smith", cost: { iron_ore: 5, mana_shard: 5, crystal_ore: 2 }, gold: 200 },
  { out: "crystal_spear", qty: 1, station: "smith", cost: { crystal_ore: 6, wood: 3 }, gold: 250 },
  { out: "elemental_staff", qty: 1, station: "smith", cost: { crystal_ore: 4, mana_shard: 6, wood: 4 }, gold: 250 },
  { out: "crystal_plate", qty: 1, station: "smith", cost: { crystal_ore: 8, iron_ore: 6, chitin: 3 }, gold: 400 },
];

export const SHOP = ["potion", "hi_potion", "ether", "leather", "short_bow", "oak_staff", "copper_ring"];

export type SpiritId = "salamando" | "undine" | "sylph" | "lumina" | "dryad";
export interface SpiritDef { id: SpiritId; name: string; elem: string; spell: string; mp: number; cd: number; color: string; desc: string }
export const SPIRITS: SpiritDef[] = [
  { id: "salamando", name: "Salamando", elem: "Fogo", spell: "Bola de Fogo", mp: 8, cd: 0.6, color: "#ff6a20", desc: "Projétil que explode em área." },
  { id: "undine", name: "Undine", elem: "Água/Gelo", spell: "Estilhaços de Gelo", mp: 10, cd: 0.8, color: "#60c8ff", desc: "3 estilhaços que congelam." },
  { id: "sylph", name: "Sylph", elem: "Vento", spell: "Tufão", mp: 12, cd: 1.2, color: "#b0ffb0", desc: "Repele e fere todos ao redor." },
  { id: "lumina", name: "Lumina", elem: "Luz", spell: "Explosão Sagrada", mp: 18, cd: 2, color: "#fff4a0", desc: "Grande dano, triplo contra sombras." },
  { id: "dryad", name: "Dryad", elem: "Cura", spell: "Bênção da Floresta", mp: 14, cd: 1.5, color: "#70ff90", desc: "Restaura HP com base em SAB." },
];

export type EnemyKind = "mushroom" | "goblin" | "sporeling" | "scorpion" | "golem" | "wolf" | "shade";
export interface EnemyDef { kind: EnemyKind; name: string; hp: number; atk: number; def: number; speed: number; xp: number; gold: number; ranged?: boolean; drops: [string, number][]; size: number }
export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  mushroom: { kind: "mushroom", name: "Cogumelo", hp: 22, atk: 5, def: 0, speed: 22, xp: 8, gold: 3, drops: [["goo", 0.6], ["herb", 0.2], ["potion", 0.08]], size: 7 },
  goblin: { kind: "goblin", name: "Goblin", hp: 40, atk: 8, def: 1, speed: 38, xp: 15, gold: 6, drops: [["iron_ore", 0.25], ["potion", 0.12], ["copper_ring", 0.02]], size: 7 },
  sporeling: { kind: "sporeling", name: "Esporito", hp: 45, atk: 10, def: 2, speed: 20, xp: 22, gold: 7, ranged: true, drops: [["goo", 0.5], ["wood", 0.4], ["herb", 0.3]], size: 7 },
  scorpion: { kind: "scorpion", name: "Escorpião Sombrio", hp: 80, atk: 15, def: 4, speed: 48, xp: 34, gold: 12, drops: [["chitin", 0.6], ["desert_rose", 0.15], ["hi_potion", 0.08]], size: 8 },
  golem: { kind: "golem", name: "Golem de Pedra", hp: 170, atk: 22, def: 8, speed: 16, xp: 60, gold: 22, drops: [["iron_ore", 0.7], ["crystal_ore", 0.3], ["mana_shard", 0.3]], size: 10 },
  wolf: { kind: "wolf", name: "Lobo da Neve", hp: 110, atk: 19, def: 5, speed: 60, xp: 48, gold: 16, drops: [["wolf_pelt", 0.6], ["frost_herb", 0.2], ["hi_potion", 0.1]], size: 8 },
  shade: { kind: "shade", name: "Espírito Sombrio", hp: 120, atk: 24, def: 4, speed: 34, xp: 65, gold: 25, ranged: true, drops: [["mana_shard", 0.6], ["ether", 0.2], ["crystal_ore", 0.2]], size: 8 },
};

export type Biome = "plains" | "forest" | "desert" | "cave" | "mountain";
export const BIOME_NAMES: Record<Biome, string> = {
  plains: "Planícies de Potos",
  forest: "Floresta Ancestral dos Espíritos",
  desert: "Deserto das Areias Místicas",
  cave: "Cavernas de Cristais de Mana",
  mountain: "Picos da Montanha Sagrada",
};
export const BIOME_ENEMIES: Record<Biome, EnemyKind[]> = {
  plains: ["mushroom", "mushroom", "goblin"],
  forest: ["goblin", "sporeling", "sporeling"],
  desert: ["scorpion", "scorpion", "golem"],
  cave: ["golem", "shade", "shade"],
  mountain: ["wolf", "wolf", "golem"],
};

export interface BossDef { id: string; name: string; biome: Biome; tx: number; ty: number; hp: number; atk: number; xp: number; gold: number; color: string; minion: EnemyKind; reward: string[]; spirit?: SpiritId }
export const BOSSES: BossDef[] = [
  { id: "king_mush", name: "Rei Cogumelo Fungor", biome: "plains", tx: 150, ty: 142, hp: 400, atk: 12, xp: 150, gold: 80, color: "#e04040", minion: "mushroom", reward: ["leather", "hi_potion"] },
  { id: "ent", name: "Ent Ancestral Morvak", biome: "forest", tx: 22, ty: 98, hp: 900, atk: 20, xp: 400, gold: 200, color: "#4a8a3a", minion: "sporeling", reward: ["elven_bow"], spirit: "sylph" },
  { id: "sahr", name: "Sahr, Escorpião-Rei", biome: "desert", tx: 216, ty: 142, hp: 1500, atk: 28, xp: 800, gold: 350, color: "#8a4aa0", minion: "scorpion", reward: ["sun_amulet"] },
  { id: "fenrir", name: "Fenrir Glacial", biome: "mountain", tx: 112, ty: 14, hp: 2200, atk: 34, xp: 1300, gold: 500, color: "#c0e8ff", minion: "wolf", reward: ["frost_mail"], spirit: "undine" },
  { id: "crystal_golem", name: "Colosso de Cristal", biome: "cave", tx: 218, ty: 22, hp: 3200, atk: 42, xp: 2200, gold: 900, color: "#c080ff", minion: "shade", reward: ["crystal_plate", "elixir"], spirit: "lumina" },
];

export interface Statue { id: string; name: string; tx: number; ty: number }
export const STATUES: Statue[] = [
  { id: "village", name: "Vila de Potos", tx: 124, ty: 126 },
  { id: "forest", name: "Clareira dos Espíritos", tx: 46, ty: 108 },
  { id: "desert", name: "Oásis de Kalim", tx: 196, ty: 122 },
  { id: "mountain", name: "Santuário Nevado", tx: 118, ty: 36 },
  { id: "cave", name: "Entrada das Cavernas", tx: 184, ty: 58 },
];

export type QuestGoal =
  | { kind: "kill"; target: EnemyKind; n: number }
  | { kind: "boss"; target: string }
  | { kind: "collect"; item: string; n: number };
export interface QuestDef { id: string; title: string; main: boolean; giver: string; desc: string; goal: QuestGoal; requires?: string; reward: { xp: number; gold: number; items?: string[] } }
export const QUESTS: QuestDef[] = [
  { id: "m1", title: "O Despertar da Mana", main: true, giver: "elder", desc: "Cogumelos infestaram as planícies. Derrote 5 Cogumelos.", goal: { kind: "kill", target: "mushroom", n: 5 }, reward: { xp: 40, gold: 30, items: ["potion", "potion"] } },
  { id: "m2", title: "A Coroa de Esporos", main: true, giver: "elder", requires: "m1", desc: "Derrote o Rei Cogumelo Fungor a sudeste da vila.", goal: { kind: "boss", target: "king_mush" }, reward: { xp: 100, gold: 80 } },
  { id: "m3", title: "Raízes Corrompidas", main: true, giver: "elder", requires: "m2", desc: "Vá à Floresta Ancestral (oeste) e purifique o Ent Morvak.", goal: { kind: "boss", target: "ent" }, reward: { xp: 250, gold: 150 } },
  { id: "m4", title: "O Ferrão das Areias", main: true, giver: "elder", requires: "m3", desc: "No deserto do leste, derrote Sahr, o Escorpião-Rei.", goal: { kind: "boss", target: "sahr" }, reward: { xp: 500, gold: 250 } },
  { id: "m5", title: "O Uivo Gelado", main: true, giver: "elder", requires: "m4", desc: "Suba os Picos Sagrados ao norte e enfrente Fenrir.", goal: { kind: "boss", target: "fenrir" }, reward: { xp: 800, gold: 400 } },
  { id: "m6", title: "O Coração de Mana", main: true, giver: "elder", requires: "m5", desc: "Nas Cavernas de Cristal (nordeste), detenha o Colosso.", goal: { kind: "boss", target: "crystal_golem" }, reward: { xp: 2000, gold: 1000, items: ["elixir"] } },
  { id: "s1", title: "Ervas para Lira", main: false, giver: "alchemist", desc: "Traga 5 Ervas Medicinais para a alquimista.", goal: { kind: "collect", item: "herb", n: 5 }, reward: { xp: 30, gold: 20, items: ["ether", "ether"] } },
  { id: "s2", title: "Ferro para a Forja", main: false, giver: "smith", desc: "Traga 6 Minérios de Ferro para Brunhild.", goal: { kind: "collect", item: "iron_ore", n: 6 }, reward: { xp: 60, gold: 40, items: ["iron_spear"] } },
  { id: "s3", title: "Patrulha Goblin", main: false, giver: "guard", desc: "Elimine 8 Goblins perto da vila e da floresta.", goal: { kind: "kill", target: "goblin", n: 8 }, reward: { xp: 90, gold: 60, items: ["copper_ring"] } },
  { id: "s4", title: "Esporos Malignos", main: false, giver: "ranger", desc: "Derrote 6 Esporitos na floresta.", goal: { kind: "kill", target: "sporeling", n: 6 }, reward: { xp: 140, gold: 70, items: ["hi_potion"] } },
  { id: "s5", title: "Carapaças do Deserto", main: false, giver: "nomad", desc: "Traga 5 Quitinas de Escorpião.", goal: { kind: "collect", item: "chitin", n: 5 }, reward: { xp: 260, gold: 150, items: ["hi_potion", "hi_potion"] } },
  { id: "s6", title: "Peles para o Inverno", main: false, giver: "hermit", desc: "Traga 5 Peles de Lobo ao eremita.", goal: { kind: "collect", item: "wolf_pelt", n: 5 }, reward: { xp: 400, gold: 200, items: ["wolf_ring"] } },
  { id: "s7", title: "Sombras na Escuridão", main: false, giver: "hermit", requires: "s6", desc: "Destrua 6 Espíritos Sombrios nas cavernas.", goal: { kind: "kill", target: "shade", n: 6 }, reward: { xp: 700, gold: 300, items: ["elixir"] } },
];

export interface Palette { skin: string; hair: string; body: string; legs: string; accent?: string }
export interface NpcDef { id: string; name: string; title: string; tx: number; ty: number; pal: Palette; lines: string[]; role?: "smith" | "alchemist" | "shop" }
export const NPCS: NpcDef[] = [
  { id: "elder", name: "Ancião Gorm", title: "Guardião da Árvore de Mana", tx: 120, ty: 118, pal: { skin: "#f0c8a0", hair: "#e8e8e8", body: "#6a3a9a", legs: "#3a2050" }, lines: ["A Árvore de Mana enfraquece, jovem.", "Os Espíritos de Mana atenderão a quem provar seu valor.", "Use as estátuas de Mana para viajar rapidamente."] },
  { id: "smith", name: "Brunhild", title: "Ferreira da Vila", tx: 113, ty: 124, pal: { skin: "#e0a880", hair: "#c04020", body: "#5a4030", legs: "#302018" }, lines: ["Minério e suor, é disso que se faz uma lâmina!", "Traga materiais e eu forjo o que quiser."], role: "smith" },
  { id: "alchemist", name: "Lira", title: "Alquimista", tx: 129, ty: 124, pal: { skin: "#f8d8b8", hair: "#40a060", body: "#2a7a8a", legs: "#1a4050" }, lines: ["Ervas, fragmentos de mana... tudo vira poção!", "Cuidado com as cavernas, a escuridão lá é viva."], role: "alchemist" },
  { id: "merchant", name: "Pip", title: "Mercador", tx: 126, ty: 130, pal: { skin: "#f0c090", hair: "#603010", body: "#d0a020", legs: "#604010" }, lines: ["Os melhores preços de Potos!", "Compro qualquer coisa, também."], role: "shop" },
  { id: "guard", name: "Capitão Tor", title: "Guarda de Potos", tx: 120, ty: 133, pal: { skin: "#d8a070", hair: "#202020", body: "#8090a0", legs: "#404850" }, lines: ["Os goblins estão cada vez mais ousados.", "Siga as estradas, elas levam a todas as regiões."] },
  { id: "ranger", name: "Sylvara", title: "Guardiã da Floresta", tx: 48, ty: 111, pal: { skin: "#e8c8a0", hair: "#f0e080", body: "#2a6a2a", legs: "#1a3a1a" }, lines: ["A floresta sussurra... e está com medo.", "O Ent Morvak fica a oeste, além das raízes."] },
  { id: "nomad", name: "Kassim", title: "Nômade do Oásis", tx: 199, ty: 124, pal: { skin: "#a87048", hair: "#f0f0f0", body: "#d0b080", legs: "#806040" }, lines: ["As areias escondem ruínas de um antigo império.", "Sahr reina ao sul do oásis."], role: "shop" },
  { id: "hermit", name: "Eremita Yorn", title: "Monge da Montanha", tx: 121, ty: 38, pal: { skin: "#f0d0b0", hair: "#b0b0b0", body: "#a03030", legs: "#602020" }, lines: ["O gelo é escorregadio. Ande com cuidado.", "Ao leste, as cavernas de cristal brilham na escuridão."] },
];
