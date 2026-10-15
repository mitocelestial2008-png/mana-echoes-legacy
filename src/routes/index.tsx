import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Compass, Backpack, ScrollText, Map, UserRound, Volume2, VolumeX, X, Sparkles, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUILDINGS, TREASURES } from "@/game/exploration";
import { W, H } from "@/game/world";
import { Game, VW, VH } from "@/game/engine";
import { ITEMS, QUESTS, SPIRITS, STATUES, SHOP, type Slot, type Stats } from "@/game/data";
import { drawChar, drawItemIcon } from "@/game/gfx";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mana Quest — RPG 16-bit" },
      { name: "description", content: "Explore Mana Quest: um mundo 16-bit com casas acessíveis, santuários secretos, tesouros, chefes e espíritos de mana." },
      { property: "og:title", content: "Mana Quest — RPG 16-bit" },
      { property: "og:description", content: "Explore 5 biomas, derrote chefes e domine os Espíritos de Mana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Panel = null | "inv" | "char" | "quest" | "map" | "secrets";

function Icon({ id, size = 32 }: { id: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext("2d"); if (!c) return;
    c.clearRect(0, 0, 32, 32); c.imageSmoothingEnabled = false;
    const it = ITEMS[id]; if (it) drawItemIcon(c, id, it.color, it.type, 0, 0, 2);
  }, [id]);
  return <canvas ref={ref} width={32} height={32} style={{ width: size, height: size, imageRendering: "pixelated" }} />;
}
function Portrait({ pal }: { pal: Parameters<typeof drawChar>[3] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext("2d"); if (!c) return;
    c.imageSmoothingEnabled = false; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 64, 64);
    c.setTransform(4, 0, 0, 4, 0, 0); drawChar(c, 8, 20, pal, 0, 0);
  }, [pal]);
  return <canvas ref={ref} width={64} height={64} className="game-frame bg-secondary" style={{ width: 80, height: 80, imageRendering: "pixelated" }} />;
}
function Bar({ v, max, cls, label }: { v: number; max: number; cls: string; label: string }) {
  return (
    <div className="status-bar">
      <div className="flex justify-between text-[9px]"><span>{label}</span><span>{Math.ceil(v)}/{max}</span></div>
      <div className="h-2 bg-background/80 border border-border"><div className={`h-full ${cls}`} style={{ width: `${Math.max(0, (v / max) * 100)}%` }} /></div>
    </div>
  );
}

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [, setTick] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [title, setTitle] = useState(true);
  const [hasSave, setHasSave] = useState(false);
  const [mapUrl, setMapUrl] = useState("");
  const panelRef = useRef<Panel>(null);
  panelRef.current = panel;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = new Game(cv);
    gameRef.current = g;
    setHasSave(Game.hasSave());
    setMapUrl(g.mapDataUrl());
    g.onMapClick = () => setPanel("map");
    let raf = 0, last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      g.paused = panelRef.current !== null;
      g.update(dt); g.render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const iv = setInterval(() => setTick((x) => x + 1), 120);
    const down = (e: KeyboardEvent) => {
      if (!g.started) return;
      g.audio.init();
      const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
      if (e.code === "Escape") { setPanel(null); g.dialog = null; g.openStation = null; return; }
      if (e.code === "KeyI") return toggle("inv");
      if (e.code === "KeyC") return toggle("char");
      if (e.code === "KeyQ" || e.code === "KeyL") return toggle("quest");
      if (e.code === "KeyM") return toggle("map");
      if (g.dialog || g.openStation || panelRef.current) return;
      if (e.code.startsWith("Digit")) { const i = Number(e.code.slice(5)) - 1; const s = SPIRITS[i]; if (s) g.cast(s.id); }
      if (e.code === "KeyE" || e.code === "Enter") g.interact();
      if (e.code === "KeyR" || e.code === "KeyK") g.cast(g.p.spell);
      if (e.code === "KeyH") g.quickPotion();
      if (e.code === "KeyG") g.quickPotion(true);
      if (e.code === "KeyN") g.audio.toggleMute();
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      g.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => g.keys.delete(e.code);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { cancelAnimationFrame(raf); clearInterval(iv); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); g.audio.destroy(); };
  }, []);

  const g = gameRef.current;
  const start = (load: boolean) => {
    if (!g) return;
    if (load) g.load();
    g.started = true; g.audio.init(); setTitle(false);
    if (!load) g.toast("Fale com o Ancião Gorm (!) no centro da vila.", "#ffd040");
  };
  const onMouse = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!g || !g.started) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    g.click(((e.clientX - r.left) / r.width) * VW, ((e.clientY - r.top) / r.height) * VH, e.button === 2);
  };

  const p = g?.p;
  const stats = g?.stats();

  return (
    <main className="game-shell min-h-screen bg-background text-foreground font-pixel select-none">
      <div className="game-layout">
        <header className="game-header">
          <div className="game-brand"><Sparkles size={21}/><span>MANA<span className="text-accent">QUEST</span></span><span className="edition-label">CRÔNICAS DOS ESPÍRITOS</span></div>
          <div className="flex items-center gap-2"><span className="world-status"/><span className="font-body text-lg text-muted-foreground">Mundo de Potos</span></div>
        </header>
        <div className="game-location"><span className="flex items-center gap-2"><Compass size={15} className="text-primary"/>{title ? 'Vila de Potos' : g?.areaName}</span><span className="font-body text-lg text-muted-foreground">{title ? 'Uma nova jornada espera por você' : `${g?.timeLabel()} · ${g?.interior ? 'Interior' : 'Mundo aberto'}`}</span></div>
      <div className="relative w-full aspect-video game-viewport overflow-hidden">
        <canvas ref={canvasRef} width={VW} height={VH} onMouseDown={onMouse} onContextMenu={(e) => e.preventDefault()} className="w-full h-full block" style={{ imageRendering: "pixelated" }} />

        {g && p && stats && !title && (
          <>
            {/* HUD */}
            <div className="absolute top-2 left-2 game-panel p-2 space-y-1 text-[10px]">
              <div className="flex gap-3 text-primary"><span>Nv {p.level}</span><span>💰 {p.gold}</span><span>{g.timeLabel()}</span>{p.points > 0 && <span className="text-accent animate-pulse">+{p.points} pts</span>}</div>
              <Bar v={p.hp} max={g.maxHp()} cls="bg-destructive" label="HP" />
              <Bar v={p.mp} max={g.maxMp()} cls="bg-[var(--mana)]" label="MP" />
              <Bar v={p.xp} max={g.xpNeed()} cls="bg-primary" label="XP" />
            </div>
            <div className="quest-tracker absolute top-[24%] right-2 game-panel p-2 w-48 text-[9px] space-y-1">
              <div className="text-primary">MISSÕES (Q)</div>
              {QUESTS.filter((q) => g.questStatus[q.id] === "active").slice(0, 4).map((q) => (
                <div key={q.id}><span className={q.main ? "text-primary" : "text-accent"}>{q.main ? "★" : "!"} {q.title}</span><div className="opacity-80">{g.questReady(q) ? "✔ Retorne ao NPC" : g.questProgressText(q)}</div></div>
              ))}
              {!QUESTS.some((q) => g.questStatus[q.id] === "active") && <div className="opacity-70">Procure NPCs com "!"</div>}
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {SPIRITS.map((s, i) => {
                const has = p.spirits.includes(s.id);
                return (
                  <Button variant="game" key={s.id} onClick={() => has && g.cast(s.id)} title={`${s.name}: ${s.spell} (${s.mp} MP) — ${s.desc}`}
                    className={`game-panel w-14 h-14 text-[8px] flex flex-col items-center justify-center ${p.spell === s.id ? "ring-2 ring-primary" : ""} ${has ? "" : "opacity-30"}`}>
                    <span className="w-4 h-4 rounded-full" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                    <span>{i + 1}</span><span className="truncate w-full text-center">{has ? s.name : "???"}</span>
                  </Button>
                );
              })}
              <div className="game-panel h-14 px-2 text-[8px] flex flex-col justify-center gap-1">
                <span>H: Poção ×{g.count("potion") + g.count("hi_potion")}</span><span>G: Éter ×{g.count("ether")}</span>
              </div>
            </div>
            <div className="hidden">WASD/clique mover · Espaço/clique atacar<br />1-5/R/botão dir. magia · E interagir<br />I inv · C atributos · Q missões · M mapa · N som</div>
            <div className="game-toasts absolute top-32 left-2 space-y-1">
              {g.toasts.map((t, i) => <div key={i} className="game-panel px-2 py-1 text-[9px]" style={{ color: t.color, opacity: Math.min(1, t.t) }}>{t.text}</div>)}
            </div>
            {g.biomeBanner.t > 0 && <div className="absolute top-[18%] left-1/2 -translate-x-1/2 text-primary text-lg drop-shadow-[2px_2px_0_black] text-center" style={{ opacity: Math.min(1, g.biomeBanner.t) }}>{g.biomeBanner.name}</div>}
            {g.activeBoss && g.activeBoss.alive && g.activeBoss.boss && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 w-1/2 game-panel p-2 text-[10px]">
                <div className="flex justify-between"><span className="text-destructive">{g.activeBoss.boss.def.name}</span><span>Fase {g.activeBoss.boss.phase}</span></div>
                <div className="h-3 bg-background border border-border"><div className="h-full bg-destructive" style={{ width: `${(g.activeBoss.hp / g.activeBoss.maxhp) * 100}%` }} /></div>
              </div>
            )}

            {/* Dialog */}
            {g.dialog && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[80%] game-panel p-3 flex gap-3">
                <Portrait pal={g.dialog.npc.pal} />
                <div className="flex-1 text-[10px] space-y-2">
                  <div className="text-primary">{g.dialog.npc.name} <span className="opacity-60">— {g.dialog.npc.title}</span></div>
                  <p className="font-body text-lg leading-5">{g.dialog.text}</p>
                  <div className="flex flex-wrap gap-1">{g.dialog.choices.map((c, i) => <Button variant="game" key={i} onClick={() => { g.audio.sfx("ui"); c.act(); }} className="game-btn">{c.label}</Button>)}</div>
                </div>
              </div>
            )}

            {/* Stations */}
            {g.openStation && (
              <Modal title={g.openStation === "smith" ? "⚒ Forja de Brunhild" : g.openStation === "alchemist" ? "⚗ Alquimia de Lira" : "💰 Loja"} onClose={() => (g.openStation = null)}>
                {g.openStation === "shop" ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div><div className="text-primary mb-1">Comprar</div>{SHOP.map((id) => <Row key={id} id={id} right={`${ITEMS[id].price}g`} onClick={() => g.buy(id)} />)}</div>
                    <div><div className="text-primary mb-1">Vender (clique)</div>{g.inventory.map((s, i) => <Row key={i} id={s.id} qty={s.qty} right={`${Math.max(1, Math.floor(ITEMS[s.id].price / 2))}g`} onClick={() => g.sell(i)} />)}</div>
                  </div>
                ) : (
                  <div className="space-y-1">{g.recipes(g.openStation).map((r, i) => {
                    const ok = g.canCraft(r);
                    return (
                      <Button variant="game" key={i} onClick={() => g.craft(r)} className={`w-full flex items-center gap-2 p-1 border border-border text-left ${ok ? "hover:bg-secondary" : "opacity-50"}`}>
                        <Icon id={r.out} /><div className="flex-1"><div>{ITEMS[r.out].name}{r.qty > 1 ? ` ×${r.qty}` : ""}</div><div className="text-[8px] opacity-70">{ITEMS[r.out].desc}</div></div>
                        <div className="text-[8px] text-right">{Object.entries(r.cost).map(([id, n]) => <div key={id} className={g.count(id) >= n ? "" : "text-destructive"}>{ITEMS[id].name} {g.count(id)}/{n}</div>)}{r.gold > 0 && <div>{r.gold}g</div>}</div>
                      </Button>
                    );
                  })}</div>
                )}
              </Modal>
            )}

            {panel === "inv" && (
              <Modal title="Inventário" onClose={() => setPanel(null)}>
                <div className="flex gap-4">
                  <div className="space-y-1 w-48">{(["weapon", "armor", "ring", "amulet"] as Slot[]).map((s) => {
                    const id = p.equip[s];
                    return <Button variant="game" key={s} onClick={() => g.unequip(s)} className="w-full flex items-center gap-2 border border-border p-1 hover:bg-secondary text-left">{id ? <Icon id={id} /> : <div className="w-8 h-8" />}<div><div className="text-[8px] opacity-60">{{ weapon: "Arma", armor: "Armadura", ring: "Anel", amulet: "Amuleto" }[s]}</div><div className="text-[9px]">{id ? ITEMS[id].name : "—"}</div></div></Button>;
                  })}<div className="text-[9px] pt-2">ATQ {g.attackPower()} · DEF {g.defense()}</div></div>
                  <div className="grid grid-cols-6 gap-1 flex-1">
                    {Array.from({ length: g.INV_MAX }).map((_, i) => {
                      const s = g.inventory[i];
                      return <Button variant="game" key={i} onClick={() => s && g.equip(i)} title={s ? `${ITEMS[s.id].name} — ${ITEMS[s.id].desc}` : ""} className="relative aspect-square border border-border bg-background/50 hover:bg-secondary flex items-center justify-center">{s && <><Icon id={s.id} />{s.qty > 1 && <span className="absolute bottom-0 right-0.5 text-[8px]">{s.qty}</span>}</>}</Button>;
                    })}
                  </div>
                </div>
                <div className="text-[8px] opacity-60 mt-2">Clique para equipar/usar. Clique no equipamento para remover.</div>
              </Modal>
            )}
            {panel === "char" && (
              <Modal title={`Herói — Nível ${p.level}`} onClose={() => setPanel(null)}>
                <div className="space-y-2">
                  {([["str", "Força", "Dano corpo-a-corpo"], ["dex", "Destreza", "Arco, crítico, velocidade"], ["vit", "Vitalidade", "HP e defesa"], ["int", "Inteligência", "Magias e cajado"], ["wis", "Sabedoria", "MP, cura, regeneração"]] as [keyof Stats, string, string][]).map(([k, n, d]) => (
                    <div key={k} className="flex items-center gap-2"><span className="w-28">{n}</span><span className="w-8 text-primary">{stats[k]}</span><span className="flex-1 text-[8px] opacity-60">{d}</span><Button variant="game" disabled={p.points <= 0} onClick={() => g.allocate(k)} className="game-btn disabled:opacity-30">+</Button></div>
                  ))}
                  <div className="text-accent">Pontos: {p.points}</div>
                  <div className="text-primary pt-2">Espíritos de Mana</div>
                  {SPIRITS.map((s) => <div key={s.id} className={`text-[9px] ${p.spirits.includes(s.id) ? "" : "opacity-30"}`}><span style={{ color: s.color }}>● {s.name}</span> ({s.elem}) — {s.spell}, {s.mp} MP</div>)}
                </div>
              </Modal>
            )}
            {panel === "quest" && (
              <Modal title="Livro de Missões" onClose={() => setPanel(null)}>
                {["Principais", "Secundárias"].map((h, hi) => (
                  <div key={h} className="mb-3"><div className="text-primary mb-1">{h}</div>
                    {QUESTS.filter((q) => q.main === (hi === 0) && g.questStatus[q.id]).map((q) => (
                      <div key={q.id} className="border border-border p-2 mb-1 text-[9px]"><div>{g.questStatus[q.id] === "done" ? "✔ " : ""}{q.title}</div><div className="font-body text-base opacity-80">{q.desc}</div>{g.questStatus[q.id] === "active" && <div className="text-accent">{g.questProgressText(q)}</div>}</div>
                    ))}
                  </div>
                ))}
              </Modal>
            )}
            {panel === "map" && (
              <Modal title="Mapa do Mundo — Estátuas de Mana" onClose={() => setPanel(null)}>
                <div className="relative w-full" style={{ aspectRatio: `${W}/${H}` }}>
                  <img src={mapUrl} alt="Mapa do mundo" className="w-full h-full" style={{ imageRendering: "pixelated" }} />
                  <div className="absolute w-2 h-2 bg-destructive animate-pulse" style={{ left: `${(p.x / 16 / W) * 100}%`, top: `${(p.y / 16 / H) * 100}%` }} />
                  {STATUES.map((s) => {
                    const on = g.statues.has(s.id);
                    return <Button variant="game" key={s.id} disabled={!on} onClick={() => { g.travel(s.id); setPanel(null); }} className="absolute -translate-x-1/2 -translate-y-1/2 game-btn text-[8px] disabled:opacity-40" style={{ left: `${(s.tx / W) * 100}%`, top: `${(s.ty / H) * 100}%` }}>{on ? "◆ " : "◇ "}{s.name}</Button>;
                  })}
                </div>
                <div className="text-[8px] opacity-60 mt-1">Toque nas estátuas de Mana pelo mundo para ativá-las e viajar.</div>
              </Modal>
            )}
          </>
        )}

        {panel === 'secrets' && g && <Modal title="Diário de Descobertas" onClose={()=>setPanel(null)}>
          <div className="grid grid-cols-2 gap-4 mb-4"><div className="text-accent">{g.discoveries.size}/{BUILDINGS.length}<div className="font-body text-xl text-foreground">Lugares visitados</div></div><div className="text-primary">{g.openedChests.size}/{TREASURES.length+BUILDINGS.length}<div className="font-body text-xl text-foreground">Tesouros encontrados</div></div></div>
          {BUILDINGS.map(b=><div key={b.id} className="flex justify-between border-b border-border/20 py-3"><span className={g.discoveries.has(b.id)?'text-accent':'text-muted-foreground'}>{g.discoveries.has(b.id)?b.name:b.secret?'??? — Lugar esquecido':b.name}</span><span>{g.discoveries.has(b.id)?'◆':'◇'}</span></div>)}
        </Modal>}
        {title && (
          <div className="title-screen absolute inset-0 flex flex-col items-center justify-center gap-5 text-center">
            <div className="title-eyebrow">CRÔNICAS DOS ESPÍRITOS</div><h1 className="game-title">MANA<span>QUEST</span></h1>
            <p className="title-story font-body text-2xl max-w-lg">A Árvore de Mana enfraquece. Reúna os cinco Espíritos e salve o mundo.</p>
            <div className="flex gap-3">
              <Button variant="game" onClick={() => start(false)} className="game-btn text-sm px-6 py-3"><Play size={14}/> Nova jornada</Button>
              {hasSave && <Button variant="game" onClick={() => start(true)} className="game-btn text-sm px-6 py-3">Continuar</Button>}
            </div>
            <span className="title-chapter">CAPÍTULO I · O DESPERTAR DA MANA</span>
          </div>
        )}
      </div>
      <footer className="game-toolbar">
        <div className="toolbar-actions">{([{p:'inv',icon:Backpack,label:'Inventário'},{p:'char',icon:UserRound,label:'Herói'},{p:'quest',icon:ScrollText,label:'Missões'},{p:'map',icon:Map,label:'Mapa'},{p:'secrets',icon:Compass,label:'Descobertas'}] as const).map(({p:tab,icon:ToolIcon,label})=><Button key={tab} variant="ghost" size="icon" disabled={title} title={label} aria-label={label} onClick={()=>setPanel(panel===tab?null:tab)} className={panel===tab?'text-primary':'text-muted-foreground'}><ToolIcon size={18}/></Button>)}</div>
        <span className="footer-chapter">{title ? 'A LENDA COMEÇA AQUI' : `${g?.openedChests.size ?? 0} TESOUROS · ${g?.discoveries.size ?? 0} DESCOBERTAS`}</span>
        <Button variant="ghost" size="icon" title="Ativar ou silenciar áudio" aria-label="Alternar áudio" onClick={()=>g?.audio.toggleMute()}>{g?.audio.muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</Button>
      </footer>
      </div>
    </main>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 bg-background/50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="game-panel p-4 w-full max-w-2xl max-h-full overflow-auto text-[10px]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-3"><span className="text-primary text-xs">{title}</span><Button variant="game" onClick={onClose} className="game-btn" aria-label="Fechar"><X size={14}/></Button></div>
        {children}
      </div>
    </div>
  );
}
function Row({ id, qty, right, onClick }: { id: string; qty?: number; right: string; onClick: () => void }) {
  return <Button variant="game" onClick={onClick} title={ITEMS[id].desc} className="w-full flex items-center gap-2 p-1 hover:bg-secondary text-left"><Icon id={id} size={24} /><span className="flex-1 text-[9px]">{ITEMS[id].name}{qty && qty > 1 ? ` ×${qty}` : ""}</span><span className="text-primary text-[9px]">{right}</span></Button>;
}
