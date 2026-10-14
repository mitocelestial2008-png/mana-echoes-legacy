# Mana Echoes Legacy

Crie um jogo de RPG 2D estilo MMORPG retrô inspirado em Source of Mana (https://github.com/sourceofmana/sourceofmana) com visual pixel art 16-bit clássico (na linha de Secret of Mana e The Mana World). O jogo deve ser muito maior e mais completo que o original, contendo:

1. **Mundo Expandido e Novos Biomas:**
   - Mapa amplo em grid/tilemap com transição fluida entre diferentes regiões:
     - Planícies de Potos / Vila Inicial (verdejante, pacífica)
     - Floresta Ancestral dos Espíritos (densa, misteriosa, caminhos entrelaçados)
     - Deserto Escaldante de Areias Místicas (oásis, ruínas antigas)
     - Cavernas de Cristais de Mana (subterrâneo, iluminação dinâmica, cristais brilhantes)
     - Picos Congelados da Montanha Sagrada (neve, neblina, caminhos escorregadios)
   - Minimapa interativo, pontos de viagem rápida (estátuas de Mana) e ciclo dia/noite ou clima ambiente.

2. **Novos Inimigos e Chefes:**
   - Variedade de criaturas por bioma (Mushrooms, Goblins, Esporitos de Planta, Escorpiões das Sombras, Golens de Pedra, Lobos da Neve, Espíritos Sombrios).
   - Chefes de área desafiadores com padrões de ataque em fases (ataques telegrafados, invocações e projéteis mágicos).

3. **Sistemas de Combate e Magia:**
   - Combate de ação em tempo real com controle responsivo (WASD/setas, clique do mouse para andar/atacar ou teclas de ação).
   - Tipos de armas: Espada de Mana, Lança, Arco e Cajado Elemental.
   - Sistema de Espíritos de Mana (Salamando/Fogo, Undine/Água e Gelo, Sylph/Vento, Lumina/Luz, Dryad/Cura) com magias elementais equipáveis e barra de Mana/MP.

4. **Progressão, Inventário e Crafting:**
   - Sistema de Nível, XP, atributos (Força, Destreza, Vitalidade, Inteligência, Sabedoria).
   - Inventário com slots, equipamentos visuais (armadura, anéis, amuletos), poções e itens de cura.
   - Coleta de recursos pelo mapa (ervas, minérios, fragmentos de mana) e sistema de forja/crafting em ferreiros e alquimistas.

5. **NPCs, Diálogos e Missões:**
   - NPCs na vila e acampamentos com caixas de diálogo estilo RPG clássico, retratos de personagens e escolhas.
   - Livro de missões (Quests principais e secundárias) com rastreador na interface.

6. **Áudio e Visual:**
   - Efeitos visuais vibrantes em pixel art para magias, impactos de dano flutuante e animações fluidas.
   - SFX retrô sintetizados via Web Audio API e trilha sonora nostálgica de aventura em loop.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9c14bc1a-16fd-4f83-935e-3efa2a5dba78).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
